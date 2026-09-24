import type { ComponentProps } from 'react'
import { Tabs as ArkTabs } from '@ark-ui/react/tabs'
import { cn } from '@/lib/cn'

// Replaces a hand-rolled role="tablist" that had no arrow-key navigation and
// no tabpanel wiring — the triggers announced themselves as tabs but controlled
// nothing a screen reader could follow.

export const Tabs = {
  Root: ArkTabs.Root,

  List: ({ className, ...props }: ComponentProps<typeof ArkTabs.List>) => (
    <ArkTabs.List className={cn('-mb-px flex gap-1', className)} {...props} />
  ),

  Trigger: ({ className, ...props }: ComponentProps<typeof ArkTabs.Trigger>) => (
    <ArkTabs.Trigger
      className={cn(
        'flex cursor-pointer items-center gap-2 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap',
        'border-transparent text-ink-faint transition-colors hover:border-rule-firm hover:text-ink',
        'data-[selected]:border-accent-600 data-[selected]:font-medium data-[selected]:text-ink',
        className,
      )}
      {...props}
    />
  ),

  Content: ({ className, ...props }: ComponentProps<typeof ArkTabs.Content>) => (
    <ArkTabs.Content className={cn('focus:outline-none', className)} {...props} />
  ),

  /** Count pill beside a tab label. Muted — it labels, it doesn't compete. */
  Count: ({ value }: { value: number }) =>
    Number.isFinite(value) ? (
      <span data-numeric className="text-xs text-ink-faint">
        {value}
      </span>
    ) : null,
}
