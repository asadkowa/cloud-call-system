import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useRoleAccess } from '../hooks/useRoleAccess'

interface TenantSettings {
  id: string
  name: string
  domain: string
  planType: string
  maxExtensions: number
  maxConcurrentCalls: number
  features: string
  isActive: boolean
}

const SettingsPage: React.FC = () => {
  const { user, token } = useAuthStore()
  const { permissions, hasRole } = useRoleAccess()
  const [tenantSettings, setTenantSettings] = useState<TenantSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchTenantSettings()
  }, [])

  const fetchTenantSettings = async () => {
    try {
      const response = await fetch(`http://localhost:3002/api/tenants/${user?.tenantId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setTenantSettings(data.data)
      } else {
        setError('Failed to fetch tenant settings')
      }
    } catch (err) {
      setError('Error fetching tenant settings')
    } finally {
      setLoading(false)
    }
  }

  const updateTenantSettings = async (updatedSettings: Partial<TenantSettings>) => {
    try {
      const response = await fetch(`http://localhost:3002/api/tenants/${user?.tenantId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedSettings)
      })

      if (response.ok) {
        const data = await response.json()
        setTenantSettings(data.data)
        setSuccess('Settings updated successfully')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        setError('Failed to update settings')
      }
    } catch (err) {
      setError('Error updating settings')
    }
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (tenantSettings) {
      updateTenantSettings(tenantSettings)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const featuresArray = tenantSettings?.features ? JSON.parse(tenantSettings.features) : []

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {hasRole('superadmin') ? 'Platform Settings' :
           hasRole(['company_admin', 'supervisor']) ? 'Admin Settings' :
           'User Settings'}
        </h1>
        <p className="mt-2 text-gray-600">
          {hasRole('superadmin') ? 'Manage platform-wide configuration and features' :
           hasRole(['company_admin', 'supervisor']) ? 'Manage your cloud call center configuration and features' :
           'Manage your personal settings and preferences'}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Settings */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">
              {permissions.canManageSettings ? 'Organization Settings' : 'Personal Settings'}
            </h2>

            <form onSubmit={handleSave}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {permissions.canManageSettings ? 'Organization Name' : 'Display Name'}
                  </label>
                  <input
                    type="text"
                    value={permissions.canManageSettings ? (tenantSettings?.name || '') : `${user?.firstName} ${user?.lastName}`}
                    onChange={(e) => {
                      if (permissions.canManageSettings) {
                        setTenantSettings(prev => prev ? {...prev, name: e.target.value} : null)
                      }
                    }}
                    disabled={!permissions.canManageSettings}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                      !permissions.canManageSettings ? 'bg-gray-50 text-gray-500' : ''
                    }`}
                  />
                </div>

                {permissions.canManageSettings ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Domain
                    </label>
                    <input
                      type="text"
                      value={tenantSettings?.domain || ''}
                      onChange={(e) => setTenantSettings(prev => prev ? {...prev, domain: e.target.value} : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Plan Type
                  </label>
                  <select
                    value={tenantSettings?.planType || 'basic'}
                    onChange={(e) => setTenantSettings(prev => prev ? {...prev, planType: e.target.value} : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="basic">Basic ($29/month)</option>
                    <option value="professional">Professional ($49/month)</option>
                    <option value="enterprise">Enterprise ($99/month)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Extensions
                  </label>
                  <input
                    type="number"
                    value={tenantSettings?.maxExtensions || 0}
                    onChange={(e) => setTenantSettings(prev => prev ? {...prev, maxExtensions: parseInt(e.target.value)} : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Concurrent Calls
                  </label>
                  <input
                    type="number"
                    value={tenantSettings?.maxConcurrentCalls || 0}
                    onChange={(e) => setTenantSettings(prev => prev ? {...prev, maxConcurrentCalls: parseInt(e.target.value)} : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={tenantSettings?.isActive || false}
                      onChange={(e) => setTenantSettings(prev => prev ? {...prev, isActive: e.target.checked} : null)}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700">Organization Active</span>
                  </label>
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>

          {/* SIP Server Management */}
          <div className="bg-white shadow rounded-lg p-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">SIP Server Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SIP Domain
                </label>
                <input
                  type="text"
                  value="192.168.1.38.pbx.local"
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SIP Server Port
                </label>
                <input
                  type="text"
                  value="5060"
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Server IP
                </label>
                <input
                  type="text"
                  value="192.168.1.38"
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transport Protocol
                </label>
                <input
                  type="text"
                  value="UDP"
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <h4 className="text-sm font-medium text-blue-900 mb-2">📱 Mobile SIP Setup</h4>
              <p className="text-sm text-blue-700">
                Extensions are ready for mobile SIP apps. Users can view their SIP credentials
                in the Extensions page and configure mobile apps like Linphone or Zoiper.
              </p>
              <div className="mt-2">
                <a
                  href="/get-sip-credentials.html"
                  target="_blank"
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  📋 View Mobile Setup Guide
                </a>
              </div>
            </div>
          </div>

          {/* Features Configuration */}
          <div className="bg-white shadow rounded-lg p-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">Enabled Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {featuresArray.map((feature: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <div>
                    <span className="font-medium text-gray-900">{feature.name.replace('_', ' ').toUpperCase()}</span>
                  </div>
                  <div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      feature.enabled
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {feature.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* System Overview */}
        <div className="space-y-6">
          {/* System Status */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">System Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Server Status</span>
                <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Online</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Database</span>
                <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Connected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">WebSocket</span>
                <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">SIP Server</span>
                <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Running (Port 5060)</span>
              </div>
            </div>
          </div>

          {/* SIP Configuration */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">SIP Configuration</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">SIP Domain</span>
                <span className="text-sm text-gray-900">192.168.1.38.pbx.local</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">SIP Proxy</span>
                <span className="text-sm text-gray-900">192.168.1.38:5060</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Transport</span>
                <span className="text-sm text-gray-900">UDP</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Extensions Ready</span>
                <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Mobile SIP Apps</span>
              </div>
            </div>
          </div>

          {/* Implemented Features */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Implemented Features</h3>
            <div className="space-y-2">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-700">Authentication & Authorization</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-700">User Management</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-700">Extension Management</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-700">Call Management</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-700">Real-time Dashboard</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-700">Multi-tenant Architecture</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-700">Queue Management</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-700">Billing System</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-700">Payment Processing</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-700">SIP Integration</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-700">Call Recording (Planned)</span>
              </div>
            </div>
          </div>

          {/* Technology Stack */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Technology Stack</h3>
            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-medium text-gray-700">Backend:</span>
                <span className="text-gray-600 ml-1">Node.js + Express + TypeScript</span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-700">Frontend:</span>
                <span className="text-gray-600 ml-1">React 18 + TypeScript + Tailwind CSS</span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-700">Database:</span>
                <span className="text-gray-600 ml-1">SQLite + Prisma ORM</span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-700">Real-time:</span>
                <span className="text-gray-600 ml-1">Socket.IO</span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-700">Authentication:</span>
                <span className="text-gray-600 ml-1">JWT + bcrypt</span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-700">Payment:</span>
                <span className="text-gray-600 ml-1">Stripe + PayPal</span>
              </div>
              <div className="text-sm">
                <span className="font-medium text-gray-700">SIP Server:</span>
                <span className="text-gray-600 ml-1">UDP Socket + Digest Auth</span>
              </div>
            </div>
          </div>

          {/* API Endpoints */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Available API Routes</h3>
            <div className="space-y-2 text-sm">
              <div className="text-green-600">/api/auth/* - Authentication</div>
              <div className="text-green-600">/api/users/* - User Management</div>
              <div className="text-green-600">/api/extensions/* - Extensions + SIP</div>
              <div className="text-green-600">/api/calls/* - Call Management</div>
              <div className="text-green-600">/api/queues/* - Queue Management</div>
              <div className="text-green-600">/api/tenants/* - Tenant Settings</div>
              <div className="text-green-600">/api/subscription/* - Billing</div>
              <div className="text-green-600">/api/payments/* - Payments</div>
              <div className="text-green-600">/api/invoices/* - Invoices</div>
              <div className="text-green-600">/api/billing-cycle/* - Billing Cycles</div>
              <div className="text-green-600">/api/reports/* - Payment Reports</div>
              <div className="text-green-600">/api/payment-retry/* - Payment Retries</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage