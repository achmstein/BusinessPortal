import type { ReactNode } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// The shell for every signed-out screen.
//
// It replaces a two-column layout whose left half was a dark marketing panel
// pitching BAS lodgement and tax returns. Everyone who reaches this door is
// already a customer — they paid to renew a business name — so selling to them
// here is noise. The panel was also `hidden lg:flex`, which meant phones (most
// of this audience) never saw it and the page's only <h1> lived inside it, so
// mobile had no top-level heading at all.
//
// One centred column, one job, and the <h1> always present.
// ─────────────────────────────────────────────────────────────────────────────

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-7">
        <div className="flex flex-col gap-1 leading-none">
          <span className="font-display text-xl font-medium text-ink">Business Portal</span>
          <span className="text-[0.7rem] tracking-[0.12em] text-sage uppercase">Your records</span>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl leading-tight font-medium text-ink">{title}</h1>
          {description ? <p className="text-sm leading-relaxed text-sage">{description}</p> : null}
        </div>

        {children}

        {footer ? <div className="border-t border-rule pt-5 text-sm text-sage">{footer}</div> : null}
      </div>
    </main>
  )
}
