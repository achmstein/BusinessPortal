import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { getAtoStatus, syncAtoBusinesses, unlinkAto, type AtoStatusResult } from '../api/generated'

export function AtoPortalPage() {
  const [status, setStatus] = useState<AtoStatusResult | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [chkApp, setChkApp] = useState(false)
  const [chkRam, setChkRam] = useState(false)

  const load = useCallback(async () => {
    try { const { data } = await getAtoStatus(); setStatus(data ?? null) } catch { /* ignore */ }
  }, [])

  useEffect(() => { void load() }, [load])

  async function onSync() {
    setBusy(true); setFlash(null)
    try {
      const { data } = await syncAtoBusinesses()
      if (data?.needsRelink) setFlash('Your ATO session has expired — please link to the ATO again.')
      else setFlash(`Synced ${Number(data?.syncedCount) || 0} business(es) from the ATO. See Business Details.`)
    } catch { setFlash('Sync failed. Try again shortly.') }
    finally { setBusy(false) }
  }

  async function onUnlink() {
    setBusy(true); setFlash(null)
    try { await unlinkAto(); await load(); setFlash('Unlinked from the ATO.') }
    catch { setFlash('Could not unlink. Try again.') }
    finally { setBusy(false) }
  }

  const connected = status?.connected ?? false
  const canLink = chkApp && chkRam

  return (
    <>
      <PageHeader
        title="Link to ATO"
        subtitle="Connect your myID so we can retrieve your business information from the ATO on your behalf."
      />

      {flash ? (
        <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 text-brand-800 text-sm px-4 py-2.5">{flash}</div>
      ) : null}

      <section className="card-pad">
        {connected ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-accent-500" />
              </span>
              <div>
                <div className="font-semibold text-navy-900">Connected</div>
                <div className="text-sm text-navy-600">We can retrieve information from the ATO Portal on your behalf.</div>
              </div>
            </div>
            <button onClick={onUnlink} disabled={busy} className="btn-ghost text-red-700 hover:bg-red-50 shrink-0">
              Unlink from ATO
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
              </span>
              <div>
                <div className="font-semibold text-navy-900">Needs Connecting</div>
                <div className="text-sm text-navy-600">Link your myID to get started.</div>
              </div>
            </div>

            <div className="sm:w-80 flex flex-col gap-3">
              {canLink ? (
                <Link to="/ato-portal/link" className="btn-primary text-center">Link to ATO (myID)</Link>
              ) : (
                <button disabled className="btn-primary opacity-50 cursor-not-allowed">Link to ATO (myID)</button>
              )}
              <label className="flex items-start gap-2 text-sm text-navy-700">
                <input type="checkbox" checked={chkApp} onChange={(e) => setChkApp(e.target.checked)} className="mt-0.5" />
                <span>Have you downloaded and installed the myID app?</span>
              </label>
              <label className="flex items-start gap-2 text-sm text-navy-700">
                <input type="checkbox" checked={chkRam} onChange={(e) => setChkRam(e.target.checked)} className="mt-0.5" />
                <span>Have you connected your Business to Relationship Access Manager (RAM)?</span>
              </label>
            </div>
          </div>
        )}
      </section>

      {connected ? (
        <section className="card-pad mt-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-navy-900">Sync businesses from ATO</h3>
              <p className="text-sm text-navy-600 mt-0.5">
                Pull the latest legal name, TFN, ACN and tax accounts for every business you can act for.
              </p>
              {status?.nominatedAt ? (
                <p className="text-xs text-accent-700 mt-2">
                  ✓ We've been nominated as your tax agent{status.nominatedFromAbn ? ` (via ABN ${status.nominatedFromAbn})` : ''}.
                </p>
              ) : null}
            </div>
            <button onClick={onSync} disabled={busy} className="btn-primary shrink-0">
              {busy ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
        </section>
      ) : null}

      <section className="card-pad mt-6">
        <h3 className="font-semibold text-navy-900">Need help?</h3>
        <p className="text-sm text-navy-600 mt-1">
          If you're having trouble linking, send us a message and we'll walk you through it.
        </p>
        <Link to="/messages" className="btn-secondary mt-3 inline-block">Message support</Link>
      </section>
    </>
  )
}
