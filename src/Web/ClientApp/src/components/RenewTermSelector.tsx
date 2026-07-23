import { useTransition } from 'react'
import { useNavigate } from 'react-router-dom'

// Ported verbatim from the original components/renew-term-selector.tsx —
// radio cards that push ?term= onto the renew page URL.
export type RenewTerm = '1' | '3'

type Option = {
  value: RenewTerm
  title: string
  price: string
  badge?: string
}

const OPTIONS: Option[] = [
  { value: '1', title: '1 year', price: '$99' },
  { value: '3', title: '3 years', price: '$199', badge: 'Best value — save $98' },
]

export function RenewTermSelector({ bnId, selected }: { bnId: string; selected: RenewTerm }) {
  const navigate = useNavigate()
  const [isPending, startTransition] = useTransition()

  function pick(next: RenewTerm) {
    if (next === selected) return
    startTransition(() => {
      navigate(`/asic-renewals/${bnId}/renew?term=${next}`)
    })
  }

  return (
    <div className="card-pad mb-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-navy-900">Select renewal term</h3>
        {isPending ? (
          <span className="text-xs text-navy-500">Updating…</span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {OPTIONS.map((o) => {
          const isSelected = o.value === selected
          return (
            <label
              key={o.value}
              className={`block rounded-lg border p-4 cursor-pointer transition ${
                isSelected
                  ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200'
                  : 'border-navy-200 hover:border-navy-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="term"
                    value={o.value}
                    checked={isSelected}
                    onChange={() => pick(o.value)}
                    className="h-4 w-4"
                  />
                  <span className="font-semibold text-navy-900">{o.title}</span>
                </div>
                <span className="text-lg font-bold text-navy-900">{o.price}</span>
              </div>
              {o.badge ? (
                <div className="mt-2 text-xs text-accent-700 font-medium">{o.badge}</div>
              ) : null}
            </label>
          )
        })}
      </div>
    </div>
  )
}
