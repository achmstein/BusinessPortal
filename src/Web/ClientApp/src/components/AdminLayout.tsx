import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

// Distinct admin sidebar — text-only "Admin Console" / "Internal staff use"
// (matches the original: no logo tile).
const NAV = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/clients', label: 'Clients', end: false },
  { to: '/admin/messages', label: 'Messages', end: false },
]

export function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function onLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-dvh bg-navy-50">
      <div className="lg:flex">
        <aside className="hidden lg:flex lg:flex-col lg:w-72 bg-navy-900 text-white p-4 sticky top-0 h-dvh">
          <div className="px-2 py-2 leading-tight">
            <div className="text-base font-bold tracking-tight text-white">Admin Console</div>
            <div className="text-[11px] uppercase tracking-wider text-navy-400">Internal staff use</div>
          </div>
          <nav className="mt-4 space-y-1 flex-1">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-navy-800 pt-3 mt-3">
            <div className="px-3 text-[11px] uppercase tracking-wider text-navy-400">Signed in as</div>
            <div className="px-3 text-sm font-medium truncate">{user?.email}</div>
            <button onClick={onLogout} className="nav-link w-full mt-2">Sign out</button>
          </div>
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
