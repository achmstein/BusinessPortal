import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { getAdminClients } from '../../api/generated'

interface Client {
  id: string
  email: string
  firstName: string
  lastName: string
  atoConnected: boolean
  createdAt: string
}

export function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    void getAdminClients().then((r) => setClients((r.data as Client[]) ?? [])).catch(() => {})
  }, [])

  const filtered = useMemo(
    () => clients.filter((c) => `${c.email} ${c.firstName} ${c.lastName}`.toLowerCase().includes(q.toLowerCase())),
    [clients, q],
  )

  return (
    <>
      <PageHeader title="Clients" subtitle="All portal accounts." />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" className="input mb-4 max-w-md" />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-navy-500 border-b border-navy-100">
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">ATO</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-navy-50">
                <td className="p-3 font-medium text-navy-900">{`${c.firstName} ${c.lastName}`.trim() || '—'}</td>
                <td className="p-3 text-navy-600">{c.email}</td>
                <td className="p-3">{c.atoConnected ? <span className="badge-green">Connected</span> : <span className="badge-gray">—</span>}</td>
                <td className="p-3 text-right">
                  <Link to={`/admin/clients/${c.id}`} className="text-brand-700 font-semibold hover:underline">View →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
