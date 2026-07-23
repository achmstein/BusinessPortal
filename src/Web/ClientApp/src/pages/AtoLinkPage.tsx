import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Flash } from '../components/Flash'
import {
  pollAtoLink,
  selectAtoAgent,
  startAtoLink,
  type AtoAgentDto,
  type AtoPollResult,
} from '../api/generated'

type Step = 'email' | 'code' | 'success' | 'failed'

// Each pollAtoLink call is a ~20s server-side long-poll. This caps the number of
// consecutive calls (the server attempt row also expires, returning Expired).
const MAX_POLLS = 18

// Markup ported verbatim from the original app/(portal)/ato-portal/link/page.tsx
// (email → code → success → failed). The original's meta-refresh polling becomes
// the SPA long-poll; the AUTO_START_TESTING shortcut and DebugTrace dev panel are
// not ported. saveSelectedAgent's redirect-with-flash lands on /ato-portal?ok=….
export function AtoLinkPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('email')
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [agents, setAgents] = useState<AtoAgentDto[]>([])
  const [selectedAbn, setSelectedAbn] = useState('')
  const [flashErr, setFlashErr] = useState<string | null>(null)
  const [failErr, setFailErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const pollingRef = useRef(false)

  function applyPollResult(data: AtoPollResult): boolean {
    if (data.status === 'Linked') {
      pollingRef.current = false
      const list = data.agents ?? []
      setAgents(list)
      setSelectedAbn(list[0]?.abn ?? '')
      setStep('success')
      return true
    }
    if (data.status === 'Failed' || data.status === 'Expired') {
      pollingRef.current = false
      setFailErr(data.reason ?? null)
      setStep('failed')
      return true
    }
    return false // Pending — keep going
  }

  async function onStart(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const email = String(new FormData(e.currentTarget).get('email') || '').trim().toLowerCase()
    if (!email || !email.includes('@')) {
      setFlashErr('Please enter a valid email')
      return
    }
    setBusy(true)
    setFlashErr(null)
    try {
      const { data } = await startAtoLink({ body: { email } })
      setAttemptId(data!.attemptId)
      setCode(data!.referenceCode)
      setStep('code')
    } catch (e) {
      const message = (e as { error?: string })?.error
      setFlashErr(message || 'Unexpected error during ATO link.')
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
          if (applyPollResult(data!)) return
          // Pending → the server already waited ~20s; loop straight into the next poll.
        } catch {
          await new Promise((r) => setTimeout(r, 2000)) // transient — brief pause then retry
        }
      }
      if (pollingRef.current) {
        setFailErr('Timed out waiting for approval on the myID app.')
        setStep('failed')
      }
    })()
    return () => { pollingRef.current = false }
  }, [step, attemptId])

  // "I've approved on my phone" — the original checkLinkStatus button. The loop
  // is already long-polling; this just fires one extra check right now.
  async function onCheckNow() {
    if (!attemptId || busy) return
    setBusy(true)
    try {
      const { data } = await pollAtoLink({ body: { attemptId } })
      applyPollResult(data!)
    } catch { /* transient — the loop keeps polling */ }
    finally { setBusy(false) }
  }

  // saveSelectedAgent port: mark connected + auto-sync + auto-nominate server-side,
  // then land on /ato-portal with the same composed flash message.
  async function onSave() {
    setBusy(true)
    let msg = 'Linked to ATO.'
    try {
      const { data } = await selectAtoAgent({ body: { abn: selectedAbn } })
      const synced = Number(data?.syncedCount) || 0
      if (synced > 0) msg += ` Synced ${synced} business${synced === 1 ? '' : 'es'} from ATO.`
      if (data?.nomination === 'submitted') msg += ' Nominated us as your tax agent.'
      else if (data?.nomination === 'already_nominated') msg += " (You'd already nominated us — no action needed.)"
    } catch { /* best-effort — errors don't block the redirect, same as the original */ }
    navigate(`/ato-portal?ok=${encodeURIComponent(msg)}`)
  }

  function restart() {
    pollingRef.current = false
    setStep('email')
    setAttemptId(null)
    setCode(null)
    setAgents([])
    setSelectedAbn('')
    setFlashErr(null)
    setFailErr(null)
  }

  return (
    <>
      <div className="mb-2">
        <Link to="/ato-portal" className="text-sm text-brand-700 hover:underline">← ATO Portal</Link>
      </div>
      <PageHeader
        title="Link your business to the ATO"
        subtitle="Authenticate with myID and nominate us as your registered tax agent."
      />
      <Flash err={flashErr ?? (step === 'failed' ? failErr : null)} />

      {step === 'email' ? (
        <section className="card-pad max-w-2xl">
          <h2 className="font-semibold text-navy-900">Before we start</h2>
          <ol className="list-decimal pl-5 mt-2 text-sm text-navy-700 space-y-1">
            <li>You've downloaded the <strong>myID</strong> app from the App Store or Google Play.</li>
            <li>You're the principal authority for the business (director, owner, public officer).</li>
            <li>You'll have your phone with you in the next minute.</li>
          </ol>

          <p className="mt-4 text-sm text-navy-700">
            We <strong>never see your password or 2FA</strong>. The myID app on your phone is
            what authorises the link — we just pass the OAuth tokens through.
          </p>

          <form onSubmit={onStart} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                myID email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="input"
                autoComplete="email"
              />
            </div>

            <label className="flex items-start gap-2 text-sm text-navy-700">
              <input
                type="checkbox"
                name="consent"
                required
                className="mt-1 h-4 w-4"
              />
              <span>
                I authorise the Business Portal to act on my behalf to link my ATO account.
                I understand my consent will be recorded.
              </span>
            </label>

            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? 'Starting…' : 'Start ATO link'}
            </button>
          </form>
        </section>
      ) : null}

      {step === 'code' ? (
        <section className="card-pad max-w-2xl">
          <h2 className="font-semibold text-navy-900">Approve on your phone</h2>

          <ol className="mt-3 list-decimal pl-5 text-sm text-navy-700 space-y-1">
            <li>Open <strong>myID</strong> on your phone.</li>
            <li>If the app prompts, type the code shown below.</li>
            <li>Tap <strong>Approve</strong>.</li>
          </ol>

          {code ? (
            <div className="mt-6 rounded-lg bg-brand-50 border border-brand-200 p-6 text-center">
              <div className="text-xs uppercase tracking-wider text-brand-700">Reference code</div>
              <div className="mt-1 text-5xl font-bold text-brand-900 tracking-widest">
                {code}
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
              Waiting for your approval on the myID app…
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button onClick={onCheckNow} disabled={busy} className="btn-secondary">
              I've approved on my phone
            </button>
            <button onClick={restart} className="btn-ghost">Cancel</button>
          </div>

          <p className="mt-6 text-xs text-navy-500">
            This page auto-refreshes every few seconds. The approval window is 5 minutes —
            if you miss it, just click "Cancel" and start again.
          </p>
        </section>
      ) : null}

      {step === 'success' ? (
        <section className="card-pad max-w-2xl">
          <h2 className="font-semibold text-accent-700">✓ ATO link successful</h2>
          <p className="mt-2 text-sm text-navy-700">
            Your myID session is now connected to the Business Portal. We can read your tax
            registration details on your behalf.
          </p>

          {agents.length > 0 ? (
            <form onSubmit={(e) => { e.preventDefault(); void onSave() }} className="mt-6 space-y-4">
              <div>
                <label className="label">Which agent profile should we use?</label>
                {agents.length === 1 ? null : (
                  <select
                    name="abn"
                    className="input"
                    value={selectedAbn}
                    onChange={(e) => setSelectedAbn(e.target.value)}
                  >
                    {agents.map((a) => (
                      <option key={a.abn} value={a.abn}>
                        {a.name} — ABN {a.abn} · RAN {a.ran}
                      </option>
                    ))}
                  </select>
                )}
                {agents.length === 1 && (
                  <p className="mt-1 text-xs text-navy-500">
                    Using <strong>{agents[0].name}</strong> (RAN {agents[0].ran}).
                  </p>
                )}
              </div>

              <button type="submit" disabled={busy} className="btn-primary">
                {busy ? 'Saving…' : 'Save and continue'}
              </button>
            </form>
          ) : (
            <div className="mt-6">
              <p className="text-sm text-navy-600">
                No tax agents were found on your myID record. You can still continue —
                we'll link the session without an agent selection.
              </p>
              <button onClick={onSave} disabled={busy} className="btn-primary mt-3">
                {busy ? 'Saving…' : 'Continue to ATO Portal'}
              </button>
            </div>
          )}
        </section>
      ) : null}

      {step === 'failed' ? (
        <section className="card-pad max-w-2xl border-l-4 border-l-red-400">
          <h2 className="font-semibold text-red-800">ATO link failed</h2>
          <p className="mt-2 text-sm text-navy-700">
            {failErr
              ? failErr
              : 'Something went wrong during the ATO authentication. Try again, and if it keeps failing send us a message.'}
          </p>
          <div className="mt-6 flex gap-3">
            <button onClick={restart} className="btn-primary">Try again</button>
            <Link to="/messages" className="btn-secondary">Message support</Link>
          </div>
        </section>
      ) : null}
    </>
  )
}
