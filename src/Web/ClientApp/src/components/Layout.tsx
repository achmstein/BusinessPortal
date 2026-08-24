import { Menu } from '@ark-ui/react/menu'
import { Portal } from '@ark-ui/react/portal'
import { ChevronDown, LogOut, UserRound } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { stopImpersonation } from '../api/generated'
import { Button } from '@/ui'
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
  { href: '/dashboard', label: 'Overview' },
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
        <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 bg-brass-50 px-4 py-2 text-sm text-brass-700 ring-1 ring-brass-100">
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
          <NavLink to="/dashboard" className="flex flex-col leading-none">
            <span className="font-display text-lg font-medium text-ink">Business Portal</span>
            <span className="text-[0.7rem] tracking-[0.12em] text-sage uppercase">Your records</span>
          </NavLink>

          <Menu.Root>
            <Menu.Trigger className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-ink-muted hover:bg-surface-sunken hover:text-ink">
              <UserRound aria-hidden className="size-4" />
              <span className="hidden max-w-[12rem] truncate sm:inline">{fullName}</span>
              <ChevronDown aria-hidden className="size-3.5 text-sage" />
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content className="min-w-56 rounded-sm bg-surface p-1 shadow-overlay ring-1 ring-rule focus:outline-none">
                  <div className="border-b border-rule px-3 py-2">
                    <p className="truncate text-sm font-medium text-ink">{fullName}</p>
                    <p className="truncate text-xs text-sage">{email}</p>
                  </div>
                  <Menu.Item
                    value="profile"
                    onSelect={() => navigate('/profile')}
                    className="flex cursor-pointer items-center gap-2 rounded-xs px-3 py-2 text-sm text-ink-muted data-[highlighted]:bg-surface-sunken data-[highlighted]:text-ink"
                  >
                    <UserRound aria-hidden className="size-4" />
                    Your details
                  </Menu.Item>
                  <Menu.Item
                    value="signout"
                    onSelect={() => void onLogout()}
                    className="flex cursor-pointer items-center gap-2 rounded-xs px-3 py-2 text-sm text-ink-muted data-[highlighted]:bg-surface-sunken data-[highlighted]:text-ink"
                  >
                    <LogOut aria-hidden className="size-4" />
                    Sign out
                  </Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
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
                  aria-current={undefined}
                  className={({ isActive }) =>
                    cn(
                      'inline-block border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors',
                      isActive
                        ? 'border-bottle-600 font-medium text-ink'
                        : 'border-transparent text-sage hover:border-rule-firm hover:text-ink',
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
