import { Toast, Toaster, createToaster } from '@ark-ui/react/toast'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/cn'

// One feedback channel, replacing three that ran in parallel: `?ok=`/`?err=`
// search params (which replaced the whole query string and never dismissed),
// local useState banners, and a red div copy-pasted into nine files.

export const toaster = createToaster({
  placement: 'bottom-end',
  overlap: true,
  gap: 8,
  duration: 5000,
})

/** Confirms an action in the same words the control used. */
export function toastSuccess(title: string, description?: string) {
  toaster.create({ type: 'success', title, description })
}

/** Says what went wrong and what to do — never just "an error occurred". */
export function toastError(title: string, description?: string) {
  toaster.create({ type: 'error', title, description, duration: 8000 })
}

export function toastInfo(title: string, description?: string) {
  toaster.create({ type: 'info', title, description })
}

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const

const TONE = {
  success: 'text-bottle-600',
  error: 'text-rust-600',
  info: 'text-sage',
} as const

export function ToastRegion() {
  return (
    <Toaster toaster={toaster}>
      {(toast) => {
        const kind = (toast.type === 'success' || toast.type === 'error' ? toast.type : 'info') as keyof typeof ICONS
        const Icon = ICONS[kind]
        return (
          <Toast.Root
            className={cn(
              'flex w-[min(22rem,calc(100vw-2rem))] items-start gap-3 rounded-sm bg-surface p-3.5',
              'ring-1 ring-rule-firm shadow-overlay',
            )}
          >
            <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', TONE[kind])} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Toast.Title className="text-sm font-medium text-ink">{toast.title}</Toast.Title>
              {toast.description ? (
                <Toast.Description className="text-xs leading-relaxed text-sage">
                  {toast.description}
                </Toast.Description>
              ) : null}
            </div>
            <Toast.CloseTrigger
              aria-label="Dismiss"
              className="rounded-xs p-1 text-sage hover:bg-surface-sunken hover:text-ink"
            >
              <X aria-hidden className="size-3.5" />
            </Toast.CloseTrigger>
          </Toast.Root>
        )
      }}
    </Toaster>
  )
}
