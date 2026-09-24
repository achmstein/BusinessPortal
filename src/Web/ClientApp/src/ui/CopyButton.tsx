import { Clipboard } from '@ark-ui/react/clipboard'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Copy a value, with the confirmation the act needs.
 *
 * The webhook URLs in admin settings and the ATO reference code were plain text
 * you had to select by hand — a URL wrapped in a <code> tag is genuinely
 * awkward to select without catching the punctuation around it.
 *
 * Ark owns the clipboard write, the copied state and the timeout back to idle,
 * and announces the change rather than only swapping an icon.
 */
export function CopyButton({
  value,
  label = 'Copy',
  className,
}: {
  value: string
  /** Accessible name — say what is being copied when several sit on one page. */
  label?: string
  className?: string
}) {
  return (
    <Clipboard.Root value={value} timeout={2000}>
      <Clipboard.Trigger
        aria-label={label}
        className={cn(
          'inline-grid size-7 shrink-0 place-items-center rounded-md text-ink-faint',
          'transition-colors hover:bg-surface-sunken hover:text-ink',
          className,
        )}
      >
        <Clipboard.Indicator copied={<Check aria-hidden className="size-3.5 text-accent-600" />}>
          <Copy aria-hidden className="size-3.5" />
        </Clipboard.Indicator>
      </Clipboard.Trigger>
    </Clipboard.Root>
  )
}
