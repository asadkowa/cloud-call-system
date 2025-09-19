import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { api } from '../services/api'
import toast from 'react-hot-toast'

interface AdminConfiguration {
  systemMaintenance: {
    enabled: boolean
    message: string
    allowedRoles: string[]
  }
  security: {
    passwordPolicy: {
      minLength: number
      requireUppercase: boolean
      requireLowercase: boolean
      requireNumbers: boolean
      requireSpecialChars: boolean
    }
    sessionTimeout: number
    maxLoginAttempts: number
    lockoutDuration: number
  }
  notifications: {
    emailEnabled: boolean
    smsEnabled: boolean
    webhookEnabled: boolean
    defaultEmailTemplates: string[]
  }
  apiLimits: {
    rateLimit: number
    burstLimit: number
    maxPayloadSize: number
  }
  paymentMethods: {
    paypal: {
      enabled: boolean
      clientId: string
      clientSecret: string
      sandboxMode: boolean
      webhookId: string
    }
    stripe: {
      enabled: boolean
      publishableKey: string
      secretKey: string
      webhookSecret: string
    }
  }
}

const AdminConfigurationPage: React.FC = () => {
  const { user, token } = useAuthStore()
  const [config, setConfig] = useState<AdminConfiguration | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState('maintenance')

  useEffect(() => {
    if (user?.role === 'superadmin') {
      fetchConfiguration()
    }
  }, [user])

  const fetchConfiguration = async () => {
    try {
      setLoading(true)
      console.log('Fetching admin configuration...')
      const response = await api.get('/superadmin/config')
      console.log('Admin config response:', response.data)

      if (response.data.success) {
        setConfig(response.data.data)
        console.log('Admin config loaded successfully:', response.data.data)
      } else {
        console.error('Failed to fetch config:', response.data.error)
        toast.error('Failed to load configuration: ' + (response.data.error || 'Unknown error'))
      }
    } catch (error: any) {
      console.error('Error fetching configuration:', error)
      toast.error('Failed to load configuration: ' + (error.response?.data?.error || error.message || 'Network error'))
    } finally {
      setLoading(false)
    }
  }

  const updateConfiguration = async (section: string, data: any) => {
    try {
      setSaving(true)

      // Update local state immediately for better UX
      const updatedConfig = { ...config, [section]: { ...config?.[section as keyof AdminConfiguration], ...data } }
      setConfig(updatedConfig)

      // Send update to API
      console.log('Updating admin configuration:', { [section]: data })
      const response = await api.put('/superadmin/config', { [section]: data })

      if (response.data.success) {
        console.log('Configuration updated successfully:', response.data)
        toast.success('Configuration updated successfully')
      } else {
        console.error('Failed to update config:', response.data.error)
        toast.error('Failed to update configuration: ' + (response.data.error || 'Unknown error'))
        // Revert local state on error
        await fetchConfiguration()
      }
    } catch (error: any) {
      console.error('Error updating configuration:', error)
      toast.error('Failed to update configuration: ' + (error.response?.data?.error || error.message || 'Network error'))
      // Revert local state on error
      await fetchConfiguration()
    } finally {
      setSaving(false)
    }
  }

  if (user?.role !== 'superadmin') {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">Access denied. SuperAdmin privileges required.</div>
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

  const sections = [
    { id: 'maintenance', name: 'System Maintenance', icon: '🔧' },
    { id: 'security', name: 'Security Policies', icon: '🔒' },
    { id: 'notifications', name: 'Notifications', icon: '📧' },
    { id: 'payments', name: 'Payment Methods', icon: '💳' },
    { id: 'api', name: 'API Configuration', icon: '⚡' }
  ]

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Configuration</h1>
        <p className="mt-2 text-gray-600">Advanced system configuration and policies</p>
      </div>

      {/* Section Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeSection === section.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{section.icon}</span>
              <span>{section.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* System Maintenance Section */}
      {activeSection === 'maintenance' && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Maintenance Mode</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">Enable Maintenance Mode</label>
                  <p className="text-sm text-gray-500">Block access to all users except SuperAdmins</p>
                </div>
                <button
                  onClick={() => updateConfiguration('systemMaintenance', {
                    enabled: !config?.systemMaintenance.enabled
                  })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    config?.systemMaintenance.enabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config?.systemMaintenance.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maintenance Message
                </label>
                <textarea
                  value={config?.systemMaintenance.message || ''}
                  onChange={(e) => updateConfiguration('systemMaintenance', { message: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="Enter maintenance message..."
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Policies Section */}
      {activeSection === 'security' && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Password Policy</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Length
                </label>
                <input
                  type="number"
                  value={config?.security.passwordPolicy.minLength || 8}
                  onChange={(e) => updateConfiguration('security', {
                    passwordPolicy: { ...config?.security.passwordPolicy, minLength: parseInt(e.target.value) }
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  min="6"
                  max="32"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Session Timeout (seconds)
                </label>
                <input
                  type="number"
                  value={config?.security.sessionTimeout || 3600}
                  onChange={(e) => updateConfiguration('security', {
                    sessionTimeout: parseInt(e.target.value)
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Login Attempts
                </label>
                <input
                  type="number"
                  value={config?.security.maxLoginAttempts || 5}
                  onChange={(e) => updateConfiguration('security', {
                    maxLoginAttempts: parseInt(e.target.value)
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  min="3"
                  max="10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lockout Duration (seconds)
                </label>
                <input
                  type="number"
                  value={config?.security.lockoutDuration || 900}
                  onChange={(e) => updateConfiguration('security', {
                    lockoutDuration: parseInt(e.target.value)
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label className="block text-sm font-medium text-gray-700">Password Requirements</label>
              {[
                { key: 'requireUppercase', label: 'Require uppercase letters' },
                { key: 'requireLowercase', label: 'Require lowercase letters' },
                { key: 'requireNumbers', label: 'Require numbers' },
                { key: 'requireSpecialChars', label: 'Require special characters' }
              ].map((req) => (
                <div key={req.key} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config?.security.passwordPolicy[req.key as keyof typeof config.security.passwordPolicy] || false}
                    onChange={(e) => updateConfiguration('security', {
                      passwordPolicy: {
                        ...config?.security.passwordPolicy,
                        [req.key]: e.target.checked
                      }
                    })}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700">{req.label}</label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Notifications Section */}
      {activeSection === 'notifications' && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Settings</h3>
            <div className="space-y-4">
              {[
                { key: 'emailEnabled', label: 'Email Notifications', desc: 'Send notifications via email' },
                { key: 'smsEnabled', label: 'SMS Notifications', desc: 'Send notifications via SMS' },
                { key: 'webhookEnabled', label: 'Webhook Notifications', desc: 'Send notifications via webhooks' }
              ].map((setting) => (
                <div key={setting.key} className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">{setting.label}</label>
                    <p className="text-sm text-gray-500">{setting.desc}</p>
                  </div>
                  <button
                    onClick={() => updateConfiguration('notifications', {
                      [setting.key]: !config?.notifications[setting.key as keyof typeof config.notifications]
                    })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config?.notifications[setting.key as keyof typeof config.notifications] ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config?.notifications[setting.key as keyof typeof config.notifications] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payment Methods Section */}
      {activeSection === 'payments' && (
        <div className="space-y-6">
          {/* PayPal Configuration */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">PayPal Configuration</h3>
              <button
                onClick={() => updateConfiguration('paymentMethods', {
                  paypal: { ...config?.paymentMethods.paypal, enabled: !config?.paymentMethods.paypal.enabled }
                })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config?.paymentMethods.paypal.enabled ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config?.paymentMethods.paypal.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client ID
                </label>
                <input
                  type="text"
                  value={config?.paymentMethods.paypal.clientId || ''}
                  onChange={(e) => updateConfiguration('paymentMethods', {
                    paypal: { ...config?.paymentMethods.paypal, clientId: e.target.value }
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="PayPal Client ID"
                  disabled={!config?.paymentMethods.paypal.enabled}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Secret
                </label>
                <input
                  type="password"
                  value={config?.paymentMethods.paypal.clientSecret || ''}
                  onChange={(e) => updateConfiguration('paymentMethods', {
                    paypal: { ...config?.paymentMethods.paypal, clientSecret: e.target.value }
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="PayPal Client Secret"
                  disabled={!config?.paymentMethods.paypal.enabled}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Webhook ID
                </label>
                <input
                  type="text"
                  value={config?.paymentMethods.paypal.webhookId || ''}
                  onChange={(e) => updateConfiguration('paymentMethods', {
                    paypal: { ...config?.paymentMethods.paypal, webhookId: e.target.value }
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="PayPal Webhook ID"
                  disabled={!config?.paymentMethods.paypal.enabled}
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={config?.paymentMethods.paypal.sandboxMode || false}
                  onChange={(e) => updateConfiguration('paymentMethods', {
                    paypal: { ...config?.paymentMethods.paypal, sandboxMode: e.target.checked }
                  })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  disabled={!config?.paymentMethods.paypal.enabled}
                />
                <label className="ml-2 text-sm text-gray-700">
                  Sandbox Mode (for testing)
                </label>
              </div>
            </div>
          </div>

          {/* Stripe Configuration */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Stripe Configuration</h3>
              <button
                onClick={() => updateConfiguration('paymentMethods', {
                  stripe: { ...config?.paymentMethods.stripe, enabled: !config?.paymentMethods.stripe.enabled }
                })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config?.paymentMethods.stripe.enabled ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config?.paymentMethods.stripe.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Publishable Key
                </label>
                <input
                  type="text"
                  value={config?.paymentMethods.stripe.publishableKey || ''}
                  onChange={(e) => updateConfiguration('paymentMethods', {
                    stripe: { ...config?.paymentMethods.stripe, publishableKey: e.target.value }
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="pk_test_..."
                  disabled={!config?.paymentMethods.stripe.enabled}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Secret Key
                </label>
                <input
                  type="password"
                  value={config?.paymentMethods.stripe.secretKey || ''}
                  onChange={(e) => updateConfiguration('paymentMethods', {
                    stripe: { ...config?.paymentMethods.stripe, secretKey: e.target.value }
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="sk_test_..."
                  disabled={!config?.paymentMethods.stripe.enabled}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Webhook Secret
                </label>
                <input
                  type="password"
                  value={config?.paymentMethods.stripe.webhookSecret || ''}
                  onChange={(e) => updateConfiguration('paymentMethods', {
                    stripe: { ...config?.paymentMethods.stripe, webhookSecret: e.target.value }
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="whsec_..."
                  disabled={!config?.paymentMethods.stripe.enabled}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API Configuration Section */}
      {activeSection === 'api' && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">API Limits & Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rate Limit (requests/hour)
                </label>
                <input
                  type="number"
                  value={config?.apiLimits.rateLimit || 1000}
                  onChange={(e) => updateConfiguration('apiLimits', {
                    ...config?.apiLimits,
                    rateLimit: parseInt(e.target.value)
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Burst Limit (requests/minute)
                </label>
                <input
                  type="number"
                  value={config?.apiLimits.burstLimit || 100}
                  onChange={(e) => updateConfiguration('apiLimits', {
                    ...config?.apiLimits,
                    burstLimit: parseInt(e.target.value)
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Payload Size (bytes)
                </label>
                <input
                  type="number"
                  value={config?.apiLimits.maxPayloadSize || 10485760}
                  onChange={(e) => updateConfiguration('apiLimits', {
                    ...config?.apiLimits,
                    maxPayloadSize: parseInt(e.target.value)
                  })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={() => toast.success('All configurations are auto-saved')}
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
        >
          {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
          <span>{saving ? 'Saving...' : 'Configurations Auto-Saved'}</span>
        </button>
      </div>
    </div>
  )
}

export default AdminConfigurationPage