import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './auth/RequireAuth'
import { RequireAdmin } from './auth/RequireAdmin'
import { Layout } from './components/Layout'
import { AdminLayout } from './components/AdminLayout'
import { NotFoundPage } from './pages/NotFoundPage'

// Auth screens load eagerly — they're the entry point, and a chunk fetch on the
// way to sign-in is a visible stall. Everything behind the guard is split, so
// the admin console never ships to a client and vice versa.
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'

const named = <T extends string>(name: T) =>
  <M extends Record<T, React.ComponentType<unknown>>>(module: M) => ({ default: module[name] })

const DashboardPage = lazy(() => import('./pages/DashboardPage').then(named('DashboardPage')))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(named('ProfilePage')))
const BusinessPage = lazy(() => import('./pages/BusinessPage').then(named('BusinessPage')))
const BusinessNamesPage = lazy(() => import('./pages/BusinessNamesPage').then(named('BusinessNamesPage')))
const AsicRenewalsPage = lazy(() => import('./pages/AsicRenewalsPage').then(named('AsicRenewalsPage')))
const RenewBusinessNamePage = lazy(() =>
  import('./pages/RenewBusinessNamePage').then(named('RenewBusinessNamePage')),
)
const CancelBusinessNamePage = lazy(() =>
  import('./pages/CancelBusinessNamePage').then(named('CancelBusinessNamePage')),
)
const AtoPortalPage = lazy(() => import('./pages/AtoPortalPage').then(named('AtoPortalPage')))
const AtoLinkPage = lazy(() => import('./pages/AtoLinkPage').then(named('AtoLinkPage')))
const MessagesPage = lazy(() => import('./pages/MessagesPage').then(named('MessagesPage')))

const AdminOverviewPage = lazy(() =>
  import('./pages/admin/AdminOverviewPage').then(named('AdminOverviewPage')),
)
const AdminClientsPage = lazy(() => import('./pages/admin/AdminClientsPage').then(named('AdminClientsPage')))
const AdminClientDetailPage = lazy(() =>
  import('./pages/admin/AdminClientDetailPage').then(named('AdminClientDetailPage')),
)
const AdminRegistryPage = lazy(() =>
  import('./pages/admin/AdminRegistryPage').then(named('AdminRegistryPage')),
)
const AdminSettingsPage = lazy(() =>
  import('./pages/admin/AdminSettingsPage').then(named('AdminSettingsPage')),
)
const AdminMessagesPage = lazy(() =>
  import('./pages/admin/AdminMessagesPage').then(named('AdminMessagesPage')),
)
const AdminMessageThreadPage = lazy(() =>
  import('./pages/admin/AdminMessageThreadPage').then(named('AdminMessageThreadPage')),
)

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-paper" aria-hidden />}>
      <Routes>
        {/* Renewal emails sent before the move still point at /dashboard, and
            those links outlive any redirect we would like to remove. */}
        <Route path="/dashboard" element={<Navigate to="/" replace />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Client member area */}
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          {/* The customer's own records are the site root — they were a level
              down at /dashboard, which read like one view among several rather
              than the thing this portal is. */}
          <Route path="/" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/business" element={<BusinessPage />} />
          <Route path="/business-names" element={<BusinessNamesPage />} />
          <Route path="/asic-renewals" element={<AsicRenewalsPage />} />
          <Route path="/asic-renewals/:bnId/renew" element={<RenewBusinessNamePage />} />
          <Route path="/asic-renewals/:bnId/cancel" element={<CancelBusinessNamePage />} />
          <Route path="/ato-portal" element={<AtoPortalPage />} />
          <Route path="/ato-portal/link" element={<AtoLinkPage />} />
          <Route path="/messages" element={<MessagesPage />} />
        </Route>

        {/* Admin console. One prefix, one guard, one layout: `/admin` is an
            index route rather than a sibling, and a mistyped `/admin/*` keeps
            the console chrome instead of dropping to a bare page. */}
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminOverviewPage />} />
          <Route path="clients" element={<AdminClientsPage />} />
          <Route path="clients/:id" element={<AdminClientDetailPage />} />
          <Route path="registry" element={<AdminRegistryPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="messages" element={<AdminMessagesPage />} />
          <Route path="messages/:clientId" element={<AdminMessageThreadPage />} />
          <Route path="*" element={<NotFoundPage inShell />} />
        </Route>

        {/* A wrong address says so, rather than bouncing through /dashboard to
            the sign-in screen with no explanation. */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
