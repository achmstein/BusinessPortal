import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { landingPath } from '@/auth/landing'
import { Button } from '@/ui'

// The catch-all used to redirect to /dashboard, which bounced a logged-out
// visitor to /login — so a mistyped or stale link silently became a sign-in
// screen with no explanation.
//
// `inShell` is for the copies mounted inside the client and admin layouts: a
// signed-in person who mistypes a path keeps their navigation instead of being
// dropped onto a bare page with one button back.
export function NotFoundPage({ inShell = false }: { inShell?: boolean }) {
  const { user } = useAuth()
  const home = landingPath(user)

  const body = (
    <div className="flex max-w-md flex-col items-center gap-4 text-center">
      <span className="text-xs font-semibold tracking-[0.12em] text-ink-faint uppercase">Page not found</span>
      <h1 className="font-display text-3xl font-medium text-ink">There’s no page at this address</h1>
      <p className="text-sm text-ink-faint">
        The link may be out of date, or the address may have a typo in it.
      </p>
      <Button asChild className="mt-1">
        <Link to={home}>{user?.isAdmin ? 'Back to the console' : 'Go to your records'}</Link>
      </Button>
    </div>
  )

  if (inShell) return <div className="grid place-items-center py-16">{body}</div>

  return <main className="grid min-h-dvh place-items-center bg-paper px-6 py-16">{body}</main>
}
