import { useEffect, useState, type FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import { getMe, getProfile, updateProfile, type ProfileModel } from '../api/generated'

const EMPTY: ProfileModel = {
  firstName: '', lastName: '', phone: '', dob: '', tfn: '',
  address: '', suburb: '', state: '', postcode: '',
}

const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']

export function ProfilePage() {
  const [p, setP] = useState<ProfileModel>(EMPTY)
  const [email, setEmail] = useState('')
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => {
    void getProfile().then((r) => r.data && setP({ ...EMPTY, ...r.data })).catch(() => {})
    void getMe().then((r) => setEmail(r.data?.email ?? '')).catch(() => {})
  }, [])

  function set<K extends keyof ProfileModel>(key: K, value: string) {
    setP((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    await updateProfile({ body: p })
    setFlash('Personal details saved')
  }

  return (
    <>
      <PageHeader title="Personal Details" subtitle="Keep your contact and tax details up to date." />

      {flash ? (
        <div className="mb-4 rounded-lg border border-accent-200 bg-accent-50 text-accent-800 text-sm px-4 py-2.5">{flash}</div>
      ) : null}

      <form onSubmit={onSubmit} className="card-pad space-y-6">
        <div>
          <h3 className="font-semibold text-navy-900 mb-3">About you</h3>
          <div className="form-grid">
            <div>
              <label className="label">First name</label>
              <input value={p.firstName ?? ''} onChange={(e) => set('firstName', e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">Last name</label>
              <input value={p.lastName ?? ''} onChange={(e) => set('lastName', e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">Email</label>
              <input value={email} type="email" className="input" disabled />
            </div>
            <div>
              <label className="label">Phone</label>
              <input value={p.phone ?? ''} onChange={(e) => set('phone', e.target.value)} className="input" placeholder="04xx xxx xxx" />
            </div>
            <div>
              <label className="label">Date of birth</label>
              <input value={p.dob ?? ''} onChange={(e) => set('dob', e.target.value)} type="date" className="input" />
            </div>
            <div>
              <label className="label">Tax File Number (TFN)</label>
              <input value={p.tfn ?? ''} onChange={(e) => set('tfn', e.target.value)} className="input" placeholder="9 digits" />
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-navy-900 mb-3">Postal address</h3>
          <div className="form-grid">
            <div className="sm:col-span-2">
              <label className="label">Street address</label>
              <input value={p.address ?? ''} onChange={(e) => set('address', e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Suburb</label>
              <input value={p.suburb ?? ''} onChange={(e) => set('suburb', e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">State</label>
              <select value={p.state ?? ''} onChange={(e) => set('state', e.target.value)} className="input">
                <option value="">Select…</option>
                {STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Postcode</label>
              <input value={p.postcode ?? ''} onChange={(e) => set('postcode', e.target.value)} className="input" />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary">Save changes</button>
        </div>
      </form>
    </>
  )
}
