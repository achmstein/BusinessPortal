import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { RenewalTone } from '@/lib/renewal'

// Tones map 1:1 onto the renewal ramp so a badge can never disagree with the
// validity band beside it. 'ok' is deliberately the quietest thing on screen —
// spending a saturated pill on "nothing to do here" leaves no contrast for the
// records that actually need attention.
const TONES: Record<RenewalTone, string> = {
  ok: 'bg-surface-sunken text-ink-muted ring-rule-firm',
  due: 'bg-warn-50 text-warn-700 ring-warn-100',
  overdue: 'bg-danger-50 text-danger-700 ring-danger-100',
  dormant: 'bg-surface-sunken text-ink-faint ring-rule',
  unknown: 'bg-surface-sunken text-ink-faint ring-rule',
}

export function Badge({
  tone = 'ok',
  children,
  className,
}: {
  tone?: RenewalTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
