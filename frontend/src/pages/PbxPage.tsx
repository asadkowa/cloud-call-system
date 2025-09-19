import React, { useState, useEffect } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'

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

const PbxPage: React.FC = () => {
  const [pbxStatus, setPbxStatus] = useState<PbxStatus | null>(null)
  const [extensions, setExtensions] = useState<SipExtension[]>([])
  const [activeCalls, setActiveCalls] = useState<CallSession[]>([])
  const [loading, setLoading] = useState(true)
  const [callForm, setCallForm] = useState({ fromNumber: '', toNumber: '' })
  const { user } = useAuthStore()

  useEffect(() => {
    fetchPbxData()
    // Refresh disabled to prevent infinite database queries during development
    // const interval = setInterval(fetchPbxData, 5000) // Refresh every 5 seconds
    // return () => clearInterval(interval)
  }, [])

  const fetchPbxData = async () => {
    try {
      const [statusResponse, extensionsResponse, callsResponse] = await Promise.all([
        api.get('/pbx/status'),
        api.get('/pbx/extensions'),
        api.get('/pbx/calls')
      ])

      if (statusResponse.success) setPbxStatus(statusResponse.data)
      if (extensionsResponse.success) setExtensions(extensionsResponse.data)
      if (callsResponse.success) setActiveCalls(callsResponse.data)
    } catch (error) {
      console.error('Failed to fetch PBX data:', error)
    } finally {
      setLoading(false)
    }
  }

  const initiateCall = async () => {
    if (!callForm.fromNumber || !callForm.toNumber) {
      toast.error('Please enter both from and to numbers')
      return
    }

    try {
      const response = await api.post('/pbx/calls', callForm)
      if (response.success) {
        toast.success('Call initiated successfully')
        setCallForm({ fromNumber: '', toNumber: '' })
        fetchPbxData()
      } else {
        toast.error(response.error || 'Failed to initiate call')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to initiate call')
    }
  }

  const answerCall = async (callId: string) => {
    try {
      const response = await api.post(`/pbx/calls/${callId}/answer`)
      if (response.success) {
        toast.success('Call answered')
        fetchPbxData()
      } else {
        toast.error(response.error || 'Failed to answer call')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to answer call')
    }
  }

  const endCall = async (callId: string) => {
    try {
      const response = await api.post(`/pbx/calls/${callId}/end`)
      if (response.success) {
        toast.success('Call ended')
        fetchPbxData()
      } else {
        toast.error(response.error || 'Failed to end call')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to end call')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800'
      case 'busy': return 'bg-red-100 text-red-800'
      case 'ringing': return 'bg-yellow-100 text-yellow-800'
      case 'offline': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">PBX Cluster Management</h1>
          <p className="text-gray-600">Monitor and manage your FreeSWITCH PBX cluster</p>
        </div>
      </div>

      {/* PBX Status */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">PBX Cluster Status</h2>
        {pbxStatus ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                pbxStatus.initialized ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {pbxStatus.initialized ? 'Online' : 'Offline'}
              </div>
              <p className="text-xs text-gray-500 mt-1">Status</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{pbxStatus.activeExtensions}</div>
              <p className="text-xs text-gray-500">Active Extensions</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{pbxStatus.activeCalls}</div>
              <p className="text-xs text-gray-500">Active Calls</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{pbxStatus.maxConcurrentCalls}</div>
              <p className="text-xs text-gray-500">Max Concurrent</p>
            </div>
          </div>
        ) : (
          <div className="text-red-600">PBX Status unavailable</div>
        )}
      </div>

      {/* Call Initiation */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Initiate Call</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Number</label>
            <input
              type="text"
              value={callForm.fromNumber}
              onChange={(e) => setCallForm(prev => ({ ...prev, fromNumber: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 1001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Number</label>
            <input
              type="text"
              value={callForm.toNumber}
              onChange={(e) => setCallForm(prev => ({ ...prev, toNumber: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 1002 or external number"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={initiateCall}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Initiate Call
            </button>
          </div>
        </div>
      </div>

      {/* Extensions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">SIP Extensions ({extensions.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {extensions.map((extension) => (
            <div key={extension.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-gray-900">Extension {extension.number}</h3>
                  <p className="text-sm text-gray-500">{extension.domain}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(extension.status)}`}>
                  {extension.status}
                </span>
              </div>
            </div>
          ))}
        </div>
        {extensions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No extensions found. Create extensions in the Extensions page.
          </div>
        )}
      </div>

      {/* Active Calls */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Active Calls ({activeCalls.length})</h2>
        <div className="space-y-4">
          {activeCalls.map((call) => (
            <div key={call.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
                  <div>
                    <p className="text-sm font-medium text-gray-900">From: {call.fromNumber}</p>
                    <p className="text-sm font-medium text-gray-900">To: {call.toNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Direction: {call.direction}</p>
                    <p className="text-sm text-gray-500">Started: {new Date(call.startTime).toLocaleTimeString()}</p>
                  </div>
                  <div>
                    <span className={`px-2 py-1 text-xs rounded-full ${getCallStatusColor(call.status)}`}>
                      {call.status}
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    {call.status === 'ringing' && (
                      <button
                        onClick={() => answerCall(call.callId)}
                        className="bg-green-600 text-white px-3 py-1 text-sm rounded hover:bg-green-700"
                      >
                        Answer
                      </button>
                    )}
                    {call.status !== 'ended' && (
                      <button
                        onClick={() => endCall(call.callId)}
                        className="bg-red-600 text-white px-3 py-1 text-sm rounded hover:bg-red-700"
                      >
                        End Call
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {activeCalls.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No active calls
          </div>
        )}
      </div>
    </div>
  )
}

export default PbxPage