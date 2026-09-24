import type { ComponentProps } from 'react'
import { Accordion as ArkAccordion } from '@ark-ui/react/accordion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export const Accordion = {
  Root: ({ className, ...props }: ComponentProps<typeof ArkAccordion.Root>) => (
    <ArkAccordion.Root
      className={cn('divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-surface shadow-card', className)}
      {...props}
    />
  ),

  Item: ArkAccordion.Item,

  Trigger: ({ className, ...props }: ComponentProps<typeof ArkAccordion.ItemTrigger>) => (
    <ArkAccordion.ItemTrigger
      className={cn(
        'flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-left transition-colors',
        'hover:bg-surface-sunken/60 sm:px-6',
        className,
      )}
      {...props}
    />
  ),

  /** The chevron. Rotates on open — Ark drives the state, CSS does the turn. */
  Indicator: ({ className }: { className?: string }) => (
    <ArkAccordion.ItemIndicator
      className={cn('shrink-0 text-ink-faint transition-transform data-[state=open]:rotate-180', className)}
    >
      <ChevronDown aria-hidden className="size-4" />
    </ArkAccordion.ItemIndicator>
  ),

  Content: ({ className, ...props }: ComponentProps<typeof ArkAccordion.ItemContent>) => (
    <ArkAccordion.ItemContent className={cn('px-5 pb-5 sm:px-6', className)} {...props} />
  ),
}
