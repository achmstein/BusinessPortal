import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Icon } from './Icon'
import { useAuth } from '../auth/AuthContext'
import { getAdminOverview } from '../api/generated'

// Ported verbatim from the original components/admin-nav.tsx AdminSidebar +
// app/admin/layout.tsx shell: navy rail with icons, mobile drawer, inbox unread
// footer, and the red Admin indicator.
const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', icon: 'home' },
  { href: '/admin/clients', label: 'Clients', icon: 'users' },
  { href: '/admin/registry', label: 'Registry', icon: 'book' },
  { href: '/admin/messages', label: 'Messages', icon: 'chat' },
  { href: '/admin/settings', label: 'Settings', icon: 'settings' },
]

function AdminBrand({ inverted = false }: { inverted?: boolean }) {
  return (
    <div className="leading-tight">
      <div className={`text-base font-bold tracking-tight ${inverted ? 'text-white' : 'text-navy-900'}`}>
        Admin Console
      </div>
      <div className={`text-[11px] uppercase tracking-wider ${inverted ? 'text-navy-300' : 'text-navy-500'}`}>
        Internal staff use
      </div>
    </div>
  )
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {ADMIN_NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            className={`nav-link ${active ? 'nav-link-active' : ''}`}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // The original layout summed unread across all clients server-side; the
  // overview endpoint exposes the same number.
  useEffect(() => {
    getAdminOverview()
      .then(({ data }) => setUnreadCount(Number(data?.unreadMessages ?? 0)))
      .catch(() => setUnreadCount(0))
  }, [pathname])

  const userName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email || ''
  const userEmail = user?.email ?? ''

  async function onLogout() {
    await logout()
    navigate('/login')
  }

  const adminFooter = (
    <>
      <div className="rounded-lg bg-navy-800 px-3 py-2 mb-3">
        <div className="text-[11px] uppercase tracking-wider text-navy-400">Inbox</div>
        <div className="text-sm font-semibold text-white">
          {unreadCount === 0 ? 'All caught up' : `${unreadCount} unread`}
        </div>
      </div>
      <div className="px-3">
        <div className="text-[11px] uppercase tracking-wider text-navy-400">Signed in as</div>
        <div className="text-sm font-medium text-white truncate">{userName || userEmail}</div>
        <div className="text-xs text-navy-400 truncate">{userEmail}</div>
        <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-red-300">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500"></span> Admin
        </div>
      </div>
      <div className="mt-3 px-1">
        <button onClick={onLogout} className="nav-link w-full">
          <Icon name="logout" />
          <span>Sign out</span>
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-dvh lg:flex bg-navy-50">
      {/* Top bar (mobile) */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-navy-900 text-white px-4 py-3 shadow">
        <AdminBrand inverted />
        <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-md p-2 hover:bg-navy-800">
          <Icon name="menu" />
        </button>
      </div>

      {open ? (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85%] bg-navy-900 text-white p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <AdminBrand inverted />
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="rounded-md p-2 hover:bg-navy-800">
                <Icon name="close" />
              </button>
            </div>
            <NavList pathname={pathname} onNavigate={() => setOpen(false)} />
            <div className="mt-6 border-t border-navy-800 pt-4">{adminFooter}</div>
          </aside>
        </div>
      ) : null}

      <aside className="hidden lg:flex lg:flex-col lg:w-72 bg-navy-900 text-white p-4 sticky top-0 h-dvh">
        <div className="px-2 py-2">
          <AdminBrand inverted />
        </div>
        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          <NavList pathname={pathname} />
        </div>
        <div className="border-t border-navy-800 pt-3 mt-3">{adminFooter}</div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
