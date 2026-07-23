import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Flash } from '../components/Flash'
import {
  getAtoStatus,
  markAtoConnected,
  syncAtoBusinesses,
  unlinkAto,
  type AtoStatusResult,
} from '../api/generated'

// Markup ported verbatim from the original app/(portal)/ato-portal/page.tsx —
// the rendered blocks only: status panel (with the link-to-ato-gate checkboxes),
// sync section, and the dark help card. The original's NominationPanel/Step
// components are dead code there (never rendered) and are not ported.
export function AtoPortalPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState<AtoStatusResult | null>(null)
  const [busy, setBusy] = useState(false)
  // link-to-ato-gate: both boxes must be ticked before the Link button activates.
  const [myid, setMyid] = useState(false)
  const [ram, setRam] = useState(false)

  const load = useCallback(async () => {
    try { const { data } = await getAtoStatus(); setStatus(data ?? null) } catch { /* ignore */ }
  }, [])

  useEffect(() => { void load() }, [load])

  const connected = status?.connected ?? false
  const ready = myid && ram

  async function onUnlink() {
    setBusy(true)
    try { await unlinkAto(); await load(); setParams({ ok: 'Unlinked from ATO' }) }
    catch { setParams({ err: 'Could not unlink. Try again.' }) }
    finally { setBusy(false) }
  }

  async function onMarkConnected() {
    setBusy(true)
    try { await markAtoConnected({ body: { desired: true } }); await load(); setParams({ ok: 'Marked as connected' }) }
    catch { setParams({ err: 'Could not update the connection state.' }) }
    finally { setBusy(false) }
  }

  async function onSync() {
    setBusy(true)
    try {
      const { data } = await syncAtoBusinesses()
      if (data?.needsRelink) {
        // Original: no session → send the user straight through the link flow.
        navigate('/ato-portal/link')
        return
      }
      if (!data?.ok) { setParams({ err: data?.reason || 'No businesses could be extracted from ATO.' }); return }
      setParams({ ok: `Synced ${Number(data.syncedCount) || 0} business(es) from ATO.` })
    } catch (e) {
      const message = (e as { error?: string })?.error
      setParams({ err: message || 'Unexpected error during ATO sync.' })
    } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader
        title="Connect your Business to the ATO Portal"
        subtitle="Link your business so we can pull your tax registrations, BAS history and prefill information."
      />
      <Flash ok={params.get('ok')} err={params.get('err')} />

      {/* Status panel */}
      <section
        className={`card-pad mb-8 border-l-4 ${
          connected ? 'border-l-accent-500' : 'border-l-amber-400'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`relative h-12 w-12 shrink-0 rounded-full flex items-center justify-center ${
                connected ? 'bg-accent-100' : 'bg-amber-100'
              }`}
            >
              <span
                className={`h-3 w-3 rounded-full ${
                  connected ? 'bg-accent-500' : 'bg-amber-500'
                } animate-pulse`}
              />
              <span
                className={`absolute h-12 w-12 rounded-full ${
                  connected ? 'bg-accent-500/30' : 'bg-amber-500/30'
                } animate-ping`}
              />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-navy-500">
                ATO Portal connection
              </div>
              <div
                className={`text-xl font-bold ${
                  connected ? 'text-accent-700' : 'text-amber-700'
                }`}
              >
                {connected ? 'Connected' : 'Needs Connecting'}
              </div>
              {connected ? (
                <div className="text-sm text-navy-600 mt-0.5">
                  We can retrieve information from the ATO Portal on your behalf.
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:min-w-[280px] sm:items-stretch">
            {connected ? (
              <button onClick={onUnlink} disabled={busy} className="btn-secondary w-full">
                Unlink from ATO
              </button>
            ) : (
              <>
                {ready ? (
                  <Link to="/ato-portal/link" className="btn-primary">
                    Link to ATO (myID)
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="btn-primary opacity-50 cursor-not-allowed"
                    aria-disabled="true"
                    title="Tick both boxes to continue"
                  >
                    Link to ATO (myID)
                  </button>
                )}
                {/* Prereq checkboxes sit RIGHT UNDER the button so it's
                    obvious they have to be ticked before the button becomes active. */}
                <div className="flex flex-col gap-2">
                  <label className="flex items-start gap-2 text-sm text-navy-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={myid}
                      onChange={(e) => setMyid(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-brand-600"
                    />
                    <span>Have you downloaded and installed the My ID app?</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm text-navy-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={ram}
                      onChange={(e) => setRam(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-brand-600"
                    />
                    <span>Have you connected your Business to Relationship Access Manager?</span>
                  </label>
                </div>
                <button onClick={onMarkConnected} disabled={busy} className="btn-ghost text-xs w-full">
                  Mark as connected (manual)
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Sync from ATO — visible whenever the session is live. */}
      {connected ? (
        <section className="card-pad mb-6 border-l-4 border-l-accent-500">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-semibold text-navy-900">Sync businesses from ATO</h3>
              <p className="text-sm text-navy-600 mt-1">
                Pulls Name, <strong>TFN</strong>, ACN and tax accounts for each of
                your ABNs from Online services for Business into{' '}
                <Link to="/business" className="text-brand-700 hover:underline">
                  Business Details
                </Link>
                . Runs automatically when you link, plus this button to re-pull anytime.
              </p>
              <p className="text-xs text-navy-500 mt-2">
                To sync a business not in your list yet, add its ABN under{' '}
                <Link to="/business" className="underline">
                  Business Details → Add entity
                </Link>{' '}
                first, then click Sync.
              </p>
            </div>
            <button onClick={onSync} disabled={busy} className="btn-primary">
              {busy ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
        </section>
      ) : null}

      <div className="mt-10 card-pad bg-navy-900 text-white">
        <h3 className="font-semibold text-white">Need help?</h3>
        <p className="text-sm text-navy-200 mt-1">
          If you get stuck at any step, message support — we can walk you through it on a
          call or remote screen share.
        </p>
        <div className="mt-4">
          <Link to="/messages" className="btn-accent">Message support</Link>
        </div>
        <p className="mt-4 text-xs text-navy-400">
          Reference: ATO — How to nominate your registered agent (ato.gov.au). Information
          here is a plain-English summary; always check the ATO site for the latest
          official guidance.
        </p>
      </div>
    </>
  )
}
