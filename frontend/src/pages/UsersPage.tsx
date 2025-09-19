import React, { useState, useEffect } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { useRoleAccess } from '../hooks/useRoleAccess'
import RoleGuard from '../components/common/RoleGuard'
import { getRoleDisplayInfo } from '../utils/roleUtils'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  isActive: boolean
  createdAt: string
  planId?: string
  subscription?: {
    id: string
    planId: string
    status: string
    billingCycle: string
    plan?: {
      id: string
      name: string
      monthlyPrice: number
      yearlyPrice: number
    }
  }
  extension?: {
    id: string
    number: string
    displayName: string
    type: string
    status: string
  }
}

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [extensions, setExtensions] = useState<any[]>([])
  const [subscriptionPlans, setSubscriptionPlans] = useState<any[]>([])
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    role: 'agent',
    extensionId: '',
    planId: ''
  })
  const [editFormData, setEditFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'agent',
    extensionId: '',
    planId: ''
  })
  const { hasPermission } = useRoleAccess()

  useEffect(() => {
    fetchUsers()
    fetchExtensions()
    fetchSubscriptionPlans()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await api.getUsers()
      if (response.success) {
        setUsers(response.data)
      }
    } catch (error) {
      toast.error('Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  const fetchExtensions = async () => {
    try {
      const response = await api.getExtensions()
      if (response.success) {
        // Filter out extensions that are already assigned to users
        const assignedExtensionIds = users.map(user => user.extension?.id).filter(Boolean)
        const availableExtensions = response.data.filter((ext: any) =>
          ext.type === 'user' && !assignedExtensionIds.includes(ext.id)
        )
        setExtensions(availableExtensions)
      }
    } catch (error) {
      console.error('Failed to fetch extensions:', error)
    }
  }

  const fetchSubscriptionPlans = async () => {
    try {
      const response = await api.getAdminPlans(false) // Only active plans
      if (response.success) {
        setSubscriptionPlans(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch subscription plans:', error)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.email || !formData.firstName || !formData.lastName || !formData.password) {
      toast.error('Please fill in all required fields')
      return
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters long')
      return
    }

    setCreateLoading(true)
    try {
      const userData = {
        ...formData,
        extensionId: formData.extensionId || undefined,
        planId: formData.planId || undefined
      }

      const response = await api.createUser(userData)
      if (response.success) {
        toast.success('User created successfully')
        await fetchUsers()
        await fetchExtensions() // Refresh available extensions
        setShowCreateModal(false)
        resetForm()
      } else {
        toast.error(response.error || 'Failed to create user')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create user')
    } finally {
      setCreateLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      email: '',
      firstName: '',
      lastName: '',
      password: '',
      role: 'agent',
      extensionId: '',
      planId: ''
    })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const openEditModal = (user: User) => {
    setSelectedUser(user)
    setEditFormData({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      extensionId: user.extension?.id || '',
      planId: user.subscription?.planId || ''
    })
    setShowEditModal(true)
    fetchExtensions()
    fetchSubscriptionPlans()
  }

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedUser || !editFormData.email || !editFormData.firstName || !editFormData.lastName) {
      toast.error('Please fill in all required fields')
      return
    }

    setEditLoading(true)
    try {
      const updateData = {
        ...editFormData,
        extensionId: editFormData.extensionId || undefined,
        planId: editFormData.planId || undefined
      }

      const response = await api.updateUser(selectedUser.id, updateData)
      if (response.success) {
        toast.success('User updated successfully')
        await fetchUsers()
        await fetchExtensions()
        setShowEditModal(false)
        setSelectedUser(null)
        resetEditForm()
      } else {
        toast.error(response.error || 'Failed to update user')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user')
    } finally {
      setEditLoading(false)
    }
  }

  const handleToggleUserStatus = async (user: User) => {
    setActionLoading(user.id)
    try {
      const newStatus = !user.isActive
      const response = await api.updateUser(user.id, { isActive: newStatus })

      if (response.success) {
        toast.success(`User ${newStatus ? 'activated' : 'deactivated'} successfully`)
        await fetchUsers()
      } else {
        toast.error(response.error || 'Failed to update user status')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user status')
    } finally {
      setActionLoading(null)
    }
  }

  const resetEditForm = () => {
    setEditFormData({
      email: '',
      firstName: '',
      lastName: '',
      role: 'agent',
      extensionId: '',
      planId: ''
    })
  }

  const handleDeleteUser = async () => {
    if (!selectedUser) return

    setActionLoading(selectedUser.id)
    try {
      const response = await api.deleteUser(selectedUser.id)
      if (response.success) {
        toast.success('User deleted successfully')
        await fetchUsers()
        await fetchExtensions()
        setShowDeleteModal(false)
        setSelectedUser(null)
      } else {
        toast.error(response.error || 'Failed to delete user')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user')
    } finally {
      setActionLoading(null)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    const roleInfo = getRoleDisplayInfo(role as any)
    switch (roleInfo.color) {
      case 'red': return 'bg-red-100 text-red-800'
      case 'blue': return 'bg-blue-100 text-blue-800'
      case 'purple': return 'bg-purple-100 text-purple-800'
      case 'green': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusBadgeColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-600">Manage users and their extensions</p>
        </div>
        <RoleGuard allowedRoles={['superadmin', 'company_admin', 'supervisor']}>
          {hasPermission('canCreateUsers') && (
            <button
              onClick={() => {
                setShowCreateModal(true)
                fetchExtensions()
              }}
              className="btn-primary px-4 py-2"
            >
              Add User
            </button>
          )}
        </RoleGuard>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((user) => (
          <div key={user.id} className="card p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-lg font-medium text-gray-600">
                  {user.firstName[0]}{user.lastName[0]}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900">
                  {user.firstName} {user.lastName}
                </h3>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Role</span>
                <span className={`px-2 py-1 text-xs rounded-full ${getRoleBadgeColor(user.role)}`}>
                  {getRoleDisplayInfo(user.role as any).name}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Status</span>
                <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeColor(user.isActive)}`}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {user.extension && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Extension</span>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {user.extension.number}
                    </div>
                    <div className="text-xs text-gray-500">
                      {user.extension.displayName}
                    </div>
                  </div>
                </div>
              )}

              {user.subscription?.plan && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Plan</span>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {user.subscription.plan.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      ${(user.subscription.billingCycle === 'yearly'
                        ? user.subscription.plan.yearlyPrice
                        : user.subscription.plan.monthlyPrice) / 100}/{user.subscription.billingCycle === 'yearly' ? 'yr' : 'mo'}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Created</span>
                <span className="text-sm text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <RoleGuard allowedRoles={['superadmin', 'company_admin', 'supervisor']}>
              {hasPermission('canManageUsers') && (
                <div className="mt-4 flex space-x-2">
                  <button
                    onClick={() => openEditModal(user)}
                    className="btn-secondary flex-1 px-3 py-2 text-sm"
                  >
                    Edit
                  </button>
                  {user.isActive ? (
                    <button
                      onClick={() => handleToggleUserStatus(user)}
                      disabled={actionLoading === user.id}
                      className="btn-danger flex-1 px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading === user.id ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                          ...
                        </div>
                      ) : (
                        'Deactivate'
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleUserStatus(user)}
                      disabled={actionLoading === user.id}
                      className="btn-success flex-1 px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading === user.id ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                          ...
                        </div>
                      ) : (
                        'Activate'
                      )}
                    </button>
                  )}

                  {hasPermission('canDeleteUsers') && (
                    <button
                      onClick={() => {
                        setSelectedUser(user)
                        setShowDeleteModal(true)
                      }}
                      disabled={actionLoading === user.id}
                      className="btn-danger px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </RoleGuard>
          </div>
        ))}
      </div>

      {users.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg">No users found</div>
          <p className="text-gray-500 mt-2">Get started by adding your first user</p>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Add New User</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  resetForm()
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter first name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter password (min 6 characters)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="user">User</option>
                  <option value="agent">Agent</option>
                  <option value="supervisor">Supervisor</option>
                  <RoleGuard allowedRoles={['superadmin', 'company_admin']}>
                    <option value="company_admin">Company Admin</option>
                  </RoleGuard>
                  <RoleGuard allowedRoles={['superadmin']}>
                    <option value="superadmin">Super Admin</option>
                  </RoleGuard>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Extension (Optional)
                </label>
                <select
                  name="extensionId"
                  value={formData.extensionId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No Extension</option>
                  {extensions.map((extension) => (
                    <option key={extension.id} value={extension.id}>
                      {extension.number} - {extension.displayName}
                    </option>
                  ))}
                </select>
                {extensions.length === 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    No available extensions. Create extensions first to assign them to users.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subscription Plan (Optional)
                </label>
                <select
                  name="planId"
                  value={formData.planId}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No Plan</option>
                  {subscriptionPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - ${plan.monthlyPrice / 100}/mo
                    </option>
                  ))}
                </select>
                {subscriptionPlans.length === 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    No subscription plans available. Create plans first to assign them to users.
                  </p>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    resetForm()
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </div>
                  ) : (
                    'Create User'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Edit User</h2>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedUser(null)
                  resetEditForm()
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleEditUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={editFormData.firstName}
                    onChange={handleEditInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter first name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={editFormData.lastName}
                    onChange={handleEditInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  value={editFormData.email}
                  onChange={handleEditInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  name="role"
                  value={editFormData.role}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="user">User</option>
                  <option value="agent">Agent</option>
                  <option value="supervisor">Supervisor</option>
                  <RoleGuard allowedRoles={['superadmin', 'company_admin']}>
                    <option value="company_admin">Company Admin</option>
                  </RoleGuard>
                  <RoleGuard allowedRoles={['superadmin']}>
                    <option value="superadmin">Super Admin</option>
                  </RoleGuard>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Extension (Optional)
                </label>
                <select
                  name="extensionId"
                  value={editFormData.extensionId}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No Extension</option>
                  {selectedUser?.extension && (
                    <option value={selectedUser.extension.id}>
                      {selectedUser.extension.number} - {selectedUser.extension.displayName} (Current)
                    </option>
                  )}
                  {extensions
                    .filter(ext => ext.id !== selectedUser?.extension?.id)
                    .map((extension) => (
                      <option key={extension.id} value={extension.id}>
                        {extension.number} - {extension.displayName}
                      </option>
                    ))}
                </select>
                {extensions.length === 0 && !selectedUser?.extension && (
                  <p className="text-sm text-gray-500 mt-1">
                    No available extensions.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subscription Plan (Optional)
                </label>
                <select
                  name="planId"
                  value={editFormData.planId}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No Plan</option>
                  {selectedUser?.subscription?.plan && (
                    <option value={selectedUser.subscription.plan.id}>
                      {selectedUser.subscription.plan.name} - ${selectedUser.subscription.plan.monthlyPrice / 100}/mo (Current)
                    </option>
                  )}
                  {subscriptionPlans
                    .filter(plan => plan.id !== selectedUser?.subscription?.plan?.id)
                    .map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} - ${plan.monthlyPrice / 100}/mo
                      </option>
                    ))}
                </select>
                {subscriptionPlans.length === 0 && !selectedUser?.subscription?.plan && (
                  <p className="text-sm text-gray-500 mt-1">
                    No subscription plans available.
                  </p>
                )}
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      <strong>Note:</strong> User's password cannot be changed through this form. Use the separate password reset functionality.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedUser(null)
                    resetEditForm()
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </div>
                  ) : (
                    'Update User'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Delete User</h2>
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setSelectedUser(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Permanent Deletion Warning
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>
                        Are you sure you want to delete user "{selectedUser.firstName} {selectedUser.lastName}"?
                      </p>
                      <p className="mt-2">
                        This action cannot be undone. All user data, including their extension assignment and subscription, will be permanently removed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false)
                  setSelectedUser(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={actionLoading === selectedUser.id}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === selectedUser.id ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </div>
                ) : (
                  'Delete User'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UsersPage