import { forwardRef, type ButtonHTMLAttributes, type ReactElement } from 'react'
import { ark } from '@ark-ui/react/factory'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  // Ink rather than bottle: the brand colour is reserved for navigation and
  // links, so a page full of buttons doesn't dilute it.
  primary: 'bg-ink text-paper hover:bg-ink/90 active:bg-ink',
  secondary: 'bg-surface text-ink ring-1 ring-rule-firm hover:bg-surface-sunken',
  ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
  danger: 'bg-rust-600 text-paper hover:bg-rust-700 active:bg-rust-700',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[0.8125rem] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
}

/** Shared so a Link or anchor can be styled as a button without duplication. */
export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(
    'inline-flex items-center justify-center rounded-sm font-medium whitespace-nowrap',
    'transition-colors disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    className,
  )
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Shows a spinner and blocks input — also guards against double submits. */
  loading?: boolean
  /** Render the single child element instead of a button, keeping the styles. */
  asChild?: boolean
  children?: ReactElement | React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, asChild, disabled, className, children, type, ...props },
  ref,
) {
  const classes = buttonClasses(variant, size, className)

  if (asChild) {
    return (
      <ark.button asChild className={classes} {...props}>
        {children}
      </ark.button>
    )
  }

  return (
    <button
      ref={ref}
      // Buttons inside a form default to submit; an explicit default avoids the
      // classic "this ghost button reloaded the page" bug.
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...props}
    >
      {loading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
      {children}
    </button>
  )
})
