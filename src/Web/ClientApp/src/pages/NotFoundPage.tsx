import { Link } from 'react-router-dom'
import { Button } from '@/ui'

// The catch-all used to redirect to /dashboard, which bounced a logged-out
// visitor to /login — so a mistyped or stale link silently became a sign-in
// screen with no explanation.
export function NotFoundPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-6 py-16">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="text-xs font-semibold tracking-[0.12em] text-sage uppercase">Page not found</span>
        <h1 className="font-display text-3xl font-medium text-ink">
          There’s no page at this address
        </h1>
        <p className="text-sm text-sage">
          The link may be out of date, or the address may have a typo in it.
        </p>
        <Button asChild className="mt-1">
          <Link to="/dashboard">Go to your records</Link>
        </Button>
      </div>
    </main>
  )
}
