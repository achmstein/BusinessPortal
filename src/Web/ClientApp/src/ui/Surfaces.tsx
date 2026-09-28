import type { ComponentProps, ElementType, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * A stack of records separated by hairlines.
 *
 * Registry uses this instead of a grid of shadowed cards: a register is a
 * continuous list of entries, and hairlines let the records sit closer together
 * without each one shouting for its own box.
 */
export function RecordList({
  as: Tag = 'div',
  className,
  ...props
}: ComponentProps<'div'> & { as?: ElementType }) {
  return (
    <Tag
      className={cn(
        'flex flex-col rounded-xl border border-rule bg-surface shadow-card',
        '[&>*+*]:border-t [&>*+*]:border-rule',
        className,
      )}
      {...props}
    />
  )
}

export function Record({ className, ...props }: ComponentProps<'article'>) {
  return <article className={cn('px-5 py-5 sm:px-6', className)} {...props} />
}

/** The name at the head of a register entry — one size on every register page. */
export function RecordTitle({
  as: Tag = 'h2',
  className,
  ...props
}: ComponentProps<'h2'> & { as?: ElementType }) {
  return <Tag className={cn('font-display text-xl leading-tight font-medium text-ink', className)} {...props} />
}

/** A bounded panel for content that isn't a register entry — forms, summaries. */
export function Panel({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn('rounded-xl border border-rule bg-surface p-5 shadow-card sm:p-6', className)}
      {...props}
    />
  )
}

export function PanelTitle({
  as: Tag = 'h2',
  className,
  ...props
}: ComponentProps<'h2'> & { as?: ElementType }) {
  // Same style as Section's heading — one heading level for every block.
  return <Tag className={cn('font-display text-lg leading-tight font-semibold text-ink', className)} {...props} />
}

/**
 * Empty state. Required wherever a collection can be empty — the old screens
 * used a line of grey italic text with no way forward, and because failed
 * requests fell back to an empty array, that same line was also what a server
 * error looked like.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-sm border border-dashed border-rule-firm',
        'bg-surface/60 px-6 py-12 text-center',
        className,
      )}
    >
      <p className="font-display text-lg font-medium text-ink">{title}</p>
      {description ? <p className="max-w-sm text-sm text-ink-faint">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

/** Distinct from EmptyState on purpose: "we failed" must not read as "you have nothing". */
export function ErrorState({
  title = 'That didn’t load',
  description = 'Something went wrong at our end. Try again in a moment.',
  action,
  className,
}: {
  title?: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-sm border border-danger-100 bg-danger-50/50 px-6 py-10 text-center',
        className,
      )}
      role="alert"
    >
      <p className="font-display text-lg font-medium text-danger-700">{title}</p>
      <p className="max-w-sm text-sm text-danger-600">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('animate-pulse rounded-xs bg-surface-sunken', className)} {...props} />
}

/** Placeholder shaped like a record row, so first paint doesn't jump. */
export function RecordSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-2/5" />
          <Skeleton className="h-3.5 w-3/5" />
        </div>
        <Skeleton className="h-8 w-20" />
      </div>
      <Skeleton className="h-px w-full" />
    </div>
  )
}
