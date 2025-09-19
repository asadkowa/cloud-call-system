import React, { useState, useEffect } from 'react'
import { api } from '../services/api'

interface CallStats {
  totalCalls: number
  activeCalls: number
  callsByStatus: Record<string, number>
  callsByDirection: Record<string, number>
  averageDuration: number
  totalDuration: number
}

interface PbxStatus {
  initialized: boolean
  domain: string
  sipPort: number
  activeExtensions: number
  activeCalls: number
  maxConcurrentCalls: number
  recordingEnabled: boolean
}

interface SipExtension {
  id: string
  number: string
  domain: string
  tenantId: string
  userId?: string
  status: 'available' | 'busy' | 'offline' | 'ringing'
}

interface CallSession {
  id: string
  callId: string
  fromNumber: string
  toNumber: string
  fromExtension?: string
  toExtension?: string
  direction: 'inbound' | 'outbound' | 'internal'
  status: 'ringing' | 'answered' | 'hold' | 'transfer' | 'ended'
  startTime: string
  answerTime?: string
  endTime?: string
  tenantId: string
  recordingEnabled: boolean
}

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<CallStats | null>(null)
  const [pbxStatus, setPbxStatus] = useState<PbxStatus | null>(null)
  const [extensions, setExtensions] = useState<SipExtension[]>([])
  const [activeCalls, setActiveCalls] = useState<CallSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()

    // Refresh disabled to prevent infinite database queries during development
    // const interval = setInterval(fetchDashboardData, 5000)
    // return () => clearInterval(interval)
  }, [])

  const fetchDashboardData = async () => {
    try {
      const [statsResponse, pbxStatusResponse, extensionsResponse, callsResponse] = await Promise.all([
        api.getTodayCallStats(),
        api.getPbxStatus(),
        api.getPbxExtensions(),
        api.getPbxCalls()
      ])

      if (statsResponse.success) {
        setStats(statsResponse.data)
      }
      if (pbxStatusResponse.success) {
        setPbxStatus(pbxStatusResponse.data)
      }
      if (extensionsResponse.success) {
        setExtensions(extensionsResponse.data)
      }
      if (callsResponse.success) {
        setActiveCalls(callsResponse.data)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const getExtensionStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500'
      case 'busy': return 'bg-red-500'
      case 'ringing': return 'bg-yellow-500'
      case 'offline': return 'bg-gray-400'
      default: return 'bg-gray-400'
    }
  }

  const getCallStatusColor = (status: string) => {
    switch (status) {
      case 'ringing': return 'bg-yellow-100 text-yellow-800'
      case 'answered': return 'bg-green-100 text-green-800'
      case 'hold': return 'bg-blue-100 text-blue-800'
      case 'transfer': return 'bg-purple-100 text-purple-800'
      case 'ended': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome to your Cloud Call Center</p>
        </div>
        <div className="flex items-center space-x-4">
          {pbxStatus && (
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                pbxStatus.initialized ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className="text-sm font-medium text-gray-600">
                PBX {pbxStatus.initialized ? 'Online' : 'Offline'}
              </span>
            </div>
          )}
          <div className="text-sm text-gray-500">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Calls</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : (pbxStatus?.activeCalls || stats?.activeCalls || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Call Duration</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : formatDuration(stats?.averageDuration || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Call Time</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : formatTime(stats?.totalDuration || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Today's Calls</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : (stats?.totalCalls || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">SIP Extensions</p>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? '...' : (pbxStatus?.activeExtensions || extensions.length || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* PBX Cluster Overview */}
      {pbxStatus && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">PBX Cluster Status</h3>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${pbxStatus.initialized ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm font-medium text-gray-600">
                {pbxStatus.initialized ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Domain</p>
              <p className="text-lg font-semibold text-gray-900">{pbxStatus.domain}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">SIP Port</p>
              <p className="text-lg font-semibold text-gray-900">{pbxStatus.sipPort}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Max Concurrent Calls</p>
              <p className="text-lg font-semibold text-gray-900">{pbxStatus.maxConcurrentCalls}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Recording</p>
              <p className={`text-lg font-semibold ${pbxStatus.recordingEnabled ? 'text-green-600' : 'text-gray-900'}`}>
                {pbxStatus.recordingEnabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Active Calls ({activeCalls.length})</h3>
          <div className="space-y-3">
            {activeCalls.length > 0 ? (
              activeCalls.slice(0, 5).map((call) => (
                <div key={call.id} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      call.status === 'answered' ? 'bg-green-500' :
                      call.status === 'ringing' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{call.fromNumber} → {call.toNumber}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(call.startTime).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 text-xs rounded-full ${getCallStatusColor(call.status)}`}>
                      {call.status}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">{call.direction}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-gray-500">
                No active calls
              </div>
            )}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">SIP Extensions ({extensions.length})</h3>
          <div className="space-y-3">
            {extensions.length > 0 ? (
              extensions.slice(0, 5).map((extension) => (
                <div key={extension.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${getExtensionStatusColor(extension.status)}`}></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Extension {extension.number}</p>
                      <p className="text-xs text-gray-500">{extension.domain}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    extension.status === 'available' ? 'bg-green-100 text-green-800' :
                    extension.status === 'busy' ? 'bg-red-100 text-red-800' :
                    extension.status === 'ringing' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {extension.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-gray-500">
                No extensions registered
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage