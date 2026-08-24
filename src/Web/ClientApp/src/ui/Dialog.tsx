import { Dialog as ArkDialog } from '@ark-ui/react/dialog'
import { Portal } from '@ark-ui/react/portal'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

// Replaces two hand-rolled `fixed inset-0` drawers that were not dialogs: no
// role, no aria-modal, no focus trap, no Escape handler, no focus restore, and
// a click-only backdrop. Opening one with a keyboard left you stranded tabbing
// through the page behind it. Ark handles all of that.

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Sub-heading under the title. Announced as the dialog's description. */
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  className?: string
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  return (
    <ArkDialog.Root open={open} onOpenChange={(details) => onOpenChange(details.open)} lazyMount unmountOnExit>
      <Portal>
        <ArkDialog.Backdrop className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-in" />
        <ArkDialog.Positioner className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
          <ArkDialog.Content
            className={cn(
              'flex w-full max-w-lg flex-col rounded-sm bg-surface shadow-overlay',
              'max-h-[calc(100dvh-2rem)]',
              className,
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-rule px-5 py-4">
              <div className="flex flex-col gap-1">
                <ArkDialog.Title className="font-display text-xl leading-tight font-medium text-ink">
                  {title}
                </ArkDialog.Title>
                {description ? (
                  <ArkDialog.Description className="text-sm text-sage">{description}</ArkDialog.Description>
                ) : null}
              </div>
              <ArkDialog.CloseTrigger
                aria-label="Close"
                className="-mt-1 -mr-1 rounded-xs p-1.5 text-sage hover:bg-surface-sunken hover:text-ink"
              >
                <X aria-hidden className="size-4" />
              </ArkDialog.CloseTrigger>
            </div>

            {children ? <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div> : null}

            {footer ? (
              <div className="flex justify-end gap-2 border-t border-rule px-5 py-3.5">{footer}</div>
            ) : null}
          </ArkDialog.Content>
        </ArkDialog.Positioner>
      </Portal>
    </ArkDialog.Root>
  )
}

/**
 * Confirmation for destructive actions.
 *
 * Removing a business name, removing an entity and impersonating a client all
 * previously fired on a single click with no confirmation and no undo.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  onConfirm,
  loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel?: string
  onConfirm: () => void
  loading?: boolean
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      className="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}
