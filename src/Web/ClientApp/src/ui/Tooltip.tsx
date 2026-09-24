import type { ReactElement, ReactNode } from 'react'
import { Tooltip as ArkTooltip } from '@ark-ui/react/tooltip'
import { Portal } from '@ark-ui/react/portal'
import { cn } from '@/lib/cn'

/**
 * The visible counterpart of an icon-only button's `aria-label`.
 *
 * Several row actions in here are a bare icon with an `aria-label` — correct
 * for a screen reader, and nothing at all for a sighted user, who is left to
 * guess what a pencil beside a business name will do.
 *
 * Pass the same words the trigger's `aria-label` already carries; Ark points
 * `aria-describedby` at this content rather than relabelling the trigger, so
 * the two do not fight and the button is not announced twice.
 *
 * Never put an action or a link inside `label` — a tooltip cannot be hovered
 * into on a touch screen, so anything only reachable through it is unreachable.
 */
export function Tooltip({
  label,
  children,
  className,
}: {
  label: ReactNode
  /** A single focusable element — it becomes the trigger via `asChild`. */
  children: ReactElement
  className?: string
}) {
  return (
    <ArkTooltip.Root openDelay={300} closeDelay={80}>
      <ArkTooltip.Trigger asChild>{children}</ArkTooltip.Trigger>
      <Portal>
        <ArkTooltip.Positioner>
          <ArkTooltip.Content
            className={cn(
              'z-50 max-w-xs rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium text-paper',
              'shadow-overlay',
              className,
            )}
          >
            {label}
          </ArkTooltip.Content>
        </ArkTooltip.Positioner>
      </Portal>
    </ArkTooltip.Root>
  )
}
