import { Checkbox as ArkCheckbox } from '@ark-ui/react/checkbox'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Checkbox({
  checked,
  onCheckedChange,
  children,
  error,
  className,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  children: ReactNode
  /** Shown beneath, and flips the control into its invalid state. */
  error?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <ArkCheckbox.Root
        checked={checked}
        onCheckedChange={(details) => onCheckedChange(details.checked === true)}
        invalid={Boolean(error)}
        className="flex cursor-pointer items-start gap-3"
      >
        <ArkCheckbox.Control
          className={cn(
            'mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-sm bg-surface ring-1 transition-colors',
            'ring-rule-firm data-[state=checked]:bg-accent-600 data-[state=checked]:ring-accent-600',
            'data-[invalid]:ring-2 data-[invalid]:ring-danger-500',
          )}
        >
          <ArkCheckbox.Indicator>
            <Check aria-hidden className="size-3 text-paper" strokeWidth={3} />
          </ArkCheckbox.Indicator>
        </ArkCheckbox.Control>
        <ArkCheckbox.Label className="text-sm leading-relaxed text-ink-muted">{children}</ArkCheckbox.Label>
        <ArkCheckbox.HiddenInput />
      </ArkCheckbox.Root>
      {error ? <p className="pl-7.5 text-xs font-medium text-danger-600">{error}</p> : null}
    </div>
  )
}
