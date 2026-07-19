import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { startAtoLink, pollAtoLink, selectAtoAgent, type AtoAgentDto } from '../api/generated'

type Step = 'email' | 'code' | 'pick' | 'done' | 'failed'

// Each pollAtoLink call is a ~20s server-side long-poll. This caps the number of
// consecutive calls (the server attempt row also expires, returning Expired).
const MAX_POLLS = 18

export function AtoLinkPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [agents, setAgents] = useState<AtoAgentDto[]>([])
  const [selectedAbn, setSelectedAbn] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ syncedCount: number; nomination: string } | null>(null)
  const pollingRef = useRef(false)

  async function onStart(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true); setError(null)
    try {
      const { data } = await startAtoLink({ body: { email: email.trim() } })
      setAttemptId(data!.attemptId)
      setCode(data!.referenceCode)
      setStep('code')
    } catch {
      setError('Could not start the link. Please try again.')
    } finally { setBusy(false) }
  }

  // Poll for approval while on the 'code' step.
  useEffect(() => {
    if (step !== 'code' || !attemptId) return
    pollingRef.current = true
    void (async () => {
      for (let i = 0; i < MAX_POLLS && pollingRef.current; i++) {
        try {
          const { data } = await pollAtoLink({ body: { attemptId } })
          if (!pollingRef.current) return
          if (data!.status === 'Linked') {
            setAgents(data!.agents)
            setSelectedAbn(data!.agents[0]?.abn ?? '')
            setStep('pick')
            return
          }
          if (data!.status === 'Failed' || data!.status === 'Expired') {
            setError(data!.reason ?? 'The link attempt did not complete.')
            setStep('failed')
            return
          }
          // Pending → the server already waited ~20s; loop straight into the next poll.
        } catch {
          await new Promise((r) => setTimeout(r, 2000)) // transient — brief pause then retry
        }
      }
      if (pollingRef.current) { setError('Timed out waiting for approval on your myID app.'); setStep('failed') }
    })()
    return () => { pollingRef.current = false }
  }, [step, attemptId])

  async function onConfirm() {
    if (!selectedAbn) return
    setBusy(true); setError(null)
    try {
      const { data } = await selectAtoAgent({ body: { abn: selectedAbn } })
      setResult({ syncedCount: Number(data!.syncedCount) || 0, nomination: data!.nomination })
    } catch {
      // Still linked — the finishing steps (sync/nominate) can be retried from /ato-portal.
      setResult({ syncedCount: 0, nomination: 'failed' })
    } finally {
      setBusy(false)
      setStep('done')
    }
  }

  function restart() {
    setStep('email'); setAttemptId(null); setCode(null); setAgents([]); setSelectedAbn(''); setError(null); setResult(null)
  }

  return (
    <>
      <PageHeader title="Link to ATO" subtitle="Connect your myID to the ATO Business portal." />

      {error && step !== 'failed' ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-2.5">{error}</div>
      ) : null}

      {step === 'email' ? (
        <section className="card-pad max-w-lg">
          <h3 className="font-semibold text-navy-900">Step 1 — Your myID email</h3>
          <p className="text-sm text-navy-600 mt-1">
            Enter the email you use to sign in to the myID app. We'll send a 4-digit code to approve.
          </p>
          <form onSubmit={onStart} className="mt-4 space-y-4">
            <div>
              <label className="label">myID email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input"
                placeholder="you@example.com"
              />
            </div>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? 'Starting…' : 'Start linking'}
            </button>
          </form>
        </section>
      ) : null}

      {step === 'code' ? (
        <section className="card-pad max-w-lg text-center">
          <h3 className="font-semibold text-navy-900">Step 2 — Approve in your myID app</h3>
          <p className="text-sm text-navy-600 mt-1">Open the myID app on your phone and enter this code:</p>
          <div className="my-6 text-5xl font-bold tracking-[0.3em] text-brand-700">{code}</div>
          <div className="flex items-center justify-center gap-2 text-sm text-navy-500">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-500" />
            </span>
            Waiting for approval…
          </div>
          <button onClick={restart} className="btn-ghost mt-6 text-sm">Cancel</button>
        </section>
      ) : null}

      {step === 'pick' ? (
        <section className="card-pad max-w-lg">
          <h3 className="font-semibold text-navy-900">Step 3 — Choose your business</h3>
          <p className="text-sm text-navy-600 mt-1">
            Pick the ABN to link. We'll sync its details and nominate us as your tax agent.
          </p>
          {agents.length === 0 ? (
            <p className="mt-4 text-sm text-navy-500 italic">
              No businesses were found on this myID. You can still continue and sync later.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {agents.map((a) => (
                <li key={a.abn}>
                  <label className="flex items-center gap-3 rounded-lg border border-navy-100 p-3 cursor-pointer hover:bg-navy-50">
                    <input
                      type="radio"
                      name="abn"
                      value={a.abn}
                      checked={selectedAbn === a.abn}
                      onChange={() => setSelectedAbn(a.abn)}
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-navy-900 truncate">{a.name}</div>
                      <div className="text-xs text-navy-500">ABN {a.abn} · RAN {a.ran}</div>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <button onClick={onConfirm} disabled={busy || (agents.length > 0 && !selectedAbn)} className="btn-primary mt-4">
            {busy ? 'Finishing…' : 'Confirm & finish'}
          </button>
        </section>
      ) : null}

      {step === 'done' ? (
        <section className="card-pad max-w-lg">
          <h3 className="font-semibold text-accent-800">✓ Linked to the ATO</h3>
          <p className="text-sm text-navy-700 mt-2">
            {result ? `Synced ${result.syncedCount} business(es) from the ATO.` : 'Your ATO session is active.'}
            {result?.nomination === 'submitted' ? ' We\'ve been nominated as your tax agent.' : null}
            {result?.nomination === 'already_nominated' ? ' You had already nominated us as your tax agent.' : null}
            {result?.nomination === 'failed' ? ' We couldn\'t finish the agent nomination — you can retry Sync from the ATO page.' : null}
          </p>
          <Link to="/ato-portal" className="btn-primary mt-4 inline-block">Back to Link to ATO</Link>
        </section>
      ) : null}

      {step === 'failed' ? (
        <section className="card-pad max-w-lg">
          <h3 className="font-semibold text-red-800">Linking didn't complete</h3>
          <p className="text-sm text-navy-700 mt-2">{error ?? 'Something went wrong.'}</p>
          <div className="mt-4 flex gap-2">
            <button onClick={restart} className="btn-primary">Try again</button>
            <Link to="/messages" className="btn-secondary">Message support</Link>
          </div>
        </section>
      ) : null}
    </>
  )
}
