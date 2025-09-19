import React, { useState, useEffect } from 'react'
import { api } from '../services/api'
import { useAuthStore } from '../store/authStore'

interface UserStats {
  totalCalls: number
  activeCalls: number
  missedCalls: number
  avgCallDuration: number
  todayCallTime: number
}

interface UserExtension {
  id: string
  number: string
  displayName: string
  status: string
  sipStatus?: string
}

interface UserCall {
  id: string
  fromNumber: string
  toNumber: string
  direction: 'inbound' | 'outbound'
  status: string
  startTime: string
  duration?: number
}

const UserDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<UserStats | null>(null)
  const [extension, setExtension] = useState<UserExtension | null>(null)
  const [recentCalls, setRecentCalls] = useState<UserCall[]>([])
  const [loading, setLoading] = useState(true)
  const { user: currentUser } = useAuthStore()

  useEffect(() => {
    fetchUserData()

    // Refresh disabled to prevent infinite database queries during development
    // const interval = setInterval(fetchUserData, 30000)
    // return () => clearInterval(interval)
  }, [])

  const fetchUserData = async () => {
    try {
      const [callsResponse, extensionsResponse] = await Promise.all([
        api.getCalls(10, 0).catch(() => ({ success: false, data: [] })),
        api.getExtensions().catch(() => ({ success: false, data: [] }))
      ])

      // Find user's extension
      if (extensionsResponse.success && currentUser?.extensionId) {
        const userExtension = extensionsResponse.data.find(
          (ext: any) => ext.id === currentUser.extensionId
        )
        setExtension(userExtension || null)
      }

      // Process calls data
      if (callsResponse.success) {
        const userCalls = callsResponse.data.filter((call: any) =>
          call.extensionId === currentUser?.extensionId ||
          call.agentId === currentUser?.id
        )

        setRecentCalls(userCalls.slice(0, 5))

        // Calculate stats
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const todayCalls = userCalls.filter((call: any) =>
          new Date(call.startTime) >= today
        )

        const activeCalls = userCalls.filter((call: any) =>
          ['ringing', 'answered'].includes(call.status)
        ).length

        const completedCalls = todayCalls.filter((call: any) =>
          call.status === 'completed' && call.duration
        )

        const totalDuration = completedCalls.reduce((sum: number, call: any) =>
          sum + (call.duration || 0), 0
        )

        const avgDuration = completedCalls.length > 0
          ? Math.round(totalDuration / completedCalls.length)
          : 0

        const missedCalls = todayCalls.filter((call: any) =>
          call.status === 'missed' || call.status === 'no_answer'
        ).length

        setStats({
          totalCalls: todayCalls.length,
          activeCalls,
          missedCalls,
          avgCallDuration: avgDuration,
          todayCallTime: Math.round(totalDuration / 60) // Convert to minutes
        })
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString()
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'available':
      case 'active':
      case 'completed': return 'text-green-600'
      case 'busy':
      case 'answered': return 'text-blue-600'
      case 'ringing': return 'text-yellow-600'
      case 'missed':
      case 'offline': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getCallDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'inbound': return '📞'
      case 'outbound': return '📱'
      default: return '☎️'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
          <p className="text-gray-600">Welcome back, {currentUser?.firstName}!</p>
        </div>
        <div className="text-sm text-gray-500">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Extension Status */}
      {extension && (
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">My Extension</h3>
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-xl">📞</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <h4 className="text-lg font-semibold text-gray-900">
                  Extension {extension.number}
                </h4>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  extension.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {extension.status}
                </span>
                {extension.sipStatus && (
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    extension.sipStatus === 'available' ? 'bg-green-100 text-green-800' :
                    extension.sipStatus === 'busy' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    SIP: {extension.sipStatus}
                  </span>
                )}
              </div>
              <p className="text-gray-600">{extension.displayName}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
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
                <p className="text-2xl font-bold text-gray-900">{stats.activeCalls}</p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Today's Calls</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalCalls}</p>
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
                <p className="text-sm font-medium text-gray-600">Avg Duration</p>
                <p className="text-2xl font-bold text-gray-900">{formatDuration(stats.avgCallDuration)}</p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Call Time</p>
                <p className="text-2xl font-bold text-gray-900">{stats.todayCallTime}m</p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Missed Calls</p>
                <p className="text-2xl font-bold text-gray-900">{stats.missedCalls}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Calls */}
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Calls</h3>
        {recentCalls.length > 0 ? (
          <div className="space-y-3">
            {recentCalls.map((call) => (
              <div key={call.id} className="flex items-center justify-between py-3 border-b border-gray-200 last:border-0">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{getCallDirectionIcon(call.direction)}</span>
                  <div>
                    <div className="font-medium text-gray-900">
                      {call.direction === 'inbound' ? call.fromNumber : call.toNumber}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatTime(call.startTime)} • {call.direction}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-medium ${getStatusColor(call.status)}`}>
                    {call.status}
                  </div>
                  {call.duration && (
                    <div className="text-sm text-gray-500">
                      {formatDuration(call.duration)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <p className="text-lg font-medium">No calls yet</p>
            <p className="text-sm">Your recent calls will appear here</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Make Call</h4>
                <p className="text-sm text-gray-500">Start a new call</p>
              </div>
            </div>
          </div>

          <div className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Call History</h4>
                <p className="text-sm text-gray-500">View all calls</p>
              </div>
            </div>
          </div>

          <div className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Settings</h4>
                <p className="text-sm text-gray-500">Update preferences</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserDashboardPage