import { Steps as ArkSteps } from '@ark-ui/react/steps'
import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * A progress indicator for a flow with a known number of steps.
 *
 * The ATO link flow announced itself with the string "Step 1 of 2" in the page
 * eyebrow — accurate, but it never showed what step two was, so the reader
 * could not tell what they were committing to before starting. Ark's Steps
 * gives the list its ARIA and the current-step semantics; this styles it as a
 * quiet horizontal rail rather than a wizard chrome bar.
 *
 * Presentational only: the flow's own state drives `step`, and the triggers are
 * not clickable, because you cannot jump into a half-finished ATO handshake.
 */
export function Steps({
  step,
  items,
  className,
}: {
  /** Zero-based index of the current step. */
  step: number
  items: { value: string; label: string }[]
  className?: string
}) {
  return (
    <ArkSteps.Root step={step} count={items.length} className={className}>
      <ArkSteps.List className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {items.map((item, index) => (
          <ArkSteps.Item key={item.value} index={index} className="flex flex-1 items-center gap-3">
            <ArkSteps.Trigger
              disabled
              className="flex items-center gap-2.5 text-left disabled:cursor-default"
            >
              <ArkSteps.Indicator
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full border text-xs font-medium',
                  'border-rule-firm bg-surface text-ink-faint transition-colors',
                  'data-[current]:border-accent-600 data-[current]:bg-accent-600 data-[current]:text-paper',
                  'data-[complete]:border-accent-600 data-[complete]:bg-accent-50 data-[complete]:text-accent-700',
                )}
              >
                {index < step ? <Check aria-hidden className="size-3.5" /> : index + 1}
              </ArkSteps.Indicator>
              <span
                className={cn(
                  'text-sm whitespace-nowrap',
                  index === step ? 'font-medium text-ink' : 'text-ink-faint',
                )}
              >
                {item.label}
              </span>
            </ArkSteps.Trigger>
            <ArkSteps.Separator className="h-px flex-1 bg-rule data-[complete]:bg-accent-200" />
          </ArkSteps.Item>
        ))}
      </ArkSteps.List>
    </ArkSteps.Root>
  )
}
