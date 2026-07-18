import { useEffect, useState, type FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import {
  createBusinessEntity,
  deleteBusinessEntity,
  getBusinessEntities,
  type BusinessEntityDto,
  type EntityType,
} from '../api/generated'

const ENTITY_TYPES: EntityType[] = ['Unspecified', 'SoleTrader', 'Partnership', 'Company', 'Trust']

export function BusinessPage() {
  const [entities, setEntities] = useState<BusinessEntityDto[]>([])
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      const { data } = await getBusinessEntities()
      setEntities(data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function onAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    await createBusinessEntity({
      body: {
        name: String(f.get('name') || ''),
        entityType: String(f.get('entityType') || 'Unspecified') as EntityType,
        abn: String(f.get('abn') || ''),
        acn: String(f.get('acn') || ''),
        industry: String(f.get('industry') || ''),
        employees: Number(f.get('employees') || 0),
        phone: String(f.get('phone') || ''),
        website: String(f.get('website') || ''),
      },
    })
    form.reset()
    await load()
  }

  async function onDelete(id: string) {
    await deleteBusinessEntity({ path: { id } })
    await load()
  }

  return (
    <>
      <PageHeader title="Business Details" subtitle="Your entities and businesses." />

      {error ? <div className="mb-4 badge-red">{error}</div> : null}

      {/* List-first UX pattern (matches the original). */}
      <div className="space-y-2 mb-6">
        {entities.length === 0 ? (
          <p className="text-sm text-navy-500">No entities yet — add one below.</p>
        ) : (
          entities.map((e) => (
            <div key={e.id} className="card-pad flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="font-medium text-navy-900">{e.name}</span>
                <span className="badge-gray">{e.entityType}</span>
                {e.abn ? <span className="text-navy-500">· ABN {e.abn}</span> : null}
                {e.industry ? <span className="text-navy-500">· {e.industry}</span> : null}
              </div>
              <button onClick={() => e.id && onDelete(e.id)} className="btn-ghost text-sm">Remove</button>
            </div>
          ))
        )}
      </div>

      <form onSubmit={onAdd} className="card-pad space-y-4">
        <h2 className="font-semibold text-navy-900">Add entity</h2>
        <div className="form-grid">
          <div>
            <label className="label">Entity Name</label>
            <input name="name" required className="input" />
          </div>
          <div>
            <label className="label">Entity type</label>
            <select name="entityType" className="input" defaultValue="Unspecified">
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">ABN</label>
            <input name="abn" className="input" />
          </div>
          <div>
            <label className="label">ACN</label>
            <input name="acn" className="input" />
          </div>
          <div>
            <label className="label">Industry</label>
            <input name="industry" className="input" />
          </div>
          <div>
            <label className="label">Employees</label>
            <input name="employees" type="number" min="0" className="input" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="phone" className="input" />
          </div>
          <div>
            <label className="label">Website</label>
            <input name="website" className="input" />
          </div>
        </div>
        <button className="btn-primary">Add entity</button>
      </form>
    </>
  )
}
