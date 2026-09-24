import { NumberInput as ArkNumberInput } from '@ark-ui/react/number-input'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/cn'

const STEPPER = cn(
  'grid h-3.5 w-5 cursor-pointer place-items-center rounded-xs text-ink-faint',
  'transition-colors hover:bg-surface-sunken hover:text-ink',
  'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40',
)

/**
 * The last native control in the app. `<input type="number">` draws browser
 * spinner arrows that cannot be styled and differ between engines, and it sat
 * beside fields that had all been themed.
 *
 * Value crosses as a `number`, matching the schema — the form registers this
 * field with `valueAsNumber`, and the surrounding comment in BusinessPage
 * explains why `z.coerce` is deliberately not used.
 */
export function NumberInput({
  value,
  onChange,
  min = 0,
  max,
  id,
  disabled,
  invalid,
  className,
}: {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  id?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
}) {
  return (
    <ArkNumberInput.Root
      value={Number.isFinite(value) ? String(value) : ''}
      // An emptied field reports 0 rather than NaN, which would fail the
      // schema's `min(0)` with a message about a value nobody typed.
      onValueChange={(details) => onChange(Number.isNaN(details.valueAsNumber) ? 0 : details.valueAsNumber)}
      min={min}
      max={max}
      disabled={disabled}
      className={className}
    >
      <ArkNumberInput.Control className="relative flex">
        <ArkNumberInput.Input
          id={id}
          className={cn(
            'block h-10 w-full rounded-md border bg-surface pr-8 pl-3 text-sm text-ink tabular-nums',
            'transition-colors',
            'focus:outline-none focus-visible:border-accent-600 focus-visible:ring-2 focus-visible:ring-accent-500/30',
            'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-faint',
            invalid ? 'border-danger-500 ring-2 ring-danger-500/25' : 'border-rule-firm',
          )}
        />
        <div className="absolute inset-y-1 right-1 flex flex-col justify-center">
          <ArkNumberInput.IncrementTrigger className={STEPPER}>
            <ChevronUp aria-hidden className="size-3" />
          </ArkNumberInput.IncrementTrigger>
          <ArkNumberInput.DecrementTrigger className={STEPPER}>
            <ChevronDown aria-hidden className="size-3" />
          </ArkNumberInput.DecrementTrigger>
        </div>
      </ArkNumberInput.Control>
    </ArkNumberInput.Root>
  )
}
