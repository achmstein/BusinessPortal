import { useEffect, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Flash } from '../components/Flash'
import { RenewTermSelector, type RenewTerm } from '../components/RenewTermSelector'
import { useAuth } from '../auth/AuthContext'
import { getBusinessNames, type BusinessNameDto } from '../api/generated'

const TERMS: Record<RenewTerm, { years: number; price: number; iframeUrl: string }> = {
  // Ontraport order forms. Both pages allow iframing (no X-Frame-Options
  // or frame-ancestors CSP — verified 2026-06-30).
  // bnId, email, and years are appended as URL params so the Ontraport rule
  // can stash them on the contact/transaction and our renewal-paid webhook
  // reads them back when the payment succeeds.
  '1': { years: 1, price: 99, iframeUrl: 'https://idealbusiness.au/portalpayment' },
  '3': { years: 3, price: 199, iframeUrl: 'https://idealbusiness.au/portalrenewal3' },
}

// Markup ported verbatim from the original app/(portal)/asic-renewals/[bnId]/renew/page.tsx.
export function RenewBusinessNamePage() {
  const { bnId } = useParams<{ bnId: string }>()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const [names, setNames] = useState<BusinessNameDto[] | null>(null)

  useEffect(() => {
    getBusinessNames()
      .then(({ data }) => setNames(data ?? []))
      .catch(() => setNames([]))
  }, [])

  if (!names || !user) return null
  const bn = names.find((b) => b.id === bnId)
  if (!bn) return <Navigate to="/asic-renewals" replace />

  const selectedTerm: RenewTerm = params.get('term') === '3' ? '3' : '1'
  const t = TERMS[selectedTerm]

  // Pass identifying data through to Ontraport so the renewal-paid webhook
  // knows which business name to bump when the order completes.
  const iframeUrl =
    `${t.iframeUrl}?bnId=${encodeURIComponent(bn.id ?? '')}` +
    `&email=${encodeURIComponent(user.email ?? '')}` +
    `&years=${t.years}` +
    `&firstname=${encodeURIComponent(user.firstName || '')}` +
    `&lastname=${encodeURIComponent(user.lastName || '')}`

  return (
    <>
      <div className="mb-2">
        <Link to="/asic-renewals" className="text-sm text-brand-700 hover:underline">← ASIC Renewals</Link>
      </div>
      <PageHeader title="Renew business name" subtitle={bn.name ?? ''} />
      <Flash ok={params.get('ok')} err={params.get('err')} />

      {/* Summary */}
      <div className="card-pad mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Business name" value={bn.name ?? ''} />
          <Field label="Current renewal" value={bn.renewalDate ? new Date(bn.renewalDate).toLocaleDateString() : '—'} />
          <Field label="ASIC key" value={bn.asicKey || '—'} />
        </div>
      </div>

      {/* Term selector — auto-updates the URL (?term=…) on radio change */}
      <RenewTermSelector bnId={bn.id ?? ''} selected={selectedTerm} />

      {/* Total */}
      <div className="card-pad mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-navy-900">Payment</h3>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-navy-500">
            Total — {t.years} year{t.years > 1 ? 's' : ''}
          </div>
          <div className="text-2xl font-bold text-navy-900">${t.price}</div>
        </div>
      </div>

      {/* Iframed Ontraport order form */}
      <div className="card-pad p-0 overflow-hidden">
        <iframe
          key={selectedTerm} // remount on term change so the URL refreshes
          src={iframeUrl}
          title={`Pay $${t.price} — ${t.years} year renewal`}
          className="w-full bg-white"
          style={{ minHeight: 900, border: 0 }}
          loading="lazy"
        />
      </div>

      <p className="mt-4 text-xs text-navy-500 text-center">
        Your renewal date will update automatically once payment is confirmed —
        usually within a minute. You&apos;ll also get a confirmation message in your{' '}
        <Link to="/messages" className="underline">Messages</Link> inbox.
      </p>
    </>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-navy-500">{label}</div>
      <div className="text-sm font-semibold text-navy-900 truncate">{value}</div>
    </div>
  )
}
