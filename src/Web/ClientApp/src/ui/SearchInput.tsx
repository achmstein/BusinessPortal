import type { ComponentProps } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * The search box used above the admin tables. Two copies of this markup existed
 * with the same six utility classes hand-written into each; the icon offset and
 * the focus ring have to agree with Field's control styling, and they only do
 * that reliably from one place.
 *
 * `label` is required rather than optional — both originals needed an
 * aria-label because the placeholder is not an accessible name.
 */
export function SearchInput({
  label,
  className,
  size = 'md',
  ...props
}: Omit<ComponentProps<'input'>, 'type' | 'size'> & { label: string; size?: 'sm' | 'md' }) {
  return (
    <div className={cn('relative', className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint"
      />
      <input
        type="search"
        aria-label={label}
        className={cn(
          'w-full rounded-md border border-rule-firm bg-surface pr-3 pl-9 text-sm text-ink',
          'placeholder:text-ink-faint/70 transition-colors',
          'focus:outline-none focus-visible:border-accent-600 focus-visible:ring-2 focus-visible:ring-accent-500/30',
          size === 'sm' ? 'h-9' : 'h-10',
        )}
        {...props}
      />
    </div>
  )
}
