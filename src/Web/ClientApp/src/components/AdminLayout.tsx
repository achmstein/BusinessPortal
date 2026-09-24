import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BookMarked,
  LayoutGrid,
  LogOut,
  Menu as MenuIcon,
  MessageSquare,
  Settings,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { getAdminOverviewOptions } from '@/api/generated/@tanstack/react-query.gen'
import { useAuth } from '@/auth/AuthContext'
import { cn } from '@/lib/cn'
import { Drawer, Logo } from '@/ui'

// ─────────────────────────────────────────────────────────────────────────────
// The admin shell.
//
// This is where the two halves of the product deliberately diverge. The client
// portal dropped its sidebar for a top bar because customers visit twice a year
// and scan; staff are in here every day, moving between the same five places,
// so a persistent rail that builds muscle memory is the right call — the same
// reasoning, applied to a different audience, reaching the opposite answer.
//
// It stays light rather than reverting to a dark rail: the density comes from
// tighter spacing, not from inverting the palette.
//
// The mobile drawer is a real dialog now. The old one was a bare fixed div with
// a click-only backdrop — no focus trap, no Escape, no focus restore.
// ─────────────────────────────────────────────────────────────────────────────

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/admin/clients', label: 'Clients', icon: Users },
  { to: '/admin/registry', label: 'Registry', icon: BookMarked },
  { to: '/admin/messages', label: 'Messages', icon: MessageSquare },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

function NavItems({ onNavigate, unread }: { onNavigate?: () => void; unread: number }) {
  return (
    <nav aria-label="Admin sections" className="flex flex-col gap-0.5">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-surface-sunken font-medium text-ink'
                : 'text-ink-muted hover:bg-surface-sunken/60 hover:text-ink',
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
              <span aria-current={isActive ? 'page' : undefined} className="flex-1">
                {item.label}
              </span>
              {item.to === '/admin/messages' && unread > 0 ? (
                <span
                  data-numeric
                  className="rounded-full bg-accent-600 px-1.5 py-0.5 text-[0.6875rem] font-medium text-paper"
                >
                  {unread}
                </span>
              ) : null}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Was refetched on every route change just to keep a badge current; the query
  // cache handles that now, and staleness of a minute is fine for an inbox count.
  const overview = useQuery(getAdminOverviewOptions())
  const unread = Number(overview.data?.unreadMessages ?? 0)

  const name = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || (user?.email ?? '')

  async function onLogout() {
    await logout()
    navigate('/login')
  }

  const identity = (
    <div className="flex flex-col gap-3 border-t border-rule pt-4">
      <div className="px-3">
        <p className="truncate text-sm font-medium text-ink">{name}</p>
        <p className="truncate text-xs text-ink-faint">{user?.email}</p>
        <p className="mt-1 text-xs tracking-[0.1em] text-warn-700 uppercase">Staff access</p>
      </div>
      <div className="flex flex-col gap-0.5">
        {/* Staff hold portal accounts of their own; the console link in the
            portal's account menu is the other half of this trip. */}
        <Link
          to="/"
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <UserRound aria-hidden className="size-4" strokeWidth={1.75} />
          Your own records
        </Link>
        <button
          type="button"
          onClick={() => void onLogout()}
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <LogOut aria-hidden className="size-4" strokeWidth={1.75} />
          Sign out
        </button>
      </div>
    </div>
  )

  const brand = (
    <Link to="/admin" className="rounded-md px-3">
      <Logo size="sm" tagline="Admin console" />
    </Link>
  )

  return (
    <div className="min-h-dvh bg-paper lg:flex">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:text-paper"
      >
        Skip to content
      </a>

      {/* Mobile bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-rule bg-paper px-4 py-3 lg:hidden">
        {brand}
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
          className="rounded-md p-2 text-ink-muted transition-colors hover:bg-surface-sunken"
        >
          <MenuIcon aria-hidden className="size-5" />
        </button>
      </div>

      <Drawer.Root
        open={drawerOpen}
        onOpenChange={(details) => setDrawerOpen(details.open)}
        lazyMount
        unmountOnExit
      >
        <Drawer.Content overlayClassName="lg:hidden">
          <div className="flex items-center justify-between">
            {brand}
            <Drawer.CloseTrigger
              aria-label="Close menu"
              className="rounded-md p-2 text-ink-muted transition-colors hover:bg-surface-sunken"
            >
              <X aria-hidden className="size-5" />
            </Drawer.CloseTrigger>
          </div>
          <NavItems unread={unread} onNavigate={() => setDrawerOpen(false)} />
          <div className="mt-auto">{identity}</div>
        </Drawer.Content>
      </Drawer.Root>

      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-4 border-r border-rule bg-paper p-4 lg:flex">
        {brand}
        <NavItems unread={unread} />
        <div className="mt-auto">{identity}</div>
      </aside>

      <main id="admin-main" className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
