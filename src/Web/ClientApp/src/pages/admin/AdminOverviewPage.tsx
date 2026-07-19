import { useEffect, useState } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { getAdminOverview, type AdminOverviewResponse } from '../../api/generated'

export function AdminOverviewPage() {
  const [s, setS] = useState<AdminOverviewResponse | null>(null)

  useEffect(() => {
    void getAdminOverview().then((r) => setS(r.data ?? null)).catch(() => {})
  }, [])

  const cards: Array<[string, string | number | undefined]> = [
    ['Clients', s?.clients],
    ['Active threads', s?.activeThreads],
    ['Unread messages', s?.unreadMessages],
    ['Renewals due (30d)', s?.renewalsDue],
  ]

  return (
    <>
      <PageHeader title="Overview" subtitle="Portal activity at a glance." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(([label, val]) => (
          <div key={label} className="card-pad">
            <div className="text-xs uppercase tracking-wider text-navy-500">{label}</div>
            <div className="mt-2 text-3xl font-bold text-navy-900">{val ?? '—'}</div>
          </div>
        ))}
      </div>
    </>
  )
}
