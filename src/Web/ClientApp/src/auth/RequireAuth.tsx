import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { AuthPending } from './AuthPending'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <AuthPending />
  // Carry the destination through the sign-in round trip. Without this, a deep
  // link opened while signed out landed on /dashboard afterwards and the page
  // the person actually wanted was lost.
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <>{children}</>
}
