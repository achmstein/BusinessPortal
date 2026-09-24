import { forwardRef, type ButtonHTMLAttributes, type ReactElement } from 'react'
import { ark } from '@ark-ui/react/factory'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  // The accent carries the primary action as well as links and navigation.
  // It is the only saturated colour on a calm screen, so it reads as "the
  // thing to press" without a second hue competing for that job.
  primary: 'bg-accent-600 text-paper shadow-card hover:bg-accent-700 active:bg-accent-800',
  secondary: 'border border-rule-firm bg-surface text-ink shadow-card hover:bg-surface-sunken',
  ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
  danger: 'bg-danger-600 text-paper shadow-card hover:bg-danger-700 active:bg-danger-700',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[0.8125rem] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
}

/** Shared so a Link or anchor can be styled as a button without duplication. */
export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(
    'inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap',
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
