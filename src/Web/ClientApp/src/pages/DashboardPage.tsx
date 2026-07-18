import { useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { api, type BusinessEntity, type Me } from '../lib/api'

export function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [entities, setEntities] = useState<BusinessEntity[]>([])

  useEffect(() => {
    void api.me().then(setMe).catch(() => {})
    void api.businessEntities().then(setEntities).catch(() => {})
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      <PageHeader
        title={`${greeting}${me?.firstName ? ', ' + me.firstName : ''}`}
        subtitle="Here's your business portal overview."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card-pad">
          <h2 className="font-semibold text-navy-900">Business Overview</h2>
          {entities.length === 0 ? (
            <p className="mt-2 text-sm text-navy-500">No businesses yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {entities.map((e) => (
                <li key={e.id} className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="font-medium text-navy-900">{e.name}</span>
                  <span className="badge-gray">{e.entityType}</span>
                  {e.abn ? <span className="text-navy-500">· ABN {e.abn}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-pad">
          <h2 className="font-semibold text-navy-900">Account</h2>
          <p className="mt-2 text-sm text-navy-500">{me?.email}</p>
          {me?.isAdmin ? <span className="badge-blue mt-3">Admin</span> : null}
        </div>
      </div>
    </>
  )
}
