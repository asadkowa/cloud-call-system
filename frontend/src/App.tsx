import { Routes, Route } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import UsersPage from './pages/UsersPage'
import ExtensionsPage from './pages/ExtensionsPage'
import CallsPage from './pages/CallsPage'
import DialpadPage from './pages/DialpadPage'
import SettingsPage from './pages/SettingsPage'
import SuperAdminSettingsPage from './pages/SuperAdminSettingsPage'
import UserSettingsPage from './pages/UserSettingsPage'
import PbxPage from './pages/PbxPage'
import BillingPage from './pages/BillingPage'
import AdminPlansPage from './pages/AdminPlansPage'
import CompaniesPage from './pages/CompaniesPage'
import UserDashboardPage from './pages/UserDashboardPage'
import Layout from './components/common/Layout'
import LandingPage from './components/landing/LandingPage'
import PaymentReportDashboard from './components/billing/PaymentReportDashboard'
import AdminConfigurationPage from './pages/AdminConfigurationPage'
import SystemHealthPage from './pages/SystemHealthPage'

function App() {
  const { isAuthenticated, user, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    )
  }

  // Route based on user role (SaaS roles)
  const isSuperAdmin = user?.role === 'superadmin'
  const isCompanyAdmin = user?.role === 'company_admin'
  const isSupervisor = user?.role === 'supervisor'
  const isAgent = user?.role === 'agent'
  const isUser = user?.role === 'user'

  return (
    <Layout>
      <Routes>
        {/* SuperAdmin routes - Full platform access */}
        {isSuperAdmin && (
          <>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/companies" element={<CompaniesPage />} />
            <Route path="/admin/plans" element={<AdminPlansPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/extensions" element={<ExtensionsPage />} />
            <Route path="/calls" element={<CallsPage />} />
            <Route path="/dialpad" element={<DialpadPage />} />
            <Route path="/pbx" element={<PbxPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/billing/reports" element={<PaymentReportDashboard />} />
            <Route path="/admin/analytics" element={<div className="max-w-7xl mx-auto"><div className="mb-8"><h1 className="text-3xl font-bold text-gray-900">System Analytics</h1><p className="mt-2 text-gray-600">Platform usage and performance metrics</p></div><div className="bg-white p-6 rounded-lg shadow"><p className="text-gray-500">System analytics dashboard showing user activity, call volumes, system performance, and usage trends across all tenants.</p></div></div>} />
            <Route path="/admin/health" element={<SystemHealthPage />} />
            <Route path="/settings" element={<SuperAdminSettingsPage />} />
            <Route path="/admin/settings" element={<AdminConfigurationPage />} />
          </>
        )}

        {/* Company Admin routes - Company management */}
        {(isCompanyAdmin || isSupervisor) && !isSuperAdmin && (
          <>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/extensions" element={<ExtensionsPage />} />
            <Route path="/calls" element={<CallsPage />} />
            <Route path="/dialpad" element={<DialpadPage />} />
            <Route path="/pbx" element={<PbxPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </>
        )}

        {/* Agent/User routes - Limited access */}
        {(isAgent || isUser) && !isCompanyAdmin && !isSuperAdmin && (
          <>
            <Route path="/" element={<UserDashboardPage />} />
            <Route path="/dashboard" element={<UserDashboardPage />} />
            <Route path="/calls" element={<CallsPage />} />
            <Route path="/dialpad" element={<DialpadPage />} />
            <Route path="/settings" element={<UserSettingsPage />} />
          </>
        )}

        {/* Fallback route based on role */}
        <Route
          path="*"
          element={
            (isAgent || isUser) && !isCompanyAdmin && !isSuperAdmin
              ? <UserDashboardPage />
              : <DashboardPage />
          }
        />
      </Routes>
    </Layout>
  )
}

export default App