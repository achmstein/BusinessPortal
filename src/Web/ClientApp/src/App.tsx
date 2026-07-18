import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './auth/RequireAuth'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { BusinessPage } from './pages/BusinessPage'
import { BusinessNamesPage } from './pages/BusinessNamesPage'
import { PlaceholderPage } from './pages/PlaceholderPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<PlaceholderPage title="Personal Details" />} />
        <Route path="/business" element={<BusinessPage />} />
        <Route path="/business-names" element={<BusinessNamesPage />} />
        <Route path="/asic-renewals" element={<PlaceholderPage title="ASIC Renewals" />} />
        <Route path="/ato-portal" element={<PlaceholderPage title="Link to ATO" />} />
        <Route path="/messages" element={<PlaceholderPage title="Messages" />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
