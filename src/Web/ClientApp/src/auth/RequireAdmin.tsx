import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { AuthPending } from './AuthPending'

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <AuthPending />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (!user.isAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
