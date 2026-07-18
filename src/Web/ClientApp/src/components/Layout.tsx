import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { BrandLockup } from './Brand'
import { useAuth } from '../auth/AuthContext'

// Client sidebar — same nav items + order as the original app (components/nav.tsx).
const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/personal', label: 'Personal Details' },
  { to: '/business', label: 'Business Details' },
  { to: '/business-names', label: 'Business Names' },
  { to: '/asic-renewals', label: 'ASIC Renewals' },
  { to: '/ato-portal', label: 'Link to ATO' },
  { to: '/messages', label: 'Messages' },
]

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function onLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden lg:flex flex-col bg-navy-900 text-white p-4">
        <div className="px-2 py-3">
          <BrandLockup inverted />
        </div>
        <nav className="mt-4 space-y-1 flex-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={onLogout} className="nav-link w-full text-left">Sign out</button>
        <div className="px-3 pt-2 text-[11px] text-navy-400 truncate">{user?.email}</div>
      </aside>

      <main className="p-6 sm:p-8 w-full max-w-6xl mx-auto">
        <Outlet />
      </main>
    </div>
  )
}
