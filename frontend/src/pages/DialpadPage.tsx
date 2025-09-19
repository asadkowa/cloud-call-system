import React, { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { toast } from 'react-hot-toast'

// API Configuration
const API_BASE_URL = 'http://localhost:3002/api'

interface CallHistory {
  id: string
  number: string
  name?: string
  time: Date
  duration?: number
  type: 'outgoing' | 'incoming' | 'missed'
}

interface Contact {
  id: string
  name: string
  number: string
  company?: string
}

interface Extension {
  id: string
  number: string
  displayName: string
  type: string
  status: string
  user?: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
}

const DialpadPage: React.FC = () => {
  const { user } = useAuthStore()
  const [dialedNumber, setDialedNumber] = useState('')
  const [isCallActive, setIsCallActive] = useState(false)
  const [callStatus, setCallStatus] = useState<'idle' | 'dialing' | 'ringing' | 'connected' | 'ending'>('idle')
  const [callDuration, setCallDuration] = useState(0)
  const [isOnHold, setIsOnHold] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(50)
  const [showContacts, setShowContacts] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [availableExtensions, setAvailableExtensions] = useState<Extension[]>([])
  const [selectedExtension, setSelectedExtension] = useState<string>('')
  const [showExtensionSelector, setShowExtensionSelector] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Mock data for contacts
  const [contacts] = useState<Contact[]>([
    { id: '1', name: 'John Smith', number: '+1234567890', company: 'Tech Corp' },
    { id: '2', name: 'Jane Doe', number: '+1987654321', company: 'Sales Inc' },
    { id: '3', name: 'Bob Johnson', number: '+1555666777', company: 'Support LLC' },
    { id: '4', name: 'Alice Wilson', number: '+1444555888' },
    { id: '5', name: 'Emergency Services', number: '911' },
    { id: '6', name: 'Reception', number: '1001' }
  ])

  // Mock data for call history
  const [callHistory] = useState<CallHistory[]>([
    { id: '1', number: '+1234567890', name: 'John Smith', time: new Date(Date.now() - 3600000), duration: 180, type: 'outgoing' },
    { id: '2', number: '+1987654321', name: 'Jane Doe', time: new Date(Date.now() - 7200000), duration: 0, type: 'missed' },
    { id: '3', number: '+1555666777', name: 'Bob Johnson', time: new Date(Date.now() - 10800000), duration: 240, type: 'incoming' },
    { id: '4', number: '1001', name: 'Reception', time: new Date(Date.now() - 14400000), duration: 45, type: 'outgoing' },
    { id: '5', number: '+1444555888', name: 'Alice Wilson', time: new Date(Date.now() - 18000000), duration: 320, type: 'incoming' }
  ])

  // Keypad buttons configuration
  const keypadButtons = [
    { key: '1', letters: '' },
    { key: '2', letters: 'ABC' },
    { key: '3', letters: 'DEF' },
    { key: '4', letters: 'GHI' },
    { key: '5', letters: 'JKL' },
    { key: '6', letters: 'MNO' },
    { key: '7', letters: 'PQRS' },
    { key: '8', letters: 'TUV' },
    { key: '9', letters: 'WXYZ' },
    { key: '*', letters: '' },
    { key: '0', letters: '+' },
    { key: '#', letters: '' }
  ]

  // Filter contacts based on search
  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.number.includes(searchQuery) ||
    (contact.company && contact.company.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Filter call history based on search
  const filteredHistory = callHistory.filter(call =>
    call.number.includes(searchQuery) ||
    (call.name && call.name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Check if user is superadmin
  const isSuperAdmin = user?.role === 'superadmin'

  // Get current extension (selected for superadmin, own for others)
  const getCurrentExtension = () => {
    if (isSuperAdmin && selectedExtension) {
      return selectedExtension
    }
    return user?.extensionId || '1000'
  }

  // Fetch available extensions for superadmin
  const fetchAvailableExtensions = async () => {
    if (!isSuperAdmin) return

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('authToken')
      const response = await fetch(`${API_BASE_URL}/extensions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setAvailableExtensions(data.data)
          // Set default extension to user's own extension if available
          if (!selectedExtension && user?.extensionId) {
            setSelectedExtension(user.extensionId)
          } else if (!selectedExtension && data.data.length > 0) {
            setSelectedExtension(data.data[0].number)
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch extensions:', error)
    }
  }

  // Handle keypad button press
  const handleKeyPress = (key: string) => {
    if (isCallActive) {
      // During call, send DTMF tones
      sendDTMF(key)
      toast.success(`DTMF tone sent: ${key}`)
    } else {
      // Add to dialed number
      setDialedNumber(prev => prev + key)
    }
  }

  // Clear dialed number
  const clearNumber = () => {
    setDialedNumber('')
  }

  // Remove last digit
  const backspace = () => {
    setDialedNumber(prev => prev.slice(0, -1))
  }

  // Initiate call
  const makeCall = async () => {
    if (!dialedNumber.trim()) {
      toast.error('Please enter a number to call')
      return
    }

    if (isSuperAdmin && !selectedExtension) {
      toast.error('Please select an extension to call from')
      return
    }

    try {
      setIsCallActive(true)
      setCallStatus('dialing')
      toast.loading('Initiating call...')

      // API call to initiate call
      const token = localStorage.getItem('token') || localStorage.getItem('authToken')
      const response = await fetch(`${API_BASE_URL}/pbx/calls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fromNumber: getCurrentExtension(),
          toNumber: dialedNumber
        })
      })

      if (response.ok) {
        setCallStatus('ringing')
        toast.dismiss()
        toast.success(`Calling ${dialedNumber}...`)

        // Simulate call connection after 2-5 seconds
        setTimeout(() => {
          setCallStatus('connected')
          startCallTimer()
          toast.success('Call connected')
        }, Math.random() * 3000 + 2000)
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(`Failed to initiate call: ${response.status} - ${errorData.error || response.statusText}`)
      }
    } catch (error) {
      console.error('Call initiation failed:', error)
      toast.dismiss()
      toast.error('Failed to initiate call')
      setIsCallActive(false)
      setCallStatus('idle')
    }
  }

  // End call
  const endCall = async () => {
    try {
      setCallStatus('ending')
      toast.loading('Ending call...')

      // Simulate API call to end call
      // In real implementation, you'd call the actual endpoint

      setTimeout(() => {
        setIsCallActive(false)
        setCallStatus('idle')
        setCallDuration(0)
        setIsOnHold(false)
        setIsMuted(false)
        stopCallTimer()
        toast.dismiss()
        toast.success('Call ended')
      }, 1000)
    } catch (error) {
      console.error('Failed to end call:', error)
      toast.error('Failed to end call')
    }
  }

  // Toggle hold
  const toggleHold = () => {
    setIsOnHold(!isOnHold)
    toast.success(isOnHold ? 'Call resumed' : 'Call on hold')
  }

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted)
    toast.success(isMuted ? 'Microphone unmuted' : 'Microphone muted')
  }

  // Send DTMF tones
  const sendDTMF = (tone: string) => {
    // In real implementation, this would send DTMF tones through the SIP connection
    console.log(`Sending DTMF tone: ${tone}`)
  }

  // Start call timer
  const startCallTimer = () => {
    intervalRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1)
    }, 1000)
  }

  // Stop call timer
  const stopCallTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  // Format call duration
  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Format time for history
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Dial number from contacts or history
  const dialNumber = (number: string) => {
    setDialedNumber(number)
    setShowContacts(false)
    setShowHistory(false)
  }

  // Fetch extensions on mount for superadmin
  useEffect(() => {
    fetchAvailableExtensions()
  }, [user])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCallTimer()
    }
  }, [])

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Phone Dialpad</h1>
        <p className="mt-2 text-gray-600">Make and manage calls with the integrated softphone</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Dialpad Section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-lg p-6">
            {/* Call Status Display */}
            <div className="mb-6">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-mono text-gray-900 mb-2">
                  {dialedNumber || 'Enter number'}
                </div>

                {isCallActive && (
                  <div className="space-y-2">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      callStatus === 'dialing' ? 'bg-yellow-100 text-yellow-800' :
                      callStatus === 'ringing' ? 'bg-blue-100 text-blue-800' :
                      callStatus === 'connected' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {callStatus === 'dialing' && '📱 Dialing...'}
                      {callStatus === 'ringing' && '📞 Ringing...'}
                      {callStatus === 'connected' && '✅ Connected'}
                      {callStatus === 'ending' && '⏹️ Ending...'}
                    </div>

                    {callStatus === 'connected' && (
                      <div className="text-lg font-medium text-gray-700">
                        {formatDuration(callDuration)}
                      </div>
                    )}

                    {isOnHold && (
                      <div className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-800 rounded text-sm">
                        ⏸️ On Hold
                      </div>
                    )}

                    {isMuted && (
                      <div className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 rounded text-sm">
                        🔇 Muted
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Keypad */}
            <div className="mb-6">
              <div className="grid grid-cols-3 gap-3">
                {keypadButtons.map((button) => (
                  <button
                    key={button.key}
                    onClick={() => handleKeyPress(button.key)}
                    className="aspect-square bg-gray-100 hover:bg-gray-200 rounded-lg text-xl font-semibold text-gray-800 transition-colors duration-150 flex flex-col items-center justify-center space-y-1"
                  >
                    <span className="text-2xl">{button.key}</span>
                    {button.letters && (
                      <span className="text-xs text-gray-500">{button.letters}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <button
                onClick={backspace}
                disabled={!dialedNumber && !isCallActive}
                className="btn-secondary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⬅️ Back
              </button>

              <button
                onClick={isCallActive ? endCall : makeCall}
                disabled={!dialedNumber && !isCallActive}
                className={`py-3 font-medium rounded-lg transition-colors ${
                  isCallActive
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {isCallActive ? '📞 End Call' : '📞 Call'}
              </button>

              <button
                onClick={clearNumber}
                disabled={!dialedNumber && !isCallActive}
                className="btn-secondary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🗑️ Clear
              </button>
            </div>

            {/* Call Controls (shown during active call) */}
            {isCallActive && callStatus === 'connected' && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Call Controls</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={toggleMute}
                    className={`py-3 px-4 rounded-lg font-medium transition-colors ${
                      isMuted
                        ? 'bg-red-100 text-red-800 hover:bg-red-200'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {isMuted ? '🔇 Unmute' : '🎤 Mute'}
                  </button>

                  <button
                    onClick={toggleHold}
                    className={`py-3 px-4 rounded-lg font-medium transition-colors ${
                      isOnHold
                        ? 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {isOnHold ? '▶️ Resume' : '⏸️ Hold'}
                  </button>
                </div>

                {/* Volume Control */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Volume: {volume}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => setVolume(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Contacts & History */}
        <div className="space-y-6">
          {/* Extension Selector (SuperAdmin only) */}
          {isSuperAdmin && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Call From Extension</h3>
              <div className="space-y-3">
                <select
                  value={selectedExtension}
                  onChange={(e) => setSelectedExtension(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Extension</option>
                  {availableExtensions.map((ext) => (
                    <option key={ext.id} value={ext.number}>
                      {ext.number} - {ext.displayName}
                      {ext.user && ` (${ext.user.firstName} ${ext.user.lastName})`}
                    </option>
                  ))}
                </select>

                {selectedExtension && (
                  <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                    <div className="font-medium">Selected Extension:</div>
                    <div>{selectedExtension}</div>
                    {availableExtensions.find(ext => ext.number === selectedExtension)?.displayName && (
                      <div className="text-xs">{availableExtensions.find(ext => ext.number === selectedExtension)?.displayName}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Access</h3>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowContacts(!showContacts)
                  setShowHistory(false)
                  setSearchQuery('')
                }}
                className={`w-full py-2 px-4 rounded-lg text-left transition-colors ${
                  showContacts ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                👥 Contacts ({contacts.length})
              </button>

              <button
                onClick={() => {
                  setShowHistory(!showHistory)
                  setShowContacts(false)
                  setSearchQuery('')
                }}
                className={`w-full py-2 px-4 rounded-lg text-left transition-colors ${
                  showHistory ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                📞 Recent Calls ({callHistory.length})
              </button>
            </div>
          </div>

          {/* Search */}
          {(showContacts || showHistory) && (
            <div className="bg-white rounded-lg shadow-lg p-4">
              <input
                type="text"
                placeholder={showContacts ? "Search contacts..." : "Search call history..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Contacts List */}
          {showContacts && (
            <div className="bg-white rounded-lg shadow-lg">
              <div className="p-4 border-b">
                <h3 className="text-lg font-medium text-gray-900">Contacts</h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {filteredContacts.length > 0 ? (
                  <div className="divide-y">
                    {filteredContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => dialNumber(contact.number)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{contact.name}</div>
                            <div className="text-sm text-gray-600">{contact.number}</div>
                            {contact.company && (
                              <div className="text-xs text-gray-500">{contact.company}</div>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              dialNumber(contact.number)
                            }}
                            className="ml-2 p-2 text-green-600 hover:bg-green-100 rounded-lg"
                          >
                            📞
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    No contacts found
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Call History */}
          {showHistory && (
            <div className="bg-white rounded-lg shadow-lg">
              <div className="p-4 border-b">
                <h3 className="text-lg font-medium text-gray-900">Call History</h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {filteredHistory.length > 0 ? (
                  <div className="divide-y">
                    {filteredHistory.map((call) => (
                      <div
                        key={call.id}
                        className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => dialNumber(call.number)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className={`text-sm ${
                                call.type === 'outgoing' ? 'text-green-600' :
                                call.type === 'incoming' ? 'text-blue-600' :
                                'text-red-600'
                              }`}>
                                {call.type === 'outgoing' ? '↗️' :
                                 call.type === 'incoming' ? '↙️' : '❌'}
                              </span>
                              <div className="font-medium text-gray-900">
                                {call.name || call.number}
                              </div>
                            </div>
                            <div className="text-sm text-gray-600">{call.number}</div>
                            <div className="text-xs text-gray-500">
                              {formatTime(call.time)} • {call.duration ? formatDuration(call.duration) : 'No answer'}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              dialNumber(call.number)
                            }}
                            className="ml-2 p-2 text-green-600 hover:bg-green-100 rounded-lg"
                          >
                            📞
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    No call history found
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Extension Info */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {isSuperAdmin ? 'Current Extension' : 'My Extension'}
            </h3>
            <div className="space-y-2">
              <div className="text-sm text-gray-600">
                Extension: <span className="font-medium">{getCurrentExtension()}</span>
              </div>
              {isSuperAdmin && selectedExtension && availableExtensions.find(ext => ext.number === selectedExtension) ? (
                <div className="text-sm text-gray-600">
                  Display Name: <span className="font-medium">
                    {availableExtensions.find(ext => ext.number === selectedExtension)?.displayName}
                  </span>
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  User: <span className="font-medium">{user?.firstName} {user?.lastName}</span>
                </div>
              )}
              {isSuperAdmin && selectedExtension && availableExtensions.find(ext => ext.number === selectedExtension)?.user && (
                <div className="text-sm text-gray-600">
                  Assigned User: <span className="font-medium">
                    {availableExtensions.find(ext => ext.number === selectedExtension)?.user?.firstName} {availableExtensions.find(ext => ext.number === selectedExtension)?.user?.lastName}
                  </span>
                </div>
              )}
              <div className="text-sm text-gray-600">
                Status: <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                  🟢 Available
                </span>
              </div>
              <div className="text-sm text-gray-600">
                SIP Domain: <span className="font-medium">pbx.cloudcall.local</span>
              </div>
              {isSuperAdmin && (
                <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded mt-2">
                  💼 SuperAdmin: You can call from any extension
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DialpadPage