import type { ComponentProps } from 'react'
import { RadioGroup as ArkRadioGroup } from '@ark-ui/react/radio-group'
import { cn } from '@/lib/cn'

// Both radio screens in this app present the same shape: a selectable card
// with a dot. They each derived "am I checked?" by hand and fed it to a
// ternary; Ark already puts data-state="checked" on the Item and the Control,
// so the styling reads it directly and the pages stop tracking it twice.

export const RadioGroup = {
  Root: ArkRadioGroup.Root,
  Label: ArkRadioGroup.Label,

  /** A selectable card. Checked appearance is driven by Ark, not by a compare. */
  Card: ({ className, ...props }: ComponentProps<typeof ArkRadioGroup.Item>) => (
    <ArkRadioGroup.Item
      className={cn(
        'flex cursor-pointer rounded-lg border bg-surface p-4 text-left transition-colors',
        'border-rule-firm hover:bg-surface-sunken/60',
        'data-[state=checked]:border-accent-600 data-[state=checked]:bg-accent-50',
        className,
      )}
      {...props}
    />
  ),

  /** The dot. Fills with the accent when its card is chosen. */
  Dot: ({ className }: { className?: string }) => (
    <ArkRadioGroup.ItemControl
      className={cn(
        'grid size-4 shrink-0 place-items-center rounded-full border transition-colors',
        'border-rule-firm',
        'data-[state=checked]:border-accent-600 data-[state=checked]:bg-accent-600',
        '[&[data-state=checked]>span]:opacity-100',
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-surface opacity-0 transition-opacity" />
    </ArkRadioGroup.ItemControl>
  ),

  Text: ({ className, ...props }: ComponentProps<typeof ArkRadioGroup.ItemText>) => (
    <ArkRadioGroup.ItemText className={cn('text-sm text-ink', className)} {...props} />
  ),

  /** Required inside every Card — it is what makes the group a real fieldset. */
  HiddenInput: ArkRadioGroup.ItemHiddenInput,
}
