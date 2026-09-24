import { ChevronDown, LogOut, Shield, UserRound } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { stopImpersonation } from '../api/generated'
import { Avatar, Button, Logo, Menu } from '@/ui'
import { cn } from '@/lib/cn'

// ─────────────────────────────────────────────────────────────────────────────
// The client shell.
//
// Two decisions specific to this audience, both departures from the old shell:
//
// A light top bar rather than a 288px dark sidebar. The content below is a
// single-column record spine, and a fixed rail spent a fifth of a laptop screen
// on seven links; dark chrome also reads as an operations tool rather than the
// customer's own records.
//
// On small screens the nav is a horizontally scrollable strip, not a drawer.
// People reach this portal once or twice a year, usually from a renewal email —
// they scan for a destination rather than recalling one, so all seven staying
// visible beats hiding them behind a hamburger. It also removes an entire class
// of bug: the old drawer had no focus trap, no Escape handler and a click-only
// backdrop, so opening it with a keyboard left you stranded.
// ─────────────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  // `end` matters only on the root: without it NavLink treats "/" as a prefix
  // and Overview stays highlighted on every page in the portal.
  { href: '/', label: 'Overview', end: true },
  { href: '/business-names', label: 'Business names' },
  { href: '/asic-renewals', label: 'Renewals' },
  { href: '/business', label: 'Businesses' },
  { href: '/ato-portal', label: 'ATO' },
  { href: '/messages', label: 'Messages' },
  { href: '/profile', label: 'Your details' },
]

export function Layout() {
  const { user, logout, refresh } = useAuth()
  const navigate = useNavigate()

  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || (user?.email ?? '')
  const email = user?.email ?? ''

  async function onReturnToAdmin() {
    await stopImpersonation()
    await refresh()
    navigate('/admin')
  }

  async function onLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-dvh bg-paper">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:text-paper"
      >
        Skip to content
      </a>

      {user?.impersonating ? (
        <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 bg-warn-50 px-4 py-2 text-sm text-warn-700 ring-1 ring-warn-100">
          <span>
            You’re viewing the portal as <strong className="font-medium">{email}</strong>.
          </span>
          <Button size="sm" variant="secondary" onClick={onReturnToAdmin}>
            Return to admin
          </Button>
        </div>
      ) : null}

      <header className="sticky top-0 z-30 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <NavLink to="/" className="rounded-md">
            <Logo size="sm" />
          </NavLink>

          <Menu.Root>
            <Menu.Trigger className="gap-2.5">
              <Avatar
                firstName={user?.firstName}
                lastName={user?.lastName}
                email={email}
                size="sm"
              />
              <span className="hidden max-w-[12rem] truncate sm:inline">{fullName}</span>
              <ChevronDown aria-hidden className="size-3.5 text-ink-faint" />
            </Menu.Trigger>
            <Menu.Content>
              <Menu.Header title={fullName} subtitle={email} />
              {/* Staff use the portal too, and had no way back to the console
                  short of typing the URL. Absent while impersonating: the
                  cookie identity is the client then, so isAdmin is false and
                  the banner above already offers the way back. */}
              {user?.isAdmin ? (
                <>
                  <Menu.Item value="admin" onSelect={() => navigate('/admin')}>
                    <Shield aria-hidden className="size-4" />
                    Admin console
                  </Menu.Item>
                  <Menu.Separator />
                </>
              ) : null}
              <Menu.Item value="profile" onSelect={() => navigate('/profile')}>
                <UserRound aria-hidden className="size-4" />
                Your details
              </Menu.Item>
              <Menu.Item value="signout" onSelect={() => void onLogout()}>
                <LogOut aria-hidden className="size-4" />
                Sign out
              </Menu.Item>
            </Menu.Content>
          </Menu.Root>
        </div>

        <nav aria-label="Portal sections" className="mx-auto max-w-5xl px-4 sm:px-6">
          {/* Scrolls horizontally on narrow screens; every destination stays
              reachable without opening anything. */}
          <ul className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <NavLink
                  to={item.href}
                  end={item.end}
                  aria-current={undefined}
                  className={({ isActive }) =>
                    cn(
                      'inline-block border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors',
                      isActive
                        ? 'border-accent-600 font-medium text-ink'
                        : 'border-transparent text-ink-faint hover:border-rule-firm hover:text-ink',
                    )
                  }
                >
                  {({ isActive }) => (
                    // aria-current is what conveys "you are here" to assistive
                    // tech; the underline alone is visual-only.
                    <span aria-current={isActive ? 'page' : undefined}>{item.label}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="main" className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>
    </div>
  )
}
