import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import {
  getAdminRegistry,
  type AdminRegistryResponse,
  type RegistryBusinessNameRow,
  type RegistryCompanyRow,
  type RegistryEntityRow,
} from '../../api/generated'

// Markup ported verbatim from the original app/admin/registry/page.tsx.
// The server-side flatten lives in GET /api/admin/registry; the ?q= search
// filters the fetched rows with the same haystack matching.
export function AdminRegistryPage() {
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<AdminRegistryResponse | null>(null)
  const q = (params.get('q') || '').trim().toLowerCase()

  useEffect(() => {
    getAdminRegistry()
      .then(({ data }) => setData(data ?? null))
      .catch(() => setData(null))
  }, [])

  function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const next = String(new FormData(e.currentTarget).get('q') || '').trim()
    setParams(next ? { q: next } : {})
  }

  function matches(haystack: (string | null | undefined)[]): boolean {
    if (!q) return true
    return haystack.map((h) => h || '').join(' ').toLowerCase().includes(q)
  }

  const allBusinessNames = data?.businessNames ?? []
  const allEntities = data?.entities ?? []
  const allCompanies = data?.companies ?? []

  const businessNameRows = allBusinessNames.filter((r: RegistryBusinessNameRow) =>
    matches([r.name, r.asicKey, r.client?.name, r.client?.email])
  )
  const entityRows = allEntities.filter((r: RegistryEntityRow) =>
    matches([r.name, r.abn, r.acn, r.industry, r.client?.name, r.client?.email])
  )
  const companyRows = allCompanies.filter((r: RegistryCompanyRow) =>
    matches([r.name, r.acn, r.abn, r.client?.name, r.client?.email])
  )

  return (
    <>
      <PageHeader
        title="Registry"
        subtitle="Every business name, entity and company across all clients."
      />

      {/* Search */}
      <form onSubmit={onSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search any name, ABN, ACN, ASIC key, client name or email…"
            className="input flex-1"
          />
          <button type="submit" className="btn-primary">Search</button>
          {q ? <Link to="/admin/registry" className="btn-secondary">Clear</Link> : null}
        </div>
      </form>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Counter label="Clients" value={Number(data?.clients ?? 0)} href="/admin/clients" />
        <Counter label="Business names" value={allBusinessNames.length} />
        <Counter label="Entities" value={allEntities.length} />
        <Counter label="Companies" value={allCompanies.length} />
      </div>

      {/* All business names */}
      <section className="card-pad mb-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-navy-900">All business names</h3>
          <span className="badge-gray">{businessNameRows.length}</span>
        </div>

        {businessNameRows.length === 0 ? (
          <p className="mt-3 text-sm text-navy-500 italic">
            {q ? 'No matches.' : 'No business names registered yet.'}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-navy-500 border-b border-navy-100">
                <tr>
                  <th className="py-2 pr-4">Business name</th>
                  <th className="py-2 pr-4">Client</th>
                  <th className="py-2 pr-4">ASIC key</th>
                  <th className="py-2 pr-4">Registered</th>
                  <th className="py-2 pr-4">Renews</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {businessNameRows.map((r) => (
                  <tr key={`${r.client?.id}-${r.id}`}>
                    <td className="py-2.5 pr-4 font-medium text-navy-900">{r.name}</td>
                    <td className="py-2.5 pr-4">
                      <Link to={`/admin/clients/${r.client?.id}`} className="text-brand-700 hover:underline">
                        {r.client?.name}
                      </Link>
                      <div className="text-xs text-navy-500">{r.client?.email}</div>
                    </td>
                    <td className="py-2.5 pr-4">{r.asicKey || '—'}</td>
                    <td className="py-2.5 pr-4 text-navy-600">
                      {r.dateRegistered ? new Date(r.dateRegistered).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-navy-600">
                      {r.renewalDate ? new Date(r.renewalDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-2.5 pr-4">{renewalBadge(r.renewalDate ?? '')}</td>
                    <td className="py-2.5 pr-4 text-right">
                      <Link to={`/admin/clients/${r.client?.id}`} className="btn-ghost">Open client</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* All entities */}
      <section className="card-pad mb-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-navy-900">All entities</h3>
          <span className="badge-gray">{entityRows.length}</span>
        </div>

        {entityRows.length === 0 ? (
          <p className="mt-3 text-sm text-navy-500 italic">
            {q ? 'No matches.' : 'No entities added by clients yet.'}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-navy-500 border-b border-navy-100">
                <tr>
                  <th className="py-2 pr-4">Entity name</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">ABN</th>
                  <th className="py-2 pr-4">ACN</th>
                  <th className="py-2 pr-4">Industry</th>
                  <th className="py-2 pr-4">Client</th>
                  <th className="py-2 pr-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {entityRows.map((r) => (
                  <tr key={`${r.client?.id}-${r.id}`}>
                    <td className="py-2.5 pr-4 font-medium text-navy-900">{r.name}</td>
                    <td className="py-2.5 pr-4">
                      {r.entityType ? <span className="badge-blue">{r.entityType}</span> : <span className="badge-gray">—</span>}
                    </td>
                    <td className="py-2.5 pr-4">{r.abn || '—'}</td>
                    <td className="py-2.5 pr-4">{r.acn || '—'}</td>
                    <td className="py-2.5 pr-4">{r.industry || '—'}</td>
                    <td className="py-2.5 pr-4">
                      <Link to={`/admin/clients/${r.client?.id}`} className="text-brand-700 hover:underline">
                        {r.client?.name}
                      </Link>
                      <div className="text-xs text-navy-500">{r.client?.email}</div>
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <Link to={`/admin/clients/${r.client?.id}`} className="btn-ghost">Open client</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* All companies (ACN holders) */}
      <section className="card-pad mb-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-navy-900">All companies &amp; trusts (with ACN)</h3>
          <span className="badge-gray">{companyRows.length}</span>
        </div>

        {companyRows.length === 0 ? (
          <p className="mt-3 text-sm text-navy-500 italic">
            {q ? 'No matches.' : 'No companies or trusts on record.'}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-navy-500 border-b border-navy-100">
                <tr>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">ACN</th>
                  <th className="py-2 pr-4">ABN</th>
                  <th className="py-2 pr-4">Source</th>
                  <th className="py-2 pr-4">Start date</th>
                  <th className="py-2 pr-4">Client</th>
                  <th className="py-2 pr-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {companyRows.map((r, idx) => (
                  <tr key={`${r.client?.id}-${r.acn || r.name}-${idx}`}>
                    <td className="py-2.5 pr-4 font-medium text-navy-900">{r.name}</td>
                    <td className="py-2.5 pr-4">{r.acn || '—'}</td>
                    <td className="py-2.5 pr-4">{r.abn || '—'}</td>
                    <td className="py-2.5 pr-4 text-navy-600">{r.source}</td>
                    <td className="py-2.5 pr-4 text-navy-600">—</td>
                    <td className="py-2.5 pr-4">
                      <Link to={`/admin/clients/${r.client?.id}`} className="text-brand-700 hover:underline">
                        {r.client?.name}
                      </Link>
                      <div className="text-xs text-navy-500">{r.client?.email}</div>
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <Link to={`/admin/clients/${r.client?.id}`} className="btn-ghost">Open client</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function renewalBadge(iso: string) {
  if (!iso) return <span className="badge-gray">No date</span>
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < 0) return <span className="badge-red">Overdue · {Math.abs(days)}d</span>
  if (days <= 30) return <span className="badge-amber">Due in {days}d</span>
  if (days <= 90) return <span className="badge-amber">{days}d</span>
  return <span className="badge-green">OK</span>
}

function Counter({ label, value, href }: { label: string; value: number; href?: string }) {
  const inner: ReactNode = (
    <>
      <div className="text-[11px] uppercase tracking-wider text-navy-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-navy-900">{value}</div>
    </>
  )
  return href ? (
    <Link to={href} className="card-pad hover:shadow-soft transition">{inner}</Link>
  ) : (
    <div className="card-pad">{inner}</div>
  )
}
