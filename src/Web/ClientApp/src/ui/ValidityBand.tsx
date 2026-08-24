import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/dates'
import { termProgress, type RenewalStatus } from '@/lib/renewal'

// ─────────────────────────────────────────────────────────────────────────────
// The validity band — the Registry signature.
//
// A business name is a legal registration with a term and an expiry, the same
// shape as a certificate's period of validity. So we draw that term literally:
// registered date, today's position, renewal date, on one hairline. It replaces
// the stat card, and it carries four facts in the space a progress bar spends
// on one.
//
// Colour is load-bearing, never decorative: a registration with time left draws
// in sage, brass appears inside the renewal window, rust once the date passes.
// ─────────────────────────────────────────────────────────────────────────────

const TONE = {
  ok: 'text-sage',
  due: 'text-brass-600',
  overdue: 'text-rust-600',
  dormant: 'text-sage/60',
  unknown: 'text-sage/60',
} as const

interface ValidityBandProps {
  registeredDate: string | null | undefined
  renewalDate: string | null | undefined
  status: RenewalStatus
  className?: string
}

export function ValidityBand({ registeredDate, renewalDate, status, className }: ValidityBandProps) {
  const progress = termProgress(registeredDate, renewalDate)
  if (progress === null) return null

  const percent = Math.round(progress * 100)
  const overdue = status.tone === 'overdue'

  return (
    <div className={cn('flex flex-col gap-2', TONE[status.tone], className)}>
      <div
        className="relative h-px bg-rule-firm"
        role="img"
        aria-label={
          overdue
            ? `Registration term ended ${formatDate(renewalDate)}.`
            : `Registered ${formatDate(registeredDate)}, renews ${formatDate(renewalDate)}.`
        }
      >
        {/* Elapsed portion of the term. */}
        <div className="absolute inset-y-0 left-0 h-px bg-current" style={{ width: `${percent}%` }} />

        {/* End-of-term tick. Sits back from the edge when overdue, so the
            marker can sit past it and the overrun is visible. */}
        <span
          aria-hidden
          className="absolute -top-[3px] h-[7px] w-px bg-rule-firm"
          style={overdue ? { left: '88%' } : { right: 0 }}
        />

        {/* Today. The dot is the thing the eye lands on. */}
        <span
          aria-hidden
          className="absolute -top-[5px] h-[11px] w-px -translate-x-[0.5px] bg-current"
          style={{ left: `${percent}%` }}
        >
          <span className="absolute -top-[3px] -left-[2.5px] size-1.5 rounded-full bg-current" />
        </span>
      </div>

      <div className="flex justify-between gap-4 text-xs text-sage">
        <span>Registered {formatDate(registeredDate)}</span>
        <span>
          {overdue ? 'Renewal due ' : 'Renews '}
          {formatDate(renewalDate)}
        </span>
      </div>
    </div>
  )
}
