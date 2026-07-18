import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import {
  getAsicRenewals,
  getBusinessEntities,
  getBusinessNames,
  getMe,
  getMessageThreads,
  getProfile,
  type AsicRenewalDto,
  type BusinessEntityDto,
  type BusinessNameDto,
  type MeResponse,
  type MessageDto,
  type ProfileModel,
} from '../api/generated'

function EntityTypeBadge({ t }: { t?: string }) {
  if (!t || t === 'Unspecified') return <span className="badge-gray">No type</span>
  const cls =
    t === 'Company' ? 'badge-blue' :
    t === 'Trust' ? 'badge-amber' :
    t === 'Partnership' ? 'badge-green' :
    'badge-gray'
  return <span className={cls}>{t}</span>
}

function CheckRow({ ok, label, href }: { ok: boolean; label: string; href: string }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
          ok ? 'bg-accent-100 text-accent-700' : 'bg-red-100 text-red-700'
        }`}
        aria-hidden="true"
      >
        {ok ? '✓' : '✗'}
      </span>
      {ok ? (
        <span className="text-sm text-navy-700">{label}</span>
      ) : (
        <Link to={href} className="text-sm text-navy-900 font-medium hover:underline">{label}</Link>
      )}
    </li>
  )
}

export function DashboardPage() {
  const [me, setMe] = useState<MeResponse | null>(null)
  const [profile, setProfile] = useState<ProfileModel | null>(null)
  const [entities, setEntities] = useState<BusinessEntityDto[]>([])
  const [businessNames, setBusinessNames] = useState<BusinessNameDto[]>([])
  const [renewals, setRenewals] = useState<AsicRenewalDto[]>([])
  const [messages, setMessages] = useState<MessageDto[]>([])

  useEffect(() => {
    void (async () => {
      const [meR, profR, entR, bnR, asicR, thR] = await Promise.allSettled([
        getMe(), getProfile(), getBusinessEntities(), getBusinessNames(), getAsicRenewals(), getMessageThreads(),
      ])
      if (meR.status === 'fulfilled') setMe(meR.value.data ?? null)
      if (profR.status === 'fulfilled') setProfile(profR.value.data ?? null)
      if (entR.status === 'fulfilled') setEntities(entR.value.data ?? [])
      if (bnR.status === 'fulfilled') setBusinessNames(bnR.value.data ?? [])
      if (asicR.status === 'fulfilled') setRenewals(asicR.value.data ?? [])
      if (thR.status === 'fulfilled') {
        const flat = (thR.value.data ?? []).flatMap((t) => t.messages ?? [])
        flat.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
        setMessages(flat)
      }
    })()
  }, [])

  const profileComplete = !!profile?.firstName && !!profile?.phone && !!profile?.address
  const hasEntityOrBusiness = entities.length > 0
  const overdue = renewals.filter((r) => Number(r.daysUntil) < 0)
  const totalEmployees = entities.reduce((n, e) => n + (e.employees ? Number(e.employees) : 0), 0)
  const industries = Array.from(new Set(entities.map((e) => e.industry).filter((s): s is string => !!s)))
  const allBnRenewalsSet = businessNames.every((b) => !!b.renewalDate)

  const checks = [
    { ok: profileComplete, label: 'Personal details complete', href: '/profile' },
    { ok: hasEntityOrBusiness, label: 'Business details / at least one entity added', href: '/business' },
    { ok: !!me?.atoConnected, label: 'ATO Portal connected', href: '/ato-portal' },
    { ok: overdue.length === 0, label: overdue.length === 0 ? 'No overdue renewals' : `${overdue.length} renewal${overdue.length === 1 ? '' : 's'} overdue`, href: '/asic-renewals' },
    { ok: allBnRenewalsSet, label: allBnRenewalsSet ? 'All business names have renewal dates' : 'Some business names are missing renewal dates', href: '/business-names' },
  ]
  const passed = checks.filter((c) => c.ok).length

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const name = profile?.firstName || me?.email?.split('@')[0] || ''

  const deadlines = renewals.slice(0, 5)

  return (
    <>
      <PageHeader title={`${greeting}, ${name}`} subtitle="Here's a snapshot of your business at a glance." />

      {(!profileComplete || !hasEntityOrBusiness || businessNames.length === 0) && (
        <div className="card-pad mb-6 border-l-4 border-l-amber-400">
          <div className="font-semibold text-navy-900">Finish setting up your portal</div>
          <p className="text-sm text-navy-600 mt-1">
            Complete your personal and business details to unlock the full portal experience.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {!profileComplete && <Link to="/profile" className="btn-primary">Complete personal details</Link>}
            {!hasEntityOrBusiness && <Link to="/business" className="btn-secondary">Add business details</Link>}
            {businessNames.length === 0 && <Link to="/business-names" className="btn-secondary">Add Business Name</Link>}
          </div>
        </div>
      )}

      {/* Quick actions row */}
      <section className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-navy-900">Quick actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link to="/business-names" className="btn-secondary justify-center">+ Business name</Link>
          <Link to="/business" className="btn-secondary justify-center">+ Entity</Link>
          <Link to="/messages" className="btn-secondary justify-center">✉ Message support</Link>
        </div>
      </section>

      {/* Compliance health + Business overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <section className="card-pad">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-navy-900">Compliance health</h2>
            <span className={passed === 5 ? 'badge-green' : passed >= 3 ? 'badge-amber' : 'badge-red'}>{passed}/5 green</span>
          </div>
          <ul className="mt-2 divide-y divide-navy-100">
            {checks.map((c, i) => (
              <CheckRow key={i} ok={c.ok} label={c.label} href={c.href} />
            ))}
          </ul>
        </section>

        <section className="card-pad">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-navy-900">Business Overview</h2>
            <span className="badge-gray">{entities.length} {entities.length === 1 ? 'entity' : 'entities'}</span>
          </div>

          {entities.length === 0 ? (
            <div className="mt-4">
              <p className="text-sm text-navy-500">
                No entities added yet. Add the businesses you operate to track ABNs, ACNs,
                industries and renewal obligations in one place.
              </p>
              <div className="mt-3">
                <Link to="/business" className="btn-primary">+ Add an entity</Link>
              </div>
            </div>
          ) : (
            <>
              <ul className="mt-3 divide-y divide-navy-100">
                {entities.map((e) => (
                  <li key={e.id} className="py-2 flex items-center gap-2 flex-wrap text-sm">
                    <span className="font-semibold text-navy-900 truncate">{e.name}</span>
                    <EntityTypeBadge t={e.entityType} />
                    {e.abn ? (<><span className="text-navy-400">·</span><span className="text-navy-600">ABN {e.abn}</span></>) : null}
                    {e.acn ? (<><span className="text-navy-400">·</span><span className="text-navy-600">ACN {e.acn}</span></>) : null}
                    {e.industry ? (<><span className="text-navy-400">·</span><span className="text-navy-600">{e.industry}</span></>) : null}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center justify-between flex-wrap gap-2 text-xs text-navy-500">
                <div>
                  Total employees: <span className="font-semibold text-navy-900">{totalEmployees}</span>
                  {industries.length > 0 ? (<>{' · '}Industries: <span className="text-navy-700">{industries.join(', ')}</span></>) : null}
                </div>
                <Link to="/business" className="text-brand-700 font-semibold hover:underline">Manage entities →</Link>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Upcoming deadlines */}
      <section className="card-pad mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-900">Upcoming deadlines</h2>
          <span className="badge-gray">{renewals.length} {renewals.length === 1 ? 'item' : 'items'}</span>
        </div>

        {deadlines.length === 0 ? (
          <div className="mt-3 rounded-lg bg-accent-50 border border-accent-100 p-3 text-sm text-accent-800">
            ✓ Nothing's due in the next 90 days. We'll let you know when something needs your attention.
          </div>
        ) : (
          <>
            <ul className="mt-2 divide-y divide-navy-100">
              {deadlines.map((d, idx) => {
                const badge = d.tone === 'Red' ? 'badge-red' : d.tone === 'Amber' ? 'badge-amber' : 'badge-gray'
                const isBusinessName = d.kind === 'Business Name'
                return (
                  <li key={`${d.kind}-${d.sourceId}-${idx}`} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap text-sm">
                      <span className="text-navy-600 shrink-0">{d.dueDate ? new Date(d.dueDate).toLocaleDateString() : ''}</span>
                      <span className="text-navy-400">·</span>
                      <span className="font-semibold text-navy-900 truncate">{d.name}</span>
                      <span className="text-[11px] uppercase tracking-wider text-navy-500">({d.kind})</span>
                      <span className={badge}>{d.label}</span>
                    </div>
                    <div className="shrink-0">
                      {isBusinessName ? (
                        <Link to={`/asic-renewals/${d.sourceId}/renew`} className="btn-ghost text-xs px-2 py-1">Renew</Link>
                      ) : (
                        <Link to="/asic-renewals" className="btn-ghost text-xs px-2 py-1">Manage</Link>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className="mt-3 text-right">
              <Link to="/asic-renewals" className="text-sm font-semibold text-brand-700 hover:underline">View all →</Link>
            </div>
          </>
        )}
      </section>

      <h2 className="mt-10 mb-4 text-lg font-semibold text-navy-900">Latest messages</h2>
      <div className="card-pad">
        {messages.length === 0 ? (
          <p className="text-sm text-navy-500">No messages yet.</p>
        ) : (
          <ul className="divide-y divide-navy-100">
            {messages.slice(0, 3).map((m) => (
              <li key={m.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to={`/messages#thread-${m.threadId ?? m.id}`}
                      className="font-medium text-navy-900 truncate block hover:text-brand-700 hover:underline"
                    >
                      {m.subject}
                    </Link>
                    <div className="text-sm text-navy-500 truncate">{m.body}</div>
                  </div>
                  {!m.read && m.direction === 'Inbound' ? <span className="badge-blue">New</span> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 text-right">
          <Link to="/messages" className="text-sm font-semibold text-brand-700 hover:underline">View all messages →</Link>
        </div>
      </div>
    </>
  )
}
