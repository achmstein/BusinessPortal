import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-dvh grid place-items-center text-navy-500">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  if (!user.isAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
