import type { ComponentProps } from 'react'
import { Dialog as ArkDialog } from '@ark-ui/react/dialog'
import { Portal } from '@ark-ui/react/portal'
import { cn } from '@/lib/cn'

// A dialog anchored to the left edge — the admin console's small-screen nav.
// AdminLayout previously assembled this from Ark's dialog parts inline, which
// meant the one place in the app that needed a focus-trapped panel was also the
// one place its styling wasn't shared.

export const Drawer = {
  Root: ArkDialog.Root,
  Trigger: ArkDialog.Trigger,
  CloseTrigger: ArkDialog.CloseTrigger,
  Title: ArkDialog.Title,

  Content: ({
    className,
    overlayClassName,
    children,
    ...props
  }: ComponentProps<typeof ArkDialog.Content> & { overlayClassName?: string }) => (
    <Portal>
      <ArkDialog.Backdrop className={cn('fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px]', overlayClassName)} />
      <ArkDialog.Positioner className={cn('fixed inset-y-0 left-0 z-50', overlayClassName)}>
        <ArkDialog.Content
          className={cn(
            'flex h-dvh w-72 max-w-[85vw] flex-col gap-4 border-r border-rule bg-paper p-4 shadow-overlay',
            'focus:outline-none',
            className,
          )}
          {...props}
        >
          {children}
        </ArkDialog.Content>
      </ArkDialog.Positioner>
    </Portal>
  ),
}
