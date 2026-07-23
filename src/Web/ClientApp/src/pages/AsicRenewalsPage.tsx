import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Flash } from '../components/Flash'
import {
  getAsicRenewals,
  getBusinessNames,
  startThread,
  type AsicRenewalDto,
  type BusinessNameDto,
} from '../api/generated'

export function AsicRenewalsPage() {
  const [params, setParams] = useSearchParams()
  const [items, setItems] = useState<AsicRenewalDto[]>([])
  const [names, setNames] = useState<BusinessNameDto[]>([])

  const load = useCallback(async () => {
    try { const { data } = await getAsicRenewals(); setItems(data ?? []) } catch { /* ignore */ }
    try { const { data } = await getBusinessNames(); setNames(data ?? []) } catch { /* ignore */ }
  }, [])

  useEffect(() => { void load() }, [load])

  const dueNow = items.filter((i) => Number(i.daysUntil) <= 0)
  const dueIn30 = items.filter((i) => Number(i.daysUntil) > 0 && Number(i.daysUntil) <= 30)
  const overdue = items.filter((i) => Number(i.daysUntil) < 0)

  async function onRequestInfo() {
    try {
      await startThread({
        body: {
          subject: 'ASIC information request — renewals',
          body: 'Please retrieve my upcoming ASIC business name and company review obligations and update my records.',
        },
      })
      setParams({ ok: 'Request sent to support — see Messages for updates' })
    } catch {
      setParams({ err: 'Could not send the request. Try again shortly.' })
    }
  }

  return (
    <>
      <PageHeader
        title="ASIC Renewals"
        subtitle="Notifications for business names and companies that need to be renewed."
        actions={<button onClick={onRequestInfo} className="btn-primary">Request information from ASIC</button>}
      />

      {/* ?ok/?err flashes — renew/cancel redirects and the request-info action. */}
      <Flash ok={params.get('ok')} err={params.get('err')} />

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card-pad">
          <div className="text-xs uppercase tracking-wider text-navy-500">Due Now</div>
          <div className={`mt-2 text-3xl font-bold ${dueNow.length ? 'text-red-700' : 'text-navy-900'}`}>{dueNow.length}</div>
        </div>
        <div className="card-pad">
          <div className="text-xs uppercase tracking-wider text-navy-500">Due in the next 30 days</div>
          <div className={`mt-2 text-3xl font-bold ${dueIn30.length ? 'text-amber-700' : 'text-navy-900'}`}>{dueIn30.length}</div>
        </div>
        <div className="card-pad">
          <div className="text-xs uppercase tracking-wider text-navy-500">Overdue</div>
          <div className={`mt-2 text-3xl font-bold ${overdue.length ? 'text-red-700' : 'text-navy-900'}`}>{overdue.length}</div>
        </div>
      </div>

      {/* Notifications list */}
      <section className="card-pad">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-navy-900">Upcoming &amp; overdue</h3>
          <span className="badge-gray">{items.length} item{items.length === 1 ? '' : 's'}</span>
        </div>

        {items.length === 0 ? (
          <div className="mt-4 rounded-lg bg-accent-50 border border-accent-100 p-4 text-sm text-accent-800">
            ✓ Nothing's due in the next 90 days. We'll let you know when something needs your attention.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {items.map((it, idx) => {
              const badge = it.tone === 'Red' ? 'badge-red' : it.tone === 'Amber' ? 'badge-amber' : 'badge-gray'
              const isBusinessName = it.kind === 'Business Name'
              return (
                <li key={`${it.kind}-${it.sourceId}-${idx}`} className="rounded-lg border border-navy-100 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="text-[11px] uppercase tracking-wider text-navy-500">{it.kind}</span>
                      <span className="font-semibold text-navy-900 truncate">{it.name}</span>
                      <span className="text-navy-400">·</span>
                      <span className="text-navy-700">due {it.dueDate ? new Date(it.dueDate).toLocaleDateString() : '—'}</span>
                      <span className={badge}>{it.label}</span>
                    </div>
                    {it.identifier && it.identifier !== '—' ? (
                      <div className="text-xs text-navy-500 mt-1">{it.identifier}</div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Link to={isBusinessName ? '/business-names' : '/business'} className="btn-secondary">Manage</Link>
                    {isBusinessName ? (
                      <>
                        <Link to={`/asic-renewals/${it.sourceId}/renew`} className="btn-primary">Renew</Link>
                        <Link to={`/asic-renewals/${it.sourceId}/cancel`} className="btn-ghost text-red-700 hover:bg-red-50">Cancel</Link>
                      </>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Tracked items */}
      <section className="card-pad mt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-navy-900">Tracked business names &amp; companies</h3>
          <span className="badge-gray">{names.length} tracked</span>
        </div>

        {names.length === 0 ? (
          <p className="mt-3 text-sm text-navy-500 italic">
            Nothing tracked yet. Add a business name in{' '}
            <Link to="/business-names" className="text-brand-700 font-semibold hover:underline">
              Business Names
            </Link>
            {' '}or fill in your company details (ACN + start date) in{' '}
            <Link to="/business" className="text-brand-700 font-semibold hover:underline">
              Business Details
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-navy-100">
            {names.map((b) => (
              <li key={b.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2 flex-wrap text-sm">
                  <span className="text-[11px] uppercase tracking-wider text-navy-500">Business Name</span>
                  <span className="font-medium text-navy-900 truncate">{b.name}</span>
                  <span className="text-navy-400">·</span>
                  <span className="text-navy-600">{b.asicKey ? `ASIC key ${b.asicKey}` : 'No ASIC key'}</span>
                  <span className="text-navy-400">·</span>
                  <span className="text-navy-600">{b.renewalDate ? `renews ${new Date(b.renewalDate).toLocaleDateString()}` : 'No Renewal Date'}</span>
                </div>
                <Link to="/business-names" className="btn-ghost shrink-0">Edit</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
