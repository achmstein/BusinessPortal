import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { getAdminClient, startImpersonation } from '../../api/generated'

interface Profile { firstName: string; lastName: string; phone: string; dob: string; tfn: string; address: string; suburb: string; state: string; postcode: string }
interface Entity { id: string; name: string; entityType: string; abn: string; acn: string; industry: string }
interface BName { id: string; name: string; renewalDate: string; asicKey: string }
interface Detail { id: string; email: string; atoConnected: boolean; profile: Profile; entities: Entity[]; businessNames: BName[] }

export function AdminClientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [d, setD] = useState<Detail | null>(null)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (id) void getAdminClient({ path: { id } }).then((r) => setD((r.data as Detail) ?? null)).catch(() => setErr('Client not found'))
  }, [id])

  async function onImpersonate() {
    if (!id) return
    try {
      await startImpersonation({ path: { id }, body: { reason } })
      navigate('/dashboard')
    } catch {
      setErr('Could not start impersonation.')
    }
  }

  if (err) return <div className="text-navy-500">{err}</div>
  if (!d) return <div className="text-navy-500">Loading…</div>

  const p = d.profile
  return (
    <>
      <PageHeader title={`${p.firstName} ${p.lastName}`.trim() || d.email} subtitle={d.email} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card-pad">
          <h3 className="font-semibold text-navy-900 mb-3">Personal details</h3>
          <div className="text-sm space-y-1 text-navy-700">
            <div>Phone: {p.phone || '—'}</div>
            <div>DOB: {p.dob || '—'}</div>
            <div>TFN: {p.tfn || '—'}</div>
            <div>Address: {[p.address, p.suburb, p.state, p.postcode].filter(Boolean).join(', ') || '—'}</div>
            <div>ATO: {d.atoConnected ? 'Connected' : '—'}</div>
          </div>
        </section>

        <section className="card-pad">
          <h3 className="font-semibold text-navy-900 mb-3">Business names ({d.businessNames.length})</h3>
          <ul className="text-sm divide-y divide-navy-100">
            {d.businessNames.map((b) => (
              <li key={b.id} className="py-2 flex items-center gap-2 flex-wrap">
                <span className="font-medium text-navy-900">{b.name}</span>
                {b.renewalDate ? <span className="text-navy-500">· renews {b.renewalDate}</span> : null}
              </li>
            ))}
            {d.businessNames.length === 0 ? <li className="py-2 text-navy-500">None.</li> : null}
          </ul>
        </section>

        <section className="card-pad lg:col-span-2">
          <h3 className="font-semibold text-navy-900 mb-3">Entities ({d.entities.length})</h3>
          <ul className="text-sm divide-y divide-navy-100">
            {d.entities.map((e) => (
              <li key={e.id} className="py-2 flex items-center gap-2 flex-wrap">
                <span className="font-medium text-navy-900">{e.name}</span>
                <span className="badge-gray">{e.entityType}</span>
                {e.abn ? <span className="text-navy-500">· ABN {e.abn}</span> : null}
                {e.industry ? <span className="text-navy-500">· {e.industry}</span> : null}
              </li>
            ))}
            {d.entities.length === 0 ? <li className="py-2 text-navy-500">None.</li> : null}
          </ul>
        </section>

        <section className="card-pad lg:col-span-2 border-red-100">
          <h3 className="font-semibold text-navy-900 mb-1">Impersonate this client</h3>
          <p className="text-sm text-navy-500 mb-3">
            Act as this client with full read/write access. An audit row is recorded; use "Return to admin" to exit.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="input flex-1" />
            <button onClick={onImpersonate} className="btn-danger">Impersonate</button>
          </div>
        </section>
      </div>
    </>
  )
}
