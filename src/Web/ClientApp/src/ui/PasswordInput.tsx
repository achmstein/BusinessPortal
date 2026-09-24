import { forwardRef } from 'react'
import { PasswordInput as ArkPasswordInput } from '@ark-ui/react/password-input'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * A password field with a working reveal toggle.
 *
 * Every password field in the app was a bare `type="password"` with no way to
 * see what you typed — including "Confirm password", where the whole failure
 * mode is a typo you cannot see. The admin console did have a toggle, but it
 * was hand-rolled with `tabIndex={-1}`, so a keyboard user could never reach
 * it and a screen reader was never told the state changed.
 *
 * Ark handles the toggle's label, its pressed state, and keeping the caret
 * where it was across the switch.
 */
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<'input'>, 'type'> & { invalid?: boolean; mono?: boolean }
>(function PasswordInput({ className, invalid, mono, ...props }, ref) {
  return (
    <ArkPasswordInput.Root className="relative">
      <ArkPasswordInput.Control>
        <ArkPasswordInput.Input
          ref={ref}
          className={cn(
            'block h-10 w-full rounded-md border bg-surface pr-11 pl-3 text-sm text-ink',
            'placeholder:text-ink-faint/70 transition-colors',
            'focus:outline-none focus-visible:border-accent-600 focus-visible:ring-2 focus-visible:ring-accent-500/30',
            'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-faint',
            invalid ? 'border-danger-500 ring-2 ring-danger-500/25' : 'border-rule-firm',
            mono && 'font-mono text-[0.8125rem]',
            className,
          )}
          {...props}
        />
        <ArkPasswordInput.VisibilityTrigger
          className={cn(
            'absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-md',
            'text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink',
          )}
        >
          <ArkPasswordInput.Indicator fallback={<Eye aria-hidden className="size-4" />}>
            <EyeOff aria-hidden className="size-4" />
          </ArkPasswordInput.Indicator>
        </ArkPasswordInput.VisibilityTrigger>
      </ArkPasswordInput.Control>
    </ArkPasswordInput.Root>
  )
})
