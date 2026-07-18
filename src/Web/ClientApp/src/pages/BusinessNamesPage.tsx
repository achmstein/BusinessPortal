import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import {
  createBusinessName,
  deleteBusinessName,
  getAbnLookupStatus,
  getBusinessNames,
  startAbnLookup,
  updateBusinessName,
  type AbnLookupJobDto,
  type BusinessNameDto,
} from '../api/generated'

function renewalBadge(iso?: string) {
  if (!iso) return <span className="badge-gray">—</span>
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < 0) return <span className="badge-red">Expired</span>
  if (days <= 60) return <span className="badge-amber">{days}d to renew</span>
  return <span className="badge-green">OK</span>
}

function JobBanner({ job, onDismiss }: { job: AbnLookupJobDto; onDismiss: () => void }) {
  if (job.status === 'Running') {
    const total = Number(job.totalAbns) || 0
    const done = Number(job.abnsProcessed) || 0
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return (
      <section className="mb-4 rounded-lg border border-brand-200 bg-brand-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-brand-900">Looking up your business names…</div>
            <div className="text-sm text-brand-800 mt-0.5">
              Processed {done} of {total} ABN(s). You can navigate away and come back later.
            </div>
          </div>
          <div className="text-2xl font-bold text-brand-700">{pct}%</div>
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-brand-100 overflow-hidden">
          <div className="h-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </section>
    )
  }

  if (job.status === 'Failed') {
    return (
      <section className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-red-900">ABN Lookup failed</div>
            <div className="text-sm text-red-800 mt-0.5">{job.error || 'Something went wrong. Try again.'}</div>
          </div>
          <button onClick={onDismiss} className="btn-ghost text-xs">Dismiss</button>
        </div>
      </section>
    )
  }

  return (
    <section className="mb-4 rounded-lg border border-accent-200 bg-accent-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-accent-900">ABN Lookup finished</div>
          <div className="text-sm text-accent-800 mt-0.5">
            Checked {Number(job.totalAbns) || 0} ABN(s) — added {Number(job.addedCount) || 0} new name(s)
            {Number(job.enrichedCount) > 0 ? `, filled in ${job.enrichedCount} renewal date(s)` : ''}.
          </div>
        </div>
        <button onClick={onDismiss} className="btn-ghost text-xs">Dismiss</button>
      </div>
    </section>
  )
}

export function BusinessNamesPage() {
  const [list, setList] = useState<BusinessNameDto[]>([])
  const [job, setJob] = useState<AbnLookupJobDto | null>(null)
  const [flash, setFlash] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const pollRef = useRef<number | null>(null)

  const load = useCallback(async () => {
    try {
      const { data } = await getBusinessNames()
      setList([...(data ?? [])].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')))
    } catch { /* ignore */ }
  }, [])

  const loadJob = useCallback(async () => {
    try {
      const { data } = await getAbnLookupStatus()
      setJob(data ?? null)
      return data ?? null
    } catch {
      setJob(null)
      return null
    }
  }, [])

  useEffect(() => {
    void load()
    void loadJob()
  }, [load, loadJob])

  // Poll while a job is running; reload names when it finishes.
  useEffect(() => {
    if (job?.status !== 'Running') {
      if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null }
      return
    }
    pollRef.current = window.setInterval(async () => {
      const j = await loadJob()
      if (j && j.status !== 'Running') { await load(); }
    }, 4000)
    return () => { if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null } }
  }, [job?.status, load, loadJob])

  async function onRequestLookup() {
    try {
      await startAbnLookup()
      setFlash({ tone: 'ok', text: 'Started ABN lookup — this runs in the background.' })
      await loadJob()
    } catch {
      setFlash({ tone: 'err', text: 'Could not start the lookup. Try again shortly.' })
    }
  }

  async function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const name = String(f.get('name') || '').trim()
    if (!name) { setFlash({ tone: 'err', text: 'Please enter a business name' }); return }
    await createBusinessName({
      body: {
        name,
        dateRegistered: String(f.get('dateRegistered') || ''),
        renewalDate: String(f.get('renewalDate') || ''),
        asicKey: String(f.get('asicKey') || ''),
      },
    })
    form.reset()
    setFlash({ tone: 'ok', text: 'Business name added' })
    await load()
  }

  async function onUpdate(id: string, e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    await updateBusinessName({
      path: { id },
      body: {
        id,
        name: String(f.get('name') || ''),
        dateRegistered: String(f.get('dateRegistered') || ''),
        renewalDate: String(f.get('renewalDate') || ''),
        asicKey: String(f.get('asicKey') || ''),
      },
    })
    setFlash({ tone: 'ok', text: 'Business name updated' })
    await load()
  }

  async function onRemove(id: string) {
    await deleteBusinessName({ path: { id } })
    setFlash({ tone: 'ok', text: 'Business name removed' })
    await load()
  }

  return (
    <>
      <PageHeader
        title="Business Names"
        subtitle="List the business names you currently have registered. Add as many as you need."
        actions={
          <button onClick={onRequestLookup} className="btn-primary">
            Request information from ABN Lookup
          </button>
        }
      />

      {flash ? (
        <div className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${flash.tone === 'ok' ? 'bg-accent-50 border-accent-200 text-accent-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {flash.text}
        </div>
      ) : null}

      {job ? <JobBanner job={job} onDismiss={() => setJob(null)} /> : null}

      <section className="card-pad">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-navy-900">Your business names</h3>
          <span className="badge-gray">{list.length} {list.length === 1 ? 'name' : 'names'}</span>
        </div>

        {list.length === 0 ? (
          <p className="mt-3 text-sm text-navy-500 italic">No business names added yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {list.map((b) => (
              <li key={b.id} className="rounded-lg border border-navy-100 p-4 bg-white">
                <details>
                  <summary className="flex items-center justify-between gap-3 cursor-pointer list-none">
                    <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap text-sm">
                      <span className="font-semibold text-navy-900 truncate">{b.name}</span>
                      <span className="text-navy-400">·</span>
                      <span className="text-navy-600">Registered {b.dateRegistered ? new Date(b.dateRegistered).toLocaleDateString() : '—'}</span>
                      <span className="text-navy-400">·</span>
                      <span className="text-navy-600">Renews {b.renewalDate ? new Date(b.renewalDate).toLocaleDateString() : '—'}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {renewalBadge(b.renewalDate)}
                      <span className="text-navy-400 text-xs">Edit ▾</span>
                    </div>
                  </summary>

                  <form onSubmit={(e) => onUpdate(b.id!, e)} className="mt-4 space-y-4 border-t border-navy-100 pt-4">
                    <div className="form-grid">
                      <div className="sm:col-span-2">
                        <label className="label">Business name</label>
                        <input name="name" defaultValue={b.name} required className="input" />
                      </div>
                      <div>
                        <label className="label">Date registered</label>
                        <input name="dateRegistered" type="date" defaultValue={b.dateRegistered} className="input" />
                      </div>
                      <div>
                        <label className="label">Renewal date</label>
                        <input name="renewalDate" type="date" defaultValue={b.renewalDate} className="input" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label flex flex-wrap items-baseline gap-x-2">
                          <span>ASIC key</span>
                          <span className="text-xs font-normal text-navy-500 italic">If unknown, leave blank and it will be emailed to you from ASIC.</span>
                        </label>
                        <input name="asicKey" defaultValue={b.asicKey} className="input" />
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 justify-end">
                      <button type="submit" className="btn-primary">Save changes</button>
                    </div>
                  </form>

                  <div className="mt-2 flex justify-end">
                    <button onClick={() => onRemove(b.id!)} className="btn-ghost text-red-700 hover:bg-red-50">
                      Remove this business name
                    </button>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-pad mt-6">
        <h3 className="font-semibold text-navy-900">Add a business name</h3>
        <form onSubmit={onAdd} className="mt-4 space-y-4">
          <div className="form-grid">
            <div className="sm:col-span-2">
              <label className="label">Business name</label>
              <input name="name" required className="input" placeholder="e.g. Acme Plumbing Co" />
            </div>
            <div>
              <label className="label">Date registered</label>
              <input name="dateRegistered" type="date" className="input" />
            </div>
            <div>
              <label className="label">Renewal date</label>
              <input name="renewalDate" type="date" className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label flex flex-wrap items-baseline gap-x-2">
                <span>ASIC key</span>
                <span className="text-xs font-normal text-navy-500 italic">If unknown, leave blank and it will be emailed to you from ASIC.</span>
              </label>
              <input name="asicKey" className="input" placeholder="ASIC key for online services" />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary">Add business name</button>
          </div>
        </form>
      </section>
    </>
  )
}
