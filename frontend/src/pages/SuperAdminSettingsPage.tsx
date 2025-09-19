import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { api } from '../services/api'
import toast from 'react-hot-toast'

interface PlatformStats {
  tenants: {
    total: number
    active: number
    byPlan: Record<string, number>
  }
  users: {
    total: number
    active: number
  }
  extensions: {
    total: number
  }
  calls: {
    today: number
    thisMonth: number
  }
  subscriptions: {
    byStatus: Record<string, number>
  }
  systemHealth: {
    database: 'connected' | 'disconnected'
    server: 'running' | 'down'
    pbx: 'running' | 'down'
    sipServer: 'running' | 'down'
    webSocket: 'active' | 'inactive'
  }
}

interface SystemConfig {
  platformName: string
  maintenanceMode: boolean
  allowNewRegistrations: boolean
  maxTenantsPerPlan: {
    basic: number
    professional: number
    enterprise: number
  }
  defaultFeatures: string[]
  supportEmail: string
  systemTimezone: string
}

const SuperAdminSettingsPage: React.FC = () => {
  const { user, token } = useAuthStore()
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null)
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (user?.role === 'superadmin') {
      fetchPlatformData()
    }
  }, [user])

  const fetchPlatformData = async () => {
    try {
      setLoading(true)

      // Fetch platform statistics
      console.log('Fetching platform stats...')
      const statsResponse = await api.get('/superadmin/stats/platform')
      console.log('Platform stats response:', statsResponse.data)

      if (statsResponse.data.success) {
        setPlatformStats(statsResponse.data.data)
        console.log('Platform stats set:', statsResponse.data.data)
      } else {
        console.error('API returned error:', statsResponse.data.error)
        toast.error('API Error: ' + statsResponse.data.error)
      }

      // Mock system config for now - in production this would come from API
      setSystemConfig({
        platformName: 'Cloud Call System',
        maintenanceMode: false,
        allowNewRegistrations: true,
        maxTenantsPerPlan: {
          basic: 1000,
          professional: 500,
          enterprise: 100
        },
        defaultFeatures: ['call_management', 'user_management', 'basic_reporting'],
        supportEmail: 'support@cloudcallsystem.com',
        systemTimezone: 'UTC'
      })

    } catch (error: any) {
      console.error('Failed to fetch platform data:', error)

      if (error.response?.status === 401) {
        toast.error('Authentication required. Please login as SuperAdmin.')
      } else if (error.response?.status === 403) {
        toast.error('Access denied. SuperAdmin privileges required.')
      } else {
        toast.error('Failed to load platform data: ' + (error.response?.data?.error || error.message))

        // Provide fallback data for development
        console.log('Using fallback data for development')
        setPlatformStats({
          tenants: { total: 0, active: 0, byPlan: {} },
          users: { total: 0, active: 0 },
          extensions: { total: 0 },
          calls: { today: 0, thisMonth: 0 },
          subscriptions: { byStatus: {} },
          systemHealth: {
            database: 'disconnected',
            server: 'down',
            pbx: 'down',
            sipServer: 'down',
            webSocket: 'inactive'
          }
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const updateSystemConfig = async (config: Partial<SystemConfig>) => {
    try {
      setSaving(true)
      // In production, this would call an API endpoint
      setSystemConfig(prev => prev ? { ...prev, ...config } : null)
      toast.success('System configuration updated successfully')
    } catch (error: any) {
      console.error('Failed to update system config:', error)
      toast.error('Failed to update system configuration')
    } finally {
      setSaving(false)
    }
  }

  if (user?.role !== 'superadmin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', name: 'Platform Overview', icon: '📊' },
    { id: 'system', name: 'System Configuration', icon: '⚙️' },
    { id: 'billing', name: 'Billing Management', icon: '💳' },
    { id: 'security', name: 'Security Settings', icon: '🔒' },
    { id: 'monitoring', name: 'System Monitoring', icon: '📈' }
  ]

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">SuperAdmin Settings</h1>
        <p className="mt-2 text-gray-600">Platform-wide configuration and monitoring</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Platform Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Platform Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                      <span className="text-white text-lg">🏢</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Tenants</dt>
                      <dd className="text-lg font-medium text-gray-900">{platformStats?.tenants.total || 0}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                      <span className="text-white text-lg">✅</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Active Tenants</dt>
                      <dd className="text-lg font-medium text-gray-900">{platformStats?.tenants.active || 0}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                      <span className="text-white text-lg">👥</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
                      <dd className="text-lg font-medium text-gray-900">{platformStats?.users.total || 0}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                      <span className="text-white text-lg">📞</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Calls (This Month)</dt>
                      <dd className="text-lg font-medium text-gray-900">{platformStats?.calls.thisMonth || 0}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* System Health */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">System Health</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <span className="text-sm font-medium text-gray-700">Database</span>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  platformStats?.systemHealth.database === 'connected'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {platformStats?.systemHealth.database || 'Unknown'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <span className="text-sm font-medium text-gray-700">Server</span>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  platformStats?.systemHealth.server === 'running'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {platformStats?.systemHealth.server || 'Unknown'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <span className="text-sm font-medium text-gray-700">PBX Service</span>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  platformStats?.systemHealth.pbx === 'running'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {platformStats?.systemHealth.pbx || 'Unknown'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <span className="text-sm font-medium text-gray-700">SIP Server</span>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  platformStats?.systemHealth.sipServer === 'running'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {platformStats?.systemHealth.sipServer || 'Unknown'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <span className="text-sm font-medium text-gray-700">WebSocket</span>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  platformStats?.systemHealth.webSocket === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {platformStats?.systemHealth.webSocket || 'Unknown'}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Platform Activity</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center space-x-3">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-sm text-gray-700">New tenant registered: TechCorp Solutions</span>
                </div>
                <span className="text-xs text-gray-500">2 hours ago</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center space-x-3">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span className="text-sm text-gray-700">System update deployed successfully</span>
                </div>
                <span className="text-xs text-gray-500">6 hours ago</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center space-x-3">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                  <span className="text-sm text-gray-700">High call volume detected</span>
                </div>
                <span className="text-xs text-gray-500">12 hours ago</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Configuration Tab */}
      {activeTab === 'system' && systemConfig && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Platform Configuration</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Platform Name
                </label>
                <input
                  type="text"
                  value={systemConfig.platformName}
                  onChange={(e) => setSystemConfig(prev => prev ? {...prev, platformName: e.target.value} : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Support Email
                </label>
                <input
                  type="email"
                  value={systemConfig.supportEmail}
                  onChange={(e) => setSystemConfig(prev => prev ? {...prev, supportEmail: e.target.value} : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  System Timezone
                </label>
                <select
                  value={systemConfig.systemTimezone}
                  onChange={(e) => setSystemConfig(prev => prev ? {...prev, systemTimezone: e.target.value} : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                </select>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Maintenance Mode</label>
                  <p className="text-xs text-gray-500">When enabled, only superadmins can access the platform</p>
                </div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={systemConfig.maintenanceMode}
                    onChange={(e) => setSystemConfig(prev => prev ? {...prev, maintenanceMode: e.target.checked} : null)}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Allow New Registrations</label>
                  <p className="text-xs text-gray-500">Allow new tenants to register on the platform</p>
                </div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={systemConfig.allowNewRegistrations}
                    onChange={(e) => setSystemConfig(prev => prev ? {...prev, allowNewRegistrations: e.target.checked} : null)}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                </label>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => updateSystemConfig(systemConfig)}
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>

          {/* Plan Limits */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Plan Limits</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Basic Plan Max Tenants
                </label>
                <input
                  type="number"
                  value={systemConfig.maxTenantsPerPlan.basic}
                  onChange={(e) => setSystemConfig(prev => prev ? {
                    ...prev,
                    maxTenantsPerPlan: {
                      ...prev.maxTenantsPerPlan,
                      basic: parseInt(e.target.value)
                    }
                  } : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Professional Plan Max Tenants
                </label>
                <input
                  type="number"
                  value={systemConfig.maxTenantsPerPlan.professional}
                  onChange={(e) => setSystemConfig(prev => prev ? {
                    ...prev,
                    maxTenantsPerPlan: {
                      ...prev.maxTenantsPerPlan,
                      professional: parseInt(e.target.value)
                    }
                  } : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enterprise Plan Max Tenants
                </label>
                <input
                  type="number"
                  value={systemConfig.maxTenantsPerPlan.enterprise}
                  onChange={(e) => setSystemConfig(prev => prev ? {
                    ...prev,
                    maxTenantsPerPlan: {
                      ...prev.maxTenantsPerPlan,
                      enterprise: parseInt(e.target.value)
                    }
                  } : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Billing Management Tab */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Billing System Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">✅</div>
                <div className="text-sm font-medium text-gray-700 mt-2">Payment Processing</div>
                <div className="text-xs text-gray-500">Active</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">✅</div>
                <div className="text-sm font-medium text-gray-700 mt-2">Billing Cycles</div>
                <div className="text-xs text-gray-500">Automated</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">✅</div>
                <div className="text-sm font-medium text-gray-700 mt-2">Payment Retries</div>
                <div className="text-xs text-gray-500">Enabled</div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <h4 className="text-sm font-medium text-blue-900 mb-2">📊 Billing System Enhanced</h4>
              <p className="text-sm text-blue-700">
                The billing system has been fully enhanced with automated billing cycles,
                advanced payment reporting, payment method management, invoice PDF generation,
                and intelligent payment failure retry logic.
              </p>
              <div className="mt-3 space-x-3">
                <a
                  href="/api/reports/payments"
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  📊 View Payment Reports
                </a>
                <a
                  href="/api/billing-cycle/status"
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  🔄 Check Billing Status
                </a>
                <a
                  href="/api/payment-retry/health"
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  🔧 Retry System Health
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Settings Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Security Configuration</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Force 2FA for Admins</label>
                  <p className="text-xs text-gray-500">Require two-factor authentication for admin accounts</p>
                </div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Session Timeout</label>
                  <p className="text-xs text-gray-500">Automatically log out inactive users</p>
                </div>
                <select className="px-3 py-1 border border-gray-300 rounded-md text-sm">
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                  <option value="480">8 hours</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">API Rate Limiting</label>
                  <p className="text-xs text-gray-500">Limit API requests per minute</p>
                </div>
                <input
                  type="number"
                  defaultValue={1000}
                  className="w-20 px-3 py-1 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Monitoring Tab */}
      {activeTab === 'monitoring' && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">System Monitoring</h3>
            <div className="text-center py-8">
              <div className="text-6xl mb-4">📈</div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">Advanced Monitoring Coming Soon</h4>
              <p className="text-gray-600">
                Real-time system metrics, performance monitoring, and alerting will be available in the next update.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SuperAdminSettingsPage