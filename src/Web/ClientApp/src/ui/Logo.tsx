import { cn } from '@/lib/cn'

/**
 * Placeholder identity — a generic geometric mark, standing in until a real
 * logo exists. Deliberately abstract rather than clever: it should look
 * intentional beside the product name without pretending to be a brand.
 *
 * Drawn inline as SVG rather than shipped as a file so it inherits the theme —
 * the mark is `fill-accent-600`, so it moves with the palette and never has to
 * be re-exported at a new colour.
 */
export function Logo({
  className,
  wordmark = true,
  tagline = null,
  size = 'md',
}: {
  className?: string
  /** Mark only, for tight spaces. */
  wordmark?: boolean
  /** The line under the product name. Omit with `null`. */
  tagline?: string | null
  size?: 'sm' | 'md'
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        viewBox="0 0 32 32"
        role="img"
        aria-label="Business Portal"
        className={cn('shrink-0', size === 'sm' ? 'size-7' : 'size-9')}
      >
        <rect width="32" height="32" rx="9" className="fill-accent-600" />
        <path d="M16 7.5 24.5 16 16 24.5 7.5 16Z" className="fill-paper" />
        <path d="M16 12.75 19.25 16 16 19.25 12.75 16Z" className="fill-accent-600" />
      </svg>

      {wordmark ? (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              'font-display font-semibold tracking-tight text-ink',
              size === 'sm' ? 'text-base' : 'text-lg',
            )}
          >
            Business Portal
          </span>
          {tagline ? (
            <span className="mt-1 text-[0.7rem] tracking-[0.12em] text-ink-faint uppercase">{tagline}</span>
          ) : null}
        </span>
      ) : null}
    </span>
  )
}
