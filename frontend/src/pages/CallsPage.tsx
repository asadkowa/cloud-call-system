import React, { useState, useEffect } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'

interface Call {
  id: string
  fromNumber: string
  toNumber: string
  direction: 'inbound' | 'outbound'
  status: string
  startTime: string
  endTime?: string
  duration?: number
  recordingUrl?: string
  extension?: {
    id: string
    number: string
    displayName: string
    type: string
  }
  queue?: {
    id: string
    name: string
    extension: string
  }
  agent?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
}

interface PbxCallSession {
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

interface SipExtension {
  id: string
  number: string
  domain: string
  tenantId: string
  userId?: string
  status: 'available' | 'busy' | 'offline' | 'ringing'
}

const CallsPage: React.FC = () => {
  const [calls, setCalls] = useState<Call[]>([])
  const [activeCalls, setActiveCalls] = useState<Call[]>([])
  const [pbxCalls, setPbxCalls] = useState<PbxCallSession[]>([])
  const [extensions, setExtensions] = useState<SipExtension[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'pbx'>('pbx')
  const [showNewCallModal, setShowNewCallModal] = useState(false)
  const [newCall, setNewCall] = useState({ fromNumber: '', toNumber: '' })
  const [callInProgress, setCallInProgress] = useState(false)
  const { user: currentUser } = useAuthStore()

  useEffect(() => {
    fetchCalls()
    fetchActiveCalls()
    fetchPbxData()

    // Refresh disabled to prevent infinite database queries during development
    // const interval = setInterval(() => {
    //   if (activeTab === 'active') {
    //     fetchActiveCalls()
    //   } else if (activeTab === 'pbx') {
    //     fetchPbxData()
    //   }
    // }, 5000)

    return () => clearInterval(interval)
  }, [activeTab])

  const fetchCalls = async () => {
    try {
      const response = await api.getCalls()
      if (response.success) {
        setCalls(response.data)
      }
    } catch (error) {
      toast.error('Failed to fetch calls')
    } finally {
      setLoading(false)
    }
  }

  const fetchActiveCalls = async () => {
    try {
      const response = await api.getActiveCalls()
      if (response.success) {
        setActiveCalls(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch active calls:', error)
    }
  }

  const fetchPbxData = async () => {
    try {
      const [callsResponse, extensionsResponse] = await Promise.all([
        api.getPbxCalls(),
        api.getPbxExtensions()
      ])

      if (callsResponse.success) {
        setPbxCalls(callsResponse.data)
      }
      if (extensionsResponse.success) {
        setExtensions(extensionsResponse.data)
      }
    } catch (error) {
      console.error('Failed to fetch PBX data:', error)
    }
  }

  const initiateCall = async () => {
    if (!newCall.fromNumber || !newCall.toNumber) {
      toast.error('Please enter both from and to numbers')
      return
    }

    setCallInProgress(true)
    try {
      const response = await api.initiatePbxCall({
        fromNumber: newCall.fromNumber,
        toNumber: newCall.toNumber
      })

      if (response.success) {
        toast.success('Call initiated successfully')
        setNewCall({ fromNumber: '', toNumber: '' })
        setShowNewCallModal(false)
        fetchPbxData() // Refresh PBX data
      } else {
        toast.error(response.error || 'Failed to initiate call')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to initiate call')
    } finally {
      setCallInProgress(false)
    }
  }

  const answerCall = async (callId: string) => {
    try {
      const response = await api.answerPbxCall(callId)
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
      const response = await api.endPbxCall(callId)
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

  const transferCall = async (callId: string, targetExtension: string) => {
    if (!targetExtension) {
      toast.error('Please select a target extension')
      return
    }

    try {
      const response = await api.transferPbxCall(callId, targetExtension)
      if (response.success) {
        toast.success('Call transferred successfully')
        fetchPbxData()
      } else {
        toast.error(response.error || 'Failed to transfer call')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to transfer call')
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ringing': return 'bg-yellow-100 text-yellow-800 animate-pulse'
      case 'answered': return 'bg-green-100 text-green-800'
      case 'completed': return 'bg-blue-100 text-blue-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'busy': return 'bg-orange-100 text-orange-800'
      case 'transferred': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getDirectionIcon = (direction: string) => {
    return direction === 'inbound' ? '📞' : '📱'
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--'
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatPhoneNumber = (phoneNumber: string) => {
    // Simple phone number formatting
    const cleaned = phoneNumber.replace(/\D/g, '')
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    return phoneNumber
  }

  const getPbxStatusColor = (status: string) => {
    switch (status) {
      case 'ringing': return 'bg-yellow-100 text-yellow-800 animate-pulse'
      case 'answered': return 'bg-green-100 text-green-800'
      case 'hold': return 'bg-blue-100 text-blue-800'
      case 'transfer': return 'bg-purple-100 text-purple-800'
      case 'ended': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getExtensionStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-green-600'
      case 'busy': return 'text-red-600'
      case 'ringing': return 'text-yellow-600'
      case 'offline': return 'text-gray-400'
      default: return 'text-gray-400'
    }
  }

  const displayCalls = activeTab === 'active' ? activeCalls : activeTab === 'pbx' ? pbxCalls : calls

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
          <h1 className="text-2xl font-bold text-gray-900">Call Management</h1>
          <p className="text-gray-600">Monitor and manage call activities with PBX integration</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowNewCallModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            📞 New Call
          </button>
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('pbx')}
              className={`px-4 py-2 text-sm font-medium rounded-l-md ${
                activeTab === 'pbx'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } border border-gray-300`}
            >
              PBX Calls ({pbxCalls.length})
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'active'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } border-t border-b border-gray-300`}
            >
              Active ({activeCalls.length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 text-sm font-medium rounded-r-md ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } border-t border-r border-b border-gray-300`}
            >
              All Calls
            </button>
          </div>
        </div>
      </div>

      {/* Calls List */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Call Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Extension/Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                {(currentUser?.role === 'admin' || currentUser?.role === 'supervisor') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayCalls.map((call: any) => (
                <tr key={call.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <div className="text-xl">
                        {getDirectionIcon(call.direction)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {call.direction === 'inbound'
                            ? `${formatPhoneNumber(call.fromNumber)} → ${formatPhoneNumber(call.toNumber)}`
                            : `${formatPhoneNumber(call.toNumber)} ← ${formatPhoneNumber(call.fromNumber)}`
                          }
                        </div>
                        <div className="text-sm text-gray-500 capitalize">
                          {call.direction} call
                        </div>
                        {activeTab === 'pbx' && call.fromExtension && (
                          <div className="text-xs text-blue-600">
                            From Ext: {call.fromExtension}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      {activeTab === 'pbx' ? (
                        <>
                          {call.fromExtension && (
                            <div className="text-sm font-medium text-gray-900">
                              Ext. {call.fromExtension}
                            </div>
                          )}
                          {call.toExtension && (
                            <div className="text-sm text-gray-500">
                              To Ext: {call.toExtension}
                            </div>
                          )}
                          {!call.fromExtension && !call.toExtension && (
                            <span className="text-sm text-gray-400">No Extension</span>
                          )}
                        </>
                      ) : (
                        <>
                          {call.extension && (
                            <div className="text-sm font-medium text-gray-900">
                              Ext. {call.extension.number}
                            </div>
                          )}
                          {call.agent && (
                            <div className="text-sm text-gray-500">
                              {call.agent.firstName} {call.agent.lastName}
                            </div>
                          )}
                          {call.queue && (
                            <div className="text-sm text-gray-500">
                              Queue: {call.queue.name}
                            </div>
                          )}
                          {!call.extension && !call.agent && !call.queue && (
                            <span className="text-sm text-gray-400">Unassigned</span>
                          )}
                        </>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      activeTab === 'pbx' ? getPbxStatusColor(call.status) : getStatusBadgeColor(call.status)
                    }`}>
                      {call.status.charAt(0).toUpperCase() + call.status.slice(1)}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {activeTab === 'pbx' ?
                      (call.answerTime ? formatDuration(Math.floor((new Date().getTime() - new Date(call.answerTime).getTime()) / 1000)) : '--') :
                      formatDuration(call.duration)
                    }
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatTime(call.startTime)}
                    </div>
                    {(call.endTime || call.answerTime) && (
                      <div className="text-xs text-gray-500">
                        {call.endTime ? `Ended: ${formatTime(call.endTime)}` :
                         call.answerTime ? `Answered: ${formatTime(call.answerTime)}` : ''}
                      </div>
                    )}
                  </td>

                  {(currentUser?.role === 'admin' || currentUser?.role === 'supervisor') && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {activeTab === 'pbx' ? (
                          <>
                            {call.status === 'ringing' && (
                              <button
                                onClick={() => answerCall(call.callId)}
                                className="bg-green-600 text-white px-2 py-1 text-xs rounded hover:bg-green-700"
                              >
                                Answer
                              </button>
                            )}
                            {call.status !== 'ended' && (
                              <button
                                onClick={() => endCall(call.callId)}
                                className="bg-red-600 text-white px-2 py-1 text-xs rounded hover:bg-red-700"
                              >
                                End
                              </button>
                            )}
                            {call.status === 'answered' && (
                              <select
                                onChange={(e) => e.target.value && transferCall(call.callId, e.target.value)}
                                className="text-xs border border-gray-300 rounded px-1 py-1"
                                defaultValue=""
                              >
                                <option value="">Transfer...</option>
                                {extensions.filter(ext => ext.status === 'available').map(ext => (
                                  <option key={ext.id} value={ext.number}>
                                    Ext {ext.number}
                                  </option>
                                ))}
                              </select>
                            )}
                          </>
                        ) : (
                          <>
                            <button className="text-blue-600 hover:text-blue-900">
                              View
                            </button>
                            {call.recordingUrl && (
                              <button className="text-green-600 hover:text-green-900">
                                Listen
                              </button>
                            )}
                            {call.status === 'answered' && (
                              <button className="text-yellow-600 hover:text-yellow-900">
                                Transfer
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {displayCalls.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg">
            {activeTab === 'pbx' ? 'No PBX calls' :
             activeTab === 'active' ? 'No active calls' : 'No calls found'}
          </div>
          <p className="text-gray-500 mt-2">
            {activeTab === 'pbx'
              ? 'PBX calls will appear here once initiated'
              : activeTab === 'active'
                ? 'All quiet on the call center front'
                : 'Call history will appear here once calls are made'
            }
          </p>
        </div>
      )}

      {/* New Call Modal */}
      {showNewCallModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Initiate New Call</h3>
                <button
                  onClick={() => setShowNewCallModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Number/Extension
                  </label>
                  <input
                    type="text"
                    value={newCall.fromNumber}
                    onChange={(e) => setNewCall(prev => ({ ...prev, fromNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 1001 or +1234567890"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To Number/Extension
                  </label>
                  <input
                    type="text"
                    value={newCall.toNumber}
                    onChange={(e) => setNewCall(prev => ({ ...prev, toNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 1002 or +1987654321"
                  />
                </div>

                {/* Available Extensions */}
                {extensions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Available Extensions
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                      {extensions.map((ext) => (
                        <button
                          key={ext.id}
                          onClick={() => setNewCall(prev => ({
                            ...prev,
                            fromNumber: prev.fromNumber || ext.number
                          }))}
                          className={`text-xs px-2 py-1 rounded border ${
                            ext.status === 'available'
                              ? 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100'
                              : 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'
                          }`}
                          disabled={ext.status !== 'available'}
                        >
                          <div className="font-medium">Ext {ext.number}</div>
                          <div className={getExtensionStatusColor(ext.status)}>{ext.status}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowNewCallModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  disabled={callInProgress}
                >
                  Cancel
                </button>
                <button
                  onClick={initiateCall}
                  disabled={callInProgress || !newCall.fromNumber || !newCall.toNumber}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {callInProgress ? 'Calling...' : 'Start Call'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CallsPage