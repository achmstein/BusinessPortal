import type { ReactNode } from 'react'
import { Progress as ArkProgress } from '@ark-ui/react/progress'
import { cn } from '@/lib/cn'

/**
 * A determinate progress bar.
 *
 * The one this replaces was two nested divs with an inline width — no
 * role="progressbar", no aria-valuenow, no aria-valuemax. A screen reader had
 * nothing to report but the surrounding live-region text. Ark puts the ARIA on
 * for free, which is the actual reason to use it here rather than the styling.
 */
export function Progress({
  value,
  max,
  label,
  valueText,
  className,
}: {
  value: number
  max: number
  label: ReactNode
  /** Overrides Ark's default percentage readout — e.g. "3 of 12". */
  valueText?: ReactNode
  className?: string
}) {
  return (
    <ArkProgress.Root value={value} max={max} className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-baseline justify-between gap-4">
        <ArkProgress.Label className="font-display text-lg leading-tight font-semibold text-ink">
          {label}
        </ArkProgress.Label>
        <ArkProgress.ValueText data-numeric className="shrink-0 text-sm text-ink-faint">
          {valueText}
        </ArkProgress.ValueText>
      </div>
      <ArkProgress.Track className="h-1.5 w-full overflow-hidden rounded-full bg-rule-firm">
        <ArkProgress.Range className="h-full rounded-full bg-accent-600 transition-all" />
      </ArkProgress.Track>
    </ArkProgress.Root>
  )
}
