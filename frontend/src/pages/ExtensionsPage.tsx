import React, { useState, useEffect } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'

interface Extension {
  id: string
  number: string
  displayName: string
  type: string
  status: string
  sipPassword?: string
  sipDomain?: string
  sipEnabled?: boolean
  registrationStatus?: string
  user?: {
    id: string
    email: string
    firstName: string
    lastName: string
    role: string
    isActive: boolean
  }
  calls?: Array<{
    id: string
    fromNumber: string
    toNumber: string
    direction: string
    status: string
    startTime: string
  }>
}

interface SipCredentials {
  username: string
  password: string
  domain: string
  proxy: string
  port: number
}

interface SipExtension {
  id: string
  number: string
  domain: string
  tenantId: string
  userId?: string
  status: 'available' | 'busy' | 'offline' | 'ringing'
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

const ExtensionsPage: React.FC = () => {
  const [extensions, setExtensions] = useState<Extension[]>([])
  const [sipExtensions, setSipExtensions] = useState<SipExtension[]>([])
  const [pbxStatus, setPbxStatus] = useState<PbxStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [activeView, setActiveView] = useState<'database' | 'pbx' | 'combined'>('combined')
  const [newExtension, setNewExtension] = useState({
    number: '',
    displayName: '',
    type: 'user'
  })
  const [creatingExtension, setCreatingExtension] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [assigningUser, setAssigningUser] = useState(false)
  const [updatingExtension, setUpdatingExtension] = useState(false)
  const [editFormData, setEditFormData] = useState({
    displayName: '',
    type: '',
    status: ''
  })
  const [showSipCredentialsModal, setShowSipCredentialsModal] = useState(false)
  const [sipCredentials, setSipCredentials] = useState<SipCredentials | null>(null)
  const [loadingCredentials, setLoadingCredentials] = useState(false)
  const [regeneratingPassword, setRegeneratingPassword] = useState(false)
  const { user: currentUser } = useAuthStore()

  useEffect(() => {
    fetchAllData()

    // Refresh disabled to prevent infinite database queries during development
    // const interval = setInterval(fetchAllData, 5000)
    // return () => clearInterval(interval)
  }, [])

  const fetchAllData = async () => {
    try {
      const [extensionsResponse, sipExtensionsResponse, pbxStatusResponse] = await Promise.all([
        api.getExtensions(),
        api.getPbxExtensions(),
        api.getPbxStatus()
      ])

      if (extensionsResponse.success) {
        setExtensions(extensionsResponse.data)
      }
      if (sipExtensionsResponse.success) {
        setSipExtensions(sipExtensionsResponse.data)
      }
      if (pbxStatusResponse.success) {
        setPbxStatus(pbxStatusResponse.data)
      }
    } catch (error) {
      console.error('Failed to fetch extension data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchExtensions = async () => {
    try {
      const response = await api.getExtensions()
      if (response.success) {
        setExtensions(response.data)
      }
    } catch (error) {
      toast.error('Failed to fetch extensions')
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await api.getUsers()
      if (response.success) {
        setUsers(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const handleAssignClick = async (extension: any) => {
    setSelectedExtension(extension)
    setShowAssignModal(true)
    await fetchUsers()
  }

  const handleEditClick = (extension: any) => {
    setSelectedExtension(extension)
    setEditFormData({
      displayName: extension.displayName || '',
      type: extension.type || 'user',
      status: extension.status || 'active'
    })
    setShowEditModal(true)
  }

  const assignUserToExtension = async (userId: string) => {
    if (!selectedExtension) return

    setAssigningUser(true)
    try {
      const response = await api.assignExtension(selectedExtension.id, userId)
      if (response.success) {
        toast.success('User assigned to extension successfully')
        setShowAssignModal(false)
        setSelectedExtension(null)
        fetchAllData()
      } else {
        toast.error(response.error || 'Failed to assign user to extension')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign user to extension')
    } finally {
      setAssigningUser(false)
    }
  }

  const unassignUserFromExtension = async () => {
    if (!selectedExtension) return

    setAssigningUser(true)
    try {
      const response = await api.unassignExtension(selectedExtension.id)
      if (response.success) {
        toast.success('User unassigned from extension successfully')
        fetchAllData()
      } else {
        toast.error(response.error || 'Failed to unassign user from extension')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to unassign user from extension')
    } finally {
      setAssigningUser(false)
    }
  }

  const updateExtensionDetails = async () => {
    if (!selectedExtension) return

    setUpdatingExtension(true)
    try {
      const response = await api.updateExtension(selectedExtension.id, editFormData)
      if (response.success) {
        toast.success('Extension updated successfully')
        setShowEditModal(false)
        setSelectedExtension(null)
        fetchAllData()
      } else {
        toast.error(response.error || 'Failed to update extension')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update extension')
    } finally {
      setUpdatingExtension(false)
    }
  }

  const fetchSipCredentials = async (extension: Extension) => {
    setSelectedExtension(extension)
    setLoadingCredentials(true)
    setShowSipCredentialsModal(true)

    try {
      const response = await api.getSipCredentials(extension.id)
      if (response.success) {
        setSipCredentials(response.data)
      } else {
        toast.error(response.error || 'Failed to fetch SIP credentials')
        setShowSipCredentialsModal(false)
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch SIP credentials')
      setShowSipCredentialsModal(false)
    } finally {
      setLoadingCredentials(false)
    }
  }

  const regenerateSipPassword = async (confirmFirst = true) => {
    if (!selectedExtension) return

    if (confirmFirst) {
      const confirmed = window.confirm(
        `Are you sure you want to regenerate the SIP password for extension ${selectedExtension.number}?\n\n` +
        'This will require updating all connected SIP clients with the new password.'
      )
      if (!confirmed) return
    }

    setRegeneratingPassword(true)
    try {
      const response = await api.updateSipSettings(selectedExtension.id, {
        regeneratePassword: true
      })

      if (response.success) {
        toast.success('SIP password regenerated successfully')
        // Refresh credentials to show new password if modal is open
        if (showSipCredentialsModal) {
          await fetchSipCredentials(selectedExtension)
        }
      } else {
        toast.error(response.error || 'Failed to regenerate password')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to regenerate password')
    } finally {
      setRegeneratingPassword(false)
    }
  }

  const createExtension = async () => {
    if (!newExtension.number || !newExtension.displayName) {
      toast.error('Please fill in all required fields')
      return
    }

    setCreatingExtension(true)
    try {
      const response = await api.createExtension({
        number: newExtension.number,
        displayName: newExtension.displayName,
        type: newExtension.type,
        config: {}
      })

      if (response.success) {
        toast.success('Extension created successfully')
        setNewExtension({ number: '', displayName: '', type: 'user' })
        setShowCreateModal(false)
        fetchAllData()
      } else {
        toast.error(response.error || 'Failed to create extension')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create extension')
    } finally {
      setCreatingExtension(false)
    }
  }

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'user': return 'bg-blue-100 text-blue-800'
      case 'queue': return 'bg-green-100 text-green-800'
      case 'conference': return 'bg-purple-100 text-purple-800'
      case 'ivr': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'available': return 'bg-green-100 text-green-800'
      case 'busy': return 'bg-red-100 text-red-800'
      case 'unavailable':
      case 'offline': return 'bg-gray-100 text-gray-800'
      case 'ringing': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getSipStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500'
      case 'busy': return 'bg-red-500'
      case 'ringing': return 'bg-yellow-500'
      case 'offline': return 'bg-gray-400'
      default: return 'bg-gray-400'
    }
  }

  // Combine database extensions with SIP extensions
  const getCombinedExtensions = () => {
    if (activeView === 'database') return extensions
    if (activeView === 'pbx') return sipExtensions.map(sipExt => ({
      id: sipExt.id,
      number: sipExt.number,
      displayName: `Extension ${sipExt.number}`,
      type: 'sip',
      status: sipExt.status,
      domain: sipExt.domain,
      sipStatus: sipExt.status
    }))

    // Combined view - merge database and SIP data
    const combinedMap = new Map()

    // Add database extensions
    extensions.forEach(ext => {
      combinedMap.set(ext.number, {
        ...ext,
        source: 'database',
        sipStatus: 'offline'
      })
    })

    // Add SIP status to existing extensions or create new ones
    sipExtensions.forEach(sipExt => {
      const existing = combinedMap.get(sipExt.number)
      if (existing) {
        combinedMap.set(sipExt.number, {
          ...existing,
          sipStatus: sipExt.status,
          domain: sipExt.domain
        })
      } else {
        combinedMap.set(sipExt.number, {
          id: sipExt.id,
          number: sipExt.number,
          displayName: `SIP Extension ${sipExt.number}`,
          type: 'sip',
          status: sipExt.status,
          sipStatus: sipExt.status,
          domain: sipExt.domain,
          source: 'sip'
        })
      }
    })

    return Array.from(combinedMap.values())
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'user': return '👤'
      case 'queue': return '📞'
      case 'conference': return '🏢'
      case 'ivr': return '🎵'
      default: return '📱'
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
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Extension Management</h1>
            <p className="text-gray-600">Manage phone extensions with PBX integration</p>
          </div>
          {(currentUser?.role === 'admin' || currentUser?.role === 'supervisor') && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Add Extension
            </button>
          )}
        </div>

        {/* PBX Status and View Controls */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-6">
            {pbxStatus && (
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${pbxStatus.initialized ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm font-medium text-gray-600">
                  PBX {pbxStatus.initialized ? 'Online' : 'Offline'}
                </span>
                <span className="text-sm text-gray-500">
                  ({pbxStatus.activeExtensions} SIP registered)
                </span>
              </div>
            )}
            <div className="text-sm text-gray-500">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>

          <div className="flex space-x-1">
            <button
              onClick={() => setActiveView('combined')}
              className={`px-3 py-1 text-sm font-medium rounded-l-md ${
                activeView === 'combined'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } border border-gray-300`}
            >
              Combined ({getCombinedExtensions().length})
            </button>
            <button
              onClick={() => setActiveView('database')}
              className={`px-3 py-1 text-sm font-medium ${
                activeView === 'database'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } border-t border-b border-gray-300`}
            >
              Database ({extensions.length})
            </button>
            <button
              onClick={() => setActiveView('pbx')}
              className={`px-3 py-1 text-sm font-medium rounded-r-md ${
                activeView === 'pbx'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              } border border-gray-300`}
            >
              SIP ({sipExtensions.length})
            </button>
          </div>
        </div>
      </div>

      {/* Extensions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {getCombinedExtensions().map((extension: any) => (
          <div key={extension.id || extension.number} className="card p-6 relative">
            {/* SIP Status Indicator */}
            {extension.sipStatus && (
              <div className="absolute top-3 right-3">
                <div className={`w-3 h-3 rounded-full ${getSipStatusColor(extension.sipStatus)}`}></div>
              </div>
            )}

            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-xl relative">
                {getTypeIcon(extension.type)}
                {extension.sipStatus === 'ringing' && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full animate-ping"></div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-medium text-gray-900">
                    {extension.number}
                  </h3>
                  {extension.calls && extension.calls.length > 0 && (
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  )}
                  {extension.source && (
                    <span className={`px-1 py-0.5 text-xs rounded ${
                      extension.source === 'sip' ? 'bg-purple-100 text-purple-800' :
                      extension.source === 'database' ? 'bg-blue-100 text-blue-800' : ''
                    }`}>
                      {extension.source}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">{extension.displayName}</p>
                {extension.domain && (
                  <p className="text-xs text-gray-400">@{extension.domain}</p>
                )}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Type</span>
                <span className={`px-2 py-1 text-xs rounded-full ${getTypeBadgeColor(extension.type)}`}>
                  {extension.type === 'sip' ? 'SIP' : extension.type.charAt(0).toUpperCase() + extension.type.slice(1)}
                </span>
              </div>

              {/* Database Status */}
              {extension.status && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">DB Status</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeColor(extension.status)}`}>
                    {extension.status.charAt(0).toUpperCase() + extension.status.slice(1)}
                  </span>
                </div>
              )}

              {/* SIP Status */}
              {extension.sipStatus && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">SIP Status</span>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${getSipStatusColor(extension.sipStatus)}`}></div>
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeColor(extension.sipStatus)}`}>
                      {extension.sipStatus.charAt(0).toUpperCase() + extension.sipStatus.slice(1)}
                    </span>
                  </div>
                </div>
              )}

              {extension.user ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Assigned to</span>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {extension.user.firstName} {extension.user.lastName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {extension.user.email}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Assignment</span>
                  <span className="text-sm text-gray-500">Unassigned</span>
                </div>
              )}

              {extension.calls && extension.calls.length > 0 && (
                <div className="pt-2 border-t border-gray-200">
                  <div className="text-sm font-medium text-gray-600 mb-1">Active Calls</div>
                  {extension.calls.slice(0, 2).map((call) => (
                    <div key={call.id} className="text-xs text-gray-500 flex justify-between">
                      <span>{call.direction === 'inbound' ? call.fromNumber : call.toNumber}</span>
                      <span className="capitalize">{call.status}</span>
                    </div>
                  ))}
                  {extension.calls.length > 2 && (
                    <div className="text-xs text-gray-400">
                      +{extension.calls.length - 2} more
                    </div>
                  )}
                </div>
              )}
            </div>

            {(currentUser?.role === 'admin' || currentUser?.role === 'supervisor') && extension.source !== 'sip' && (
              <div className="mt-4 space-y-2">
                {/* SIP Credentials button for user extensions */}
                {extension.type === 'user' && (
                  <button
                    onClick={() => fetchSipCredentials(extension)}
                    className="w-full bg-blue-600 text-white px-3 py-2 text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    📱 View SIP Credentials
                  </button>
                )}

                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditClick(extension)}
                    className="btn-secondary flex-1 px-3 py-2 text-sm"
                  >
                    Edit
                  </button>
                  {extension.user ? (
                    <button
                      onClick={() => {
                        setSelectedExtension(extension)
                        unassignUserFromExtension()
                      }}
                      disabled={assigningUser}
                      className="btn-secondary flex-1 px-3 py-2 text-sm disabled:opacity-50"
                    >
                      {assigningUser ? 'Unassigning...' : 'Unassign'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAssignClick(extension)}
                      className="btn-success flex-1 px-3 py-2 text-sm"
                    >
                      Assign
                    </button>
                  )}
                </div>

                {/* Quick regenerate password for user extensions */}
                {extension.type === 'user' && (
                  <button
                    onClick={async () => {
                      setSelectedExtension(extension)
                      await regenerateSipPassword()
                      setSelectedExtension(null)
                    }}
                    disabled={regeneratingPassword}
                    className="w-full bg-orange-600 text-white px-3 py-2 text-sm rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {regeneratingPassword ? '⏳ Regenerating...' : '🔄 Regenerate SIP Password'}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {getCombinedExtensions().length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg">No extensions found</div>
          <p className="text-gray-500 mt-2">
            {activeView === 'pbx'
              ? 'No SIP extensions registered with the PBX'
              : activeView === 'database'
                ? 'Get started by adding your first extension'
                : 'No extensions configured in database or PBX'}
          </p>
        </div>
      )}

      {/* Create Extension Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Create New Extension</h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewExtension({ number: '', displayName: '', type: 'user' })
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Extension Number *
                  </label>
                  <input
                    type="text"
                    value={newExtension.number}
                    onChange={(e) => setNewExtension(prev => ({ ...prev, number: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 1001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    value={newExtension.displayName}
                    onChange={(e) => setNewExtension(prev => ({ ...prev, displayName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Sales Extension"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Extension Type
                  </label>
                  <select
                    value={newExtension.type}
                    onChange={(e) => setNewExtension(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="user">User Extension</option>
                    <option value="queue">Queue Extension</option>
                    <option value="conference">Conference Extension</option>
                    <option value="ivr">IVR Extension</option>
                  </select>
                </div>

                <div className="bg-blue-50 p-3 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Extension will be created in the database.
                    SIP registration will happen automatically when configured in your SIP client.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewExtension({ number: '', displayName: '', type: 'user' })
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  disabled={creatingExtension}
                >
                  Cancel
                </button>
                <button
                  onClick={createExtension}
                  disabled={creatingExtension || !newExtension.number || !newExtension.displayName}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingExtension ? 'Creating...' : 'Create Extension'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign User Modal */}
      {showAssignModal && selectedExtension && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Assign User to Extension {selectedExtension.number}
                </h3>
                <button
                  onClick={() => {
                    setShowAssignModal(false)
                    setSelectedExtension(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select User
                  </label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {users.filter(user => user.isActive && !user.extensionId).map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div>
                          <div className="font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.email}
                          </div>
                          <div className="text-xs text-gray-400">
                            Role: {user.role}
                          </div>
                        </div>
                        <button
                          onClick={() => assignUserToExtension(user.id)}
                          disabled={assigningUser}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          {assigningUser ? 'Assigning...' : 'Assign'}
                        </button>
                      </div>
                    ))}
                  </div>
                  {users.filter(user => user.isActive && !user.extensionId).length === 0 && (
                    <div className="text-center py-4 text-gray-500">
                      No available users found
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowAssignModal(false)
                    setSelectedExtension(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  disabled={assigningUser}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Extension Modal */}
      {showEditModal && selectedExtension && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Edit Extension {selectedExtension.number}
                </h3>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedExtension(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Extension Number
                  </label>
                  <input
                    type="text"
                    value={selectedExtension.number}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Extension number cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={editFormData.displayName}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, displayName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Sales Extension"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Extension Type
                  </label>
                  <select
                    value={editFormData.type}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="user">User Extension</option>
                    <option value="queue">Queue Extension</option>
                    <option value="conference">Conference Extension</option>
                    <option value="ivr">IVR Extension</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>

                {selectedExtension.user && (
                  <div className="bg-blue-50 p-3 rounded-md">
                    <p className="text-sm text-blue-800">
                      <strong>Currently assigned to:</strong> {selectedExtension.user.firstName} {selectedExtension.user.lastName}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedExtension(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  disabled={updatingExtension}
                >
                  Cancel
                </button>
                <button
                  onClick={updateExtensionDetails}
                  disabled={updatingExtension || !editFormData.displayName}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingExtension ? 'Updating...' : 'Update Extension'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SIP Credentials Modal */}
      {showSipCredentialsModal && selectedExtension && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  📱 SIP Credentials - Extension {selectedExtension.number}
                </h3>
                <button
                  onClick={() => {
                    setShowSipCredentialsModal(false)
                    setSipCredentials(null)
                    setSelectedExtension(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {loadingCredentials ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading credentials...</span>
                </div>
              ) : sipCredentials ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-3">📱 Mobile App Configuration</h4>
                    <div className="space-y-3">
                      <div className="bg-white p-3 rounded border">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                        <div className="flex items-center justify-between">
                          <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{sipCredentials.username}</code>
                          <button
                            onClick={() => navigator.clipboard.writeText(sipCredentials.username)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            📋 Copy
                          </button>
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded border">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">Password</label>
                          <button
                            onClick={() => regenerateSipPassword(true)}
                            disabled={regeneratingPassword}
                            className="text-sm bg-orange-600 text-white px-2 py-1 rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {regeneratingPassword ? '⏳ Regenerating...' : '🔄 Regenerate'}
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded break-all">{sipCredentials.password}</code>
                          <button
                            onClick={() => navigator.clipboard.writeText(sipCredentials.password)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            📋 Copy
                          </button>
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded border">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Server/Host</label>
                        <div className="flex items-center justify-between">
                          <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{sipCredentials.proxy}</code>
                          <button
                            onClick={() => navigator.clipboard.writeText(sipCredentials.proxy)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            📋 Copy
                          </button>
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded border">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                        <div className="flex items-center justify-between">
                          <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{sipCredentials.port}</code>
                          <button
                            onClick={() => navigator.clipboard.writeText(sipCredentials.port.toString())}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            📋 Copy
                          </button>
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded border">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
                        <div className="flex items-center justify-between">
                          <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded break-all">{sipCredentials.domain}</code>
                          <button
                            onClick={() => navigator.clipboard.writeText(sipCredentials.domain)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            📋 Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">📱 Quick Setup Guide</h4>
                    <ol className="text-sm text-green-700 space-y-1">
                      <li>1. Download Linphone or Zoiper on your mobile</li>
                      <li>2. Add new SIP account</li>
                      <li>3. Copy the credentials above</li>
                      <li>4. Set Transport to: UDP</li>
                      <li>5. Save and register</li>
                    </ol>
                  </div>

                  <div className="bg-yellow-50 p-3 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <strong>📶 Network:</strong> Ensure your mobile device is on the same WiFi network as this server (192.168.1.38)
                    </p>
                  </div>

                  <div className="bg-red-50 p-3 rounded-lg">
                    <p className="text-sm text-red-800">
                      <strong>⚠️ Important:</strong> Regenerating the password will require updating all connected SIP clients with the new credentials.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-red-600">
                  Failed to load SIP credentials. Please try again.
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowSipCredentialsModal(false)
                    setSipCredentials(null)
                    setSelectedExtension(null)
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExtensionsPage