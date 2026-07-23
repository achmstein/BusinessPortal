import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './auth/RequireAuth'
import { RequireAdmin } from './auth/RequireAdmin'
import { Layout } from './components/Layout'
import { AdminLayout } from './components/AdminLayout'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { DashboardPage } from './pages/DashboardPage'
import { BusinessPage } from './pages/BusinessPage'
import { BusinessNamesPage } from './pages/BusinessNamesPage'
import { ProfilePage } from './pages/ProfilePage'
import { MessagesPage } from './pages/MessagesPage'
import { AsicRenewalsPage } from './pages/AsicRenewalsPage'
import { RenewBusinessNamePage } from './pages/RenewBusinessNamePage'
import { CancelBusinessNamePage } from './pages/CancelBusinessNamePage'
import { AtoPortalPage } from './pages/AtoPortalPage'
import { AtoLinkPage } from './pages/AtoLinkPage'
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage'
import { AdminClientsPage } from './pages/admin/AdminClientsPage'
import { AdminClientDetailPage } from './pages/admin/AdminClientDetailPage'
import { AdminMessagesPage } from './pages/admin/AdminMessagesPage'
import { AdminMessageThreadPage } from './pages/admin/AdminMessageThreadPage'
import { AdminRegistryPage } from './pages/admin/AdminRegistryPage'
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage'

export default function App() {
  return (
    <Routes>
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
        <Route path="/dashboard" element={<DashboardPage />} />
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

      {/* Admin console */}
      <Route
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route path="/admin" element={<AdminOverviewPage />} />
        <Route path="/admin/clients" element={<AdminClientsPage />} />
        <Route path="/admin/clients/:id" element={<AdminClientDetailPage />} />
        <Route path="/admin/registry" element={<AdminRegistryPage />} />
        <Route path="/admin/settings" element={<AdminSettingsPage />} />
        <Route path="/admin/messages" element={<AdminMessagesPage />} />
        <Route path="/admin/messages/:clientId" element={<AdminMessageThreadPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
