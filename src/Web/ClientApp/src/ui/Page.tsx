import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { Skeleton } from './Surfaces'

// ─────────────────────────────────────────────────────────────────────────────
// Page composition. Ark standardises the parts; these standardise how a screen
// is put together, so every page has the same rhythm:
//
//   <Page title …>            header (+ back link, actions), then 24px between blocks
//     <Section title …>       one heading style, optional link on the right
//       <List> / <RecordList> compact rows for summaries / rich register entries
//       <Panel>               forms and reference blocks
//     <FormActions />         the save bar for any form that saves in place
//
// A page keeps its header while loading or failing — the loading and error
// states render *inside* <Page>, so a failed request never loses the title.
// See ui/README.md for the rules.
// ─────────────────────────────────────────────────────────────────────────────

/** The one heading style for a block, inside or outside a panel. */
export const sectionHeadingClass = 'font-display text-lg leading-tight font-semibold text-ink'

/** An in-app link in the accent colour. `arrow` for "go there", `back` for "return". */
export function TextLink({
  to,
  arrow,
  back,
  className,
  children,
}: {
  to: string
  arrow?: boolean
  back?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      className={cn('inline-flex items-center gap-1 text-sm text-accent-600 hover:underline', className)}
    >
      {back ? <ArrowLeft aria-hidden className="size-3.5" /> : null}
      {children}
      {arrow ? <ArrowRight aria-hidden className="size-3.5" /> : null}
    </Link>
  )
}

export function Page({
  title,
  description,
  eyebrow,
  actions,
  back,
  className,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  eyebrow?: string
  actions?: ReactNode
  /** Parent page for detail screens — rendered above the title. */
  back?: { to: string; label: string }
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {back ? (
        <TextLink to={back.to} back className="self-start">
          {back.label}
        </TextLink>
      ) : null}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-rule-firm pb-5">
        <div className="flex min-w-0 flex-col gap-1.5">
          {eyebrow ? (
            <span className="text-xs font-semibold tracking-[0.12em] text-ink-faint uppercase">{eyebrow}</span>
          ) : null}
          <h1 className="font-display text-3xl leading-tight font-semibold text-ink sm:text-4xl">{title}</h1>
          {description ? <p className="max-w-prose text-sm text-ink-faint">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </div>
  )
}

/** Body placeholder for a page whose content is loading — header stays real. */
export function PageSkeleton({ blocks = 2 }: { blocks?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      {Array.from({ length: blocks }, (_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  )
}

/** A titled block on a page. The heading matches PanelTitle exactly. */
export function Section({
  title,
  meta,
  action,
  className,
  children,
}: {
  title: ReactNode
  /** Quiet text beside the title, e.g. "3 items". */
  meta?: ReactNode
  /** Usually a <TextLink arrow>. */
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-3">
          <h2 className={sectionHeadingClass}>{title}</h2>
          {meta ? <span className="text-sm text-ink-faint">{meta}</span> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/**
 * Compact rows in one bordered surface — for summaries, queues and history.
 * Use RecordList instead for the main register entries of a page.
 */
function ListRoot({ className, ...props }: ComponentProps<'ul'>) {
  return (
    <ul
      className={cn('flex flex-col divide-y divide-rule rounded-xl border border-rule bg-surface shadow-card', className)}
      {...props}
    />
  )
}

function ListRow({ className, ...props }: ComponentProps<'li'>) {
  return (
    <li
      className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6', className)}
      {...props}
    />
  )
}

export const List = Object.assign(ListRoot, { Row: ListRow })

/**
 * The save bar for a form that saves in place. Default-size button, always
 * "Save changes", enabled only when something changed.
 */
export function FormActions({
  dirty,
  saving,
  onSave,
  label = 'Save changes',
  children,
  className,
}: {
  dirty: boolean
  saving: boolean
  /** Omit to make the button submit its enclosing <form>. */
  onSave?: () => void
  label?: string
  /** Secondary controls, laid out on the left. */
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-3 border-t border-rule pt-4', className)}>
      {children ? <div className="mr-auto flex flex-wrap items-center gap-3">{children}</div> : null}
      {dirty ? <span className="text-sm text-ink-faint">Unsaved changes</span> : null}
      <Button type={onSave ? 'button' : 'submit'} onClick={onSave} disabled={!dirty} loading={saving}>
        {label}
      </Button>
    </div>
  )
}
