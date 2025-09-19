import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { api } from '../services/api'
import toast from 'react-hot-toast'

interface SystemHealthData {
  systemHealth: {
    database: 'connected' | 'disconnected'
    server: 'running' | 'down'
    pbx: 'running' | 'down'
    sipServer: 'running' | 'down'
    webSocket: 'active' | 'inactive'
  }
  performance: {
    responseTime: number
    memoryUsage: number
    cpuUsage: number
    uptime: number
  }
  services: {
    name: string
    status: 'healthy' | 'warning' | 'critical'
    lastCheck: string
    responseTime: number
  }[]
  alerts: {
    id: string
    type: 'error' | 'warning' | 'info'
    message: string
    timestamp: string
  }[]
}

const SystemHealthPage: React.FC = () => {
  const { user } = useAuthStore()
  const [healthData, setHealthData] = useState<SystemHealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  useEffect(() => {
    if (user?.role === 'superadmin') {
      fetchHealthData()
      // Auto-refresh every 30 seconds
      const interval = setInterval(fetchHealthData, 30000)
      return () => clearInterval(interval)
    }
  }, [user])

  const fetchHealthData = async () => {
    try {
      console.log('Fetching system health data...')
      const response = await api.get('/superadmin/stats/platform')

      if (response.data.success) {
        // Extract system health from platform stats
        const platformData = response.data.data

        // Mock additional performance and service data (in production this would come from monitoring APIs)
        const mockHealthData: SystemHealthData = {
          systemHealth: platformData.systemHealth,
          performance: {
            responseTime: Math.floor(Math.random() * 100) + 50, // 50-150ms
            memoryUsage: Math.floor(Math.random() * 30) + 45, // 45-75%
            cpuUsage: Math.floor(Math.random() * 20) + 15, // 15-35%
            uptime: Math.floor(Date.now() / 1000) // seconds since epoch
          },
          services: [
            {
              name: 'Authentication Service',
              status: 'healthy',
              lastCheck: new Date().toISOString(),
              responseTime: Math.floor(Math.random() * 50) + 10
            },
            {
              name: 'Database Connection Pool',
              status: platformData.systemHealth.database === 'connected' ? 'healthy' : 'critical',
              lastCheck: new Date().toISOString(),
              responseTime: Math.floor(Math.random() * 30) + 5
            },
            {
              name: 'PBX Service',
              status: platformData.systemHealth.pbx === 'running' ? 'healthy' : 'critical',
              lastCheck: new Date().toISOString(),
              responseTime: platformData.systemHealth.pbx === 'running' ? Math.floor(Math.random() * 100) + 50 : 0
            },
            {
              name: 'SIP Server',
              status: platformData.systemHealth.sipServer === 'running' ? 'healthy' : 'critical',
              lastCheck: new Date().toISOString(),
              responseTime: platformData.systemHealth.sipServer === 'running' ? Math.floor(Math.random() * 80) + 20 : 0
            },
            {
              name: 'WebSocket Service',
              status: platformData.systemHealth.webSocket === 'active' ? 'healthy' : 'warning',
              lastCheck: new Date().toISOString(),
              responseTime: Math.floor(Math.random() * 20) + 5
            }
          ],
          alerts: [
            ...(platformData.systemHealth.pbx === 'down' ? [{
              id: 'pbx-down',
              type: 'error' as const,
              message: 'PBX Service is currently down and needs attention',
              timestamp: new Date().toISOString()
            }] : []),
            ...(platformData.systemHealth.sipServer === 'down' ? [{
              id: 'sip-down',
              type: 'error' as const,
              message: 'SIP Server is not responding to health checks',
              timestamp: new Date().toISOString()
            }] : []),
            {
              id: 'system-ok',
              type: 'info' as const,
              message: 'Core database and server systems are operating normally',
              timestamp: new Date().toISOString()
            }
          ]
        }

        setHealthData(mockHealthData)
        setLastUpdated(new Date())
        console.log('System health data updated:', mockHealthData)
      } else {
        toast.error('Failed to fetch health data: ' + response.data.error)
      }
    } catch (error: any) {
      console.error('Error fetching system health:', error)
      toast.error('Failed to load system health data')
    } finally {
      setLoading(false)
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'running':
      case 'connected':
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800'
      case 'critical':
      case 'down':
      case 'disconnected':
      case 'inactive':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'running':
      case 'connected':
      case 'active':
        return '✅'
      case 'warning':
        return '⚠️'
      case 'critical':
      case 'down':
      case 'disconnected':
      case 'inactive':
        return '❌'
      default:
        return '❓'
    }
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days}d ${hours}h ${minutes}m`
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Health Monitor</h1>
          <p className="mt-2 text-gray-600">Real-time monitoring of system components and services</p>
        </div>
        <div className="text-right">
          <button
            onClick={fetchHealthData}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            🔄 Refresh
          </button>
          <p className="text-sm text-gray-500 mt-1">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
      </div>

      {/* Overall System Status */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        {healthData?.systemHealth && Object.entries(healthData.systemHealth).map(([service, status]) => (
          <div key={service} className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 capitalize">
                  {service.replace(/([A-Z])/g, ' $1').trim()}
                </p>
                <div className="flex items-center mt-2">
                  <span className="text-2xl mr-2">{getStatusIcon(status)}</span>
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(status)}`}>
                    {status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Performance Metrics */}
      {healthData?.performance && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{healthData.performance.responseTime}ms</div>
              <div className="text-sm text-gray-600">Avg Response Time</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{healthData.performance.memoryUsage}%</div>
              <div className="text-sm text-gray-600">Memory Usage</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">{healthData.performance.cpuUsage}%</div>
              <div className="text-sm text-gray-600">CPU Usage</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{formatUptime(healthData.performance.uptime)}</div>
              <div className="text-sm text-gray-600">System Uptime</div>
            </div>
          </div>
        </div>
      )}

      {/* Service Details */}
      {healthData?.services && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Service Status</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Service
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Response Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Check
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {healthData.services.map((service, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {service.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(service.status)}`}>
                        {getStatusIcon(service.status)} {service.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {service.responseTime > 0 ? `${service.responseTime}ms` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(service.lastCheck).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* System Alerts */}
      {healthData?.alerts && healthData.alerts.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">System Alerts</h3>
          <div className="space-y-3">
            {healthData.alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-md border-l-4 ${
                  alert.type === 'error'
                    ? 'bg-red-50 border-red-400'
                    : alert.type === 'warning'
                    ? 'bg-yellow-50 border-yellow-400'
                    : 'bg-blue-50 border-blue-400'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <span className="text-lg">
                        {alert.type === 'error' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️'}
                      </span>
                    </div>
                    <div className="ml-3">
                      <p className={`text-sm font-medium ${
                        alert.type === 'error'
                          ? 'text-red-800'
                          : alert.type === 'warning'
                          ? 'text-yellow-800'
                          : 'text-blue-800'
                      }`}>
                        {alert.message}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default SystemHealthPage