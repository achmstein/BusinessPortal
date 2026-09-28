import type { ReactElement, ReactNode } from 'react'
import { HoverCard as ArkHoverCard } from '@ark-ui/react/hover-card'
import { Portal } from '@ark-ui/react/portal'
import { cn } from '@/lib/cn'

/**
 * A preview panel on hover, for answering "who is this?" without navigating.
 *
 * Strictly supplementary. It opens on hover and focus only, so anything inside
 * it is unreachable on a touch screen — the trigger must therefore always be a
 * real link to the same information, and this must never be the only route to
 * something. Unlike Tooltip, the content may contain rich markup, but still no
 * interactive elements: there is no reliable way to move a pointer into it on
 * every device.
 */
export function HoverCard({
  content,
  children,
  className,
}: {
  content: ReactNode
  /** The trigger — must independently lead somewhere, e.g. a link. */
  children: ReactElement
  className?: string
}) {
  return (
    <ArkHoverCard.Root openDelay={400} closeDelay={120}>
      <ArkHoverCard.Trigger asChild>{children}</ArkHoverCard.Trigger>
      <Portal>
        <ArkHoverCard.Positioner>
          <ArkHoverCard.Content
            className={cn(
              'z-60 w-64 rounded-lg border border-rule bg-surface p-3 shadow-overlay',
              'focus:outline-none',
              className,
            )}
          >
            {content}
          </ArkHoverCard.Content>
        </ArkHoverCard.Positioner>
      </Portal>
    </ArkHoverCard.Root>
  )
}
