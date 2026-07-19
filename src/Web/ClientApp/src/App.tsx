import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './auth/RequireAuth'
import { RequireAdmin } from './auth/RequireAdmin'
import { Layout } from './components/Layout'
import { AdminLayout } from './components/AdminLayout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { BusinessPage } from './pages/BusinessPage'
import { BusinessNamesPage } from './pages/BusinessNamesPage'
import { ProfilePage } from './pages/ProfilePage'
import { MessagesPage } from './pages/MessagesPage'
import { AsicRenewalsPage } from './pages/AsicRenewalsPage'
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage'
import { AdminClientsPage } from './pages/admin/AdminClientsPage'
import { AdminClientDetailPage } from './pages/admin/AdminClientDetailPage'
import { AdminMessagesPage } from './pages/admin/AdminMessagesPage'
import { PlaceholderPage } from './pages/PlaceholderPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

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
        <Route path="/ato-portal" element={<PlaceholderPage title="Link to ATO" />} />
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
        <Route path="/admin/messages" element={<AdminMessagesPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
