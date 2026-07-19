import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { BrandLockup } from './Brand'
import { Icon } from './Icon'
import { useAuth } from '../auth/AuthContext'
import { stopImpersonation } from '../api/generated'

// Visible client nav items — same set/order/icons as the original components/nav.tsx
// (the hidden items are omitted, matching the original's `hidden: true` filter).
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'home' },
  { href: '/profile', label: 'Personal Details', icon: 'user' },
  { href: '/business', label: 'Business Details', icon: 'briefcase' },
  { href: '/business-names', label: 'Business Names', icon: 'id' },
  { href: '/asic-renewals', label: 'ASIC Renewals', icon: 'bell' },
  { href: '/ato-portal', label: 'Link to ATO', icon: 'link' },
  { href: '/messages', label: 'Messages', icon: 'chat' },
]

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          onClick={onNavigate}
          className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export function Layout() {
  const { user, logout, refresh } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  async function onReturnToAdmin() {
    await stopImpersonation()
    await refresh()
    navigate('/admin')
  }

  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || (user?.email ?? '')
  const email = user?.email ?? ''

  async function onLogout() {
    await logout()
    navigate('/login')
  }

  const signedInFooter = (
    <div className="border-t border-navy-800 pt-3 mt-3">
      <div className="px-3">
        <div className="text-[11px] uppercase tracking-wider text-navy-400">Signed in as</div>
        <div className="text-sm font-medium truncate">{fullName}</div>
        <div className="text-xs text-navy-400 truncate">{email}</div>
      </div>
      <div className="mt-3 px-1">
        <button type="button" onClick={onLogout} className="nav-link w-full">
          <Icon name="logout" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh bg-navy-50">
      {user?.impersonating ? (
        <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-amber-400 text-navy-900 px-4 py-2 text-sm">
          <span>You are impersonating <strong>{email}</strong>.</span>
          <button type="button" onClick={onReturnToAdmin} className="rounded-md bg-navy-900 text-white px-3 py-1 text-xs font-semibold hover:bg-navy-800">Return to admin</button>
        </div>
      ) : null}
      <div className="lg:flex">
        {/* Top bar (mobile) */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-navy-900 text-white px-4 py-3 shadow">
          <BrandLockup inverted />
          <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-md p-2 hover:bg-navy-800">
            <Icon name="menu" />
          </button>
        </div>

        {/* Drawer (mobile) */}
        {open ? (
          <div className="lg:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85%] bg-navy-900 text-white p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <BrandLockup inverted />
                <button aria-label="Close menu" onClick={() => setOpen(false)} className="rounded-md p-2 hover:bg-navy-800">
                  <Icon name="close" />
                </button>
              </div>
              <NavList onNavigate={() => setOpen(false)} />
              {signedInFooter}
            </aside>
          </div>
        ) : null}

        {/* Sidebar (desktop) */}
        <aside className="hidden lg:flex lg:flex-col lg:w-72 bg-navy-900 text-white p-4 sticky top-0 h-dvh">
          <div className="px-2 py-2">
            <BrandLockup inverted />
          </div>
          <div className="mt-4 flex-1 overflow-y-auto pr-1">
            <NavList />
          </div>
          {signedInFooter}
        </aside>

        <main className="flex-1 min-w-0">
          <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
