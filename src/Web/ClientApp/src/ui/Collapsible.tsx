import { useState, type ReactNode } from 'react'
import { Collapsible as ArkCollapsible } from '@ark-ui/react/collapsible'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Shows the first few children and hides the rest behind a trigger.
 *
 * The client detail panels render every entry expanded, which reads fine at
 * three entries and becomes a wall at thirty. Below the threshold this renders
 * nothing extra at all — no trigger, no wrapper — so the common case is
 * untouched.
 *
 * Ark owns the height animation and the `aria-controls`/`aria-expanded` pair;
 * `unmountOnExit` is deliberately off so the hidden rows stay findable with the
 * browser's own in-page search.
 */
export function ShowMore({
  items,
  threshold = 5,
  label,
  className,
}: {
  items: ReactNode[]
  /** At or below this many items, everything renders and no trigger appears. */
  threshold?: number
  /** Names what is being revealed, e.g. "business names". */
  label: string
  className?: string
}) {
  const [open, setOpen] = useState(false)

  if (items.length <= threshold) return <>{items}</>

  const visible = items.slice(0, threshold)
  const hidden = items.slice(threshold)

  return (
    <ArkCollapsible.Root open={open} onOpenChange={(details) => setOpen(details.open)}>
      {visible}
      <ArkCollapsible.Content className={cn('overflow-hidden', className)}>{hidden}</ArkCollapsible.Content>
      <ArkCollapsible.Trigger
        className={cn(
          'mt-1 inline-flex cursor-pointer items-center gap-1 rounded-md text-sm text-accent-600',
          'transition-colors hover:underline',
        )}
      >
        {open ? `Show fewer ${label}` : `Show all ${items.length} ${label}`}
        <ChevronDown
          aria-hidden
          className={cn('size-3.5 transition-transform', open && 'rotate-180')}
        />
      </ArkCollapsible.Trigger>
    </ArkCollapsible.Root>
  )
}
