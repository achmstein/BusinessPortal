import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Flash } from '../components/Flash'
import { cancelBusinessName, getBusinessNames, type BusinessNameDto } from '../api/generated'

const CANCEL_FEE = 29
type Scope = 'name' | 'name_and_abn'

// Markup ported verbatim from the original app/(portal)/asic-renewals/[bnId]/cancel/page.tsx.
// The processCancellation server action becomes POST /api/business-names/{id}/cancel.
export function CancelBusinessNamePage() {
  const { bnId } = useParams<{ bnId: string }>()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [names, setNames] = useState<BusinessNameDto[] | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getBusinessNames()
      .then(({ data }) => setNames(data ?? []))
      .catch(() => setNames([]))
  }, [])

  if (!names) return null
  const bn = names.find((b) => b.id === bnId)
  if (!bn) return <Navigate to="/asic-renewals" replace />

  const selectedScope: Scope = params.get('scope') === 'name_and_abn' ? 'name_and_abn' : 'name'

  // GET form in the original — reflect the radio choice into ?scope= so the
  // payment form below picks it up.
  function onUpdateScope(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const scope = String(new FormData(e.currentTarget).get('scope') || 'name')
    setParams({ scope })
  }

  async function onPay(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const cardName = String(form.get('cardName') || '').trim()
    const cardNumber = String(form.get('cardNumber') || '').replace(/\s+/g, '')
    const expiry = String(form.get('expiry') || '').trim()
    const ccv = String(form.get('ccv') || '').trim()

    if (!cardName || cardNumber.length < 12 || !expiry || ccv.length < 3) {
      setParams({ scope: selectedScope, err: 'Please complete all card fields' })
      return
    }

    setSubmitting(true)
    try {
      await cancelBusinessName({
        path: { id: bn!.id! },
        body: { scope: selectedScope, cardName, cardNumber, expiry, ccv },
      })
      navigate('/asic-renewals?ok=Cancelled+business+name')
    } catch (e) {
      const message = (e as { error?: string })?.error
      setParams({ scope: selectedScope, err: message || 'Could not cancel the business name' })
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="mb-2">
        <Link to="/asic-renewals" className="text-sm text-brand-700 hover:underline">← ASIC Renewals</Link>
      </div>
      <PageHeader
        title="Cancel business name"
        subtitle={bn.name ?? ''}
      />
      <Flash ok={params.get('ok')} err={params.get('err')} />

      <div className="card-pad border-l-4 border-l-red-400 mb-6">
        <h3 className="font-semibold text-red-800">This action cannot be undone</h3>
        <p className="text-sm text-navy-700 mt-1">
          Once cancelled, the business name can't be used to trade under. If you want to
          keep using the name later you'll have to register it again from scratch.
        </p>
      </div>

      {/* Scope selector — GET form so the page reflects choice; payment form below picks it up via hidden input */}
      <form onSubmit={onUpdateScope} className="card-pad mb-6">
        <h3 className="font-semibold text-navy-900">What would you like to cancel?</h3>
        <div className="mt-4 space-y-3">
          <ScopeOption
            value="name"
            title="Just the business name"
            desc="Cancel only the business name registration. The associated ABN (if any) stays active."
            selected={selectedScope === 'name'}
          />
          <ScopeOption
            value="name_and_abn"
            title="The business name AND the ABN"
            desc="Cancel the business name and also send an ABN cancellation request to the ATO."
            selected={selectedScope === 'name_and_abn'}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <button type="submit" className="btn-secondary">Update selection</button>
        </div>
      </form>

      {/* Payment */}
      <form onSubmit={onPay} className="card-pad space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-navy-900">Payment</h3>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-navy-500">Cancellation fee</div>
            <div className="text-2xl font-bold text-navy-900">${CANCEL_FEE}</div>
          </div>
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3 py-2">
          Demo form — no real card is charged. Replace with your payment processor when wiring this up.
        </div>

        <div className="form-grid">
          <div className="sm:col-span-2">
            <label className="label">Name on card</label>
            <input name="cardName" required className="input" placeholder="As it appears on the card" autoComplete="cc-name" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Card number</label>
            <input name="cardNumber" required inputMode="numeric" className="input font-mono" placeholder="•••• •••• •••• ••••" autoComplete="cc-number" />
          </div>
          <div>
            <label className="label">Expiry (MM/YY)</label>
            <input name="expiry" required className="input" placeholder="MM/YY" autoComplete="cc-exp" />
          </div>
          <div>
            <label className="label">CCV</label>
            <input name="ccv" required inputMode="numeric" maxLength={4} className="input" placeholder="•••" autoComplete="cc-csc" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
          <Link to="/asic-renewals" className="btn-secondary">Don't cancel</Link>
          <button type="submit" disabled={submitting} className="btn-danger">
            {submitting ? 'Processing…' : `Pay $${CANCEL_FEE} and confirm cancellation`}
          </button>
        </div>
      </form>
    </>
  )
}

function ScopeOption({
  value,
  title,
  desc,
  selected,
}: {
  value: Scope
  title: string
  desc: string
  selected: boolean
}) {
  return (
    <label
      className={`block rounded-lg border p-4 cursor-pointer transition ${
        selected
          ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
          : 'border-navy-200 hover:border-navy-300 bg-white'
      }`}
    >
      <div className="flex items-start gap-3">
        <input type="radio" name="scope" value={value} defaultChecked={selected} className="mt-1 h-4 w-4" />
        <div className="flex-1">
          <div className="font-semibold text-navy-900">{title}</div>
          <div className="text-sm text-navy-600 mt-1">{desc}</div>
        </div>
      </div>
    </label>
  )
}
