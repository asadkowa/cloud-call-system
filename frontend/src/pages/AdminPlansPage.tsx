import React, { useState, useEffect } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'

interface Plan {
  id: string
  name: string
  description?: string
  monthlyPrice: number
  yearlyPrice: number
  features: string[]
  maxExtensions: number
  maxConcurrentCalls: number
  maxUsers: number
  isActive: boolean
  isCustom: boolean
  activeSubscriptions: number
}

interface Tenant {
  id: string
  name: string
  domain: string
  planType: string
  isActive: boolean
  subscription?: {
    id: string
    status: string
    plan?: {
      id: string
      name: string
    }
  }
}

const AdminPlansPage: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [processing, setProcessing] = useState(false)

  const [planForm, setPlanForm] = useState({
    name: '',
    description: '',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [] as string[],
    maxExtensions: 10,
    maxConcurrentCalls: 5,
    maxUsers: 10,
    isActive: true
  })

  const { user: currentUser } = useAuthStore()

  useEffect(() => {
    if (currentUser?.role !== 'superadmin') {
      toast.error('SuperAdmin access required')
      return
    }
    fetchData()
  }, [currentUser, includeInactive])

  const fetchData = async () => {
    try {
      const [plansResponse, tenantsResponse] = await Promise.all([
        api.getAdminPlans(includeInactive),
        api.getAdminTenants()
      ])

      if (plansResponse.success) {
        setPlans(plansResponse.data)
      }
      if (tenantsResponse.success) {
        setTenants(tenantsResponse.data)
      }
    } catch (error) {
      console.error('Failed to fetch Superadmin data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`
  }

  const resetForm = () => {
    setPlanForm({
      name: '',
      description: '',
      monthlyPrice: 0,
      yearlyPrice: 0,
      features: [],
      maxExtensions: 10,
      maxConcurrentCalls: 5,
      maxUsers: 10,
      isActive: true
    })
  }

  const handleCreatePlan = async () => {
    setProcessing(true)
    try {
      const response = await api.createAdminPlan(planForm)
      if (response.success) {
        toast.success('Plan created successfully')
        setShowCreateModal(false)
        resetForm()
        fetchData()
      } else {
        toast.error(response.error || 'Failed to create plan')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create plan')
    } finally {
      setProcessing(false)
    }
  }

  const handleUpdatePlan = async () => {
    if (!selectedPlan) return

    setProcessing(true)
    try {
      const response = await api.updateAdminPlan(selectedPlan.id, planForm)
      if (response.success) {
        toast.success('Plan updated successfully')
        setShowEditModal(false)
        setSelectedPlan(null)
        resetForm()
        fetchData()
      } else {
        toast.error(response.error || 'Failed to update plan')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update plan')
    } finally {
      setProcessing(false)
    }
  }

  const handleDeletePlan = async (plan: Plan) => {
    if (!confirm(`Are you sure you want to delete "${plan.name}"?`)) return

    setProcessing(true)
    try {
      const response = await api.deleteAdminPlan(plan.id)
      if (response.success) {
        toast.success('Plan deleted successfully')
        fetchData()
      } else {
        toast.error(response.error || 'Failed to delete plan')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete plan')
    } finally {
      setProcessing(false)
    }
  }

  const handleToggleStatus = async (plan: Plan) => {
    setProcessing(true)
    try {
      const response = await api.togglePlanStatus(plan.id, !plan.isActive)
      if (response.success) {
        toast.success(`Plan ${!plan.isActive ? 'activated' : 'deactivated'} successfully`)
        fetchData()
      } else {
        toast.error(response.error || 'Failed to toggle plan status')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to toggle plan status')
    } finally {
      setProcessing(false)
    }
  }

  const handleAssignPlan = async (tenantId: string, billingCycle: string) => {
    if (!selectedPlan) return

    setProcessing(true)
    try {
      const response = await api.assignPlanToTenant(selectedPlan.id, tenantId, billingCycle)
      if (response.success) {
        toast.success('Plan assigned successfully')
        setShowAssignModal(false)
        setSelectedPlan(null)
        fetchData()
      } else {
        toast.error(response.error || 'Failed to assign plan')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign plan')
    } finally {
      setProcessing(false)
    }
  }

  const openEditModal = (plan: Plan) => {
    setSelectedPlan(plan)
    setPlanForm({
      name: plan.name,
      description: plan.description || '',
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      features: plan.features,
      maxExtensions: plan.maxExtensions,
      maxConcurrentCalls: plan.maxConcurrentCalls,
      maxUsers: plan.maxUsers,
      isActive: plan.isActive
    })
    setShowEditModal(true)
  }

  const seedDefaultPlans = async () => {
    setProcessing(true)
    try {
      const response = await api.seedDefaultPlans()
      if (response.success) {
        toast.success('Default plans seeded successfully')
        fetchData()
      } else {
        toast.error(response.error || 'Failed to seed plans')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to seed plans')
    } finally {
      setProcessing(false)
    }
  }

  const availableFeatures = [
    'call_routing',
    'voicemail',
    'call_recording',
    'ivr',
    'queue_management',
    'reports',
    'api_access',
    'sso',
    'analytics',
    'crm_integration',
    'webhook_support',
    'custom_branding'
  ]

  if (currentUser?.role !== 'superadmin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Superadmin access required to view this page</p>
        </div>
      </div>
    )
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
          <h1 className="text-2xl font-bold text-gray-900">Plan Management</h1>
          <p className="text-gray-600">Create and manage subscription plans</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={seedDefaultPlans}
            disabled={processing}
            className="btn-secondary px-4 py-2 disabled:opacity-50"
          >
            Seed Default Plans
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary px-4 py-2"
          >
            Create Plan
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="mr-2"
          />
          Include inactive plans
        </label>
      </div>

      {/* Plans Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pricing</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Limits</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Features</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subscriptions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 flex items-center">
                        {plan.name}
                        {plan.isCustom && (
                          <span className="ml-2 px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                            Custom
                          </span>
                        )}
                      </div>
                      {plan.description && (
                        <div className="text-sm text-gray-500">{plan.description}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>{formatPrice(plan.monthlyPrice)}/mo</div>
                    <div className="text-gray-500">{formatPrice(plan.yearlyPrice)}/yr</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>{plan.maxExtensions} ext</div>
                    <div>{plan.maxConcurrentCalls} calls</div>
                    <div>{plan.maxUsers} users</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {plan.features.slice(0, 3).map((feature) => (
                        <span key={feature} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                          {feature.replace('_', ' ')}
                        </span>
                      ))}
                      {plan.features.length > 3 && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                          +{plan.features.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      plan.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {plan.activeSubscriptions}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => openEditModal(plan)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setSelectedPlan(plan)
                        setShowAssignModal(true)
                      }}
                      className="text-green-600 hover:text-green-900"
                    >
                      Assign
                    </button>
                    <button
                      onClick={() => handleToggleStatus(plan)}
                      disabled={processing}
                      className={`${plan.isActive ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'}`}
                    >
                      {plan.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDeletePlan(plan)}
                      disabled={processing || plan.activeSubscriptions > 0}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Plan Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {showCreateModal ? 'Create New Plan' : 'Edit Plan'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setShowEditModal(false)
                    setSelectedPlan(null)
                    resetForm()
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={planForm.name}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={planForm.description}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Price (cents) *</label>
                  <input
                    type="number"
                    value={planForm.monthlyPrice}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, monthlyPrice: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Yearly Price (cents) *</label>
                  <input
                    type="number"
                    value={planForm.yearlyPrice}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, yearlyPrice: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Extensions *</label>
                  <input
                    type="number"
                    value={planForm.maxExtensions}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, maxExtensions: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Concurrent Calls *</label>
                  <input
                    type="number"
                    value={planForm.maxConcurrentCalls}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, maxConcurrentCalls: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Users *</label>
                  <input
                    type="number"
                    value={planForm.maxUsers}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, maxUsers: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={planForm.isActive}
                      onChange={(e) => setPlanForm(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="mr-2"
                    />
                    Active
                  </label>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Features</label>
                <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md p-3">
                  {availableFeatures.map((feature) => (
                    <label key={feature} className="flex items-center text-sm">
                      <input
                        type="checkbox"
                        checked={planForm.features.includes(feature)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPlanForm(prev => ({
                              ...prev,
                              features: [...prev.features, feature]
                            }))
                          } else {
                            setPlanForm(prev => ({
                              ...prev,
                              features: prev.features.filter(f => f !== feature)
                            }))
                          }
                        }}
                        className="mr-2"
                      />
                      {feature.replace('_', ' ')}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setShowEditModal(false)
                    setSelectedPlan(null)
                    resetForm()
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  disabled={processing}
                >
                  Cancel
                </button>
                <button
                  onClick={showCreateModal ? handleCreatePlan : handleUpdatePlan}
                  disabled={processing || !planForm.name}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {processing ? 'Saving...' : showCreateModal ? 'Create Plan' : 'Update Plan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Plan Modal */}
      {showAssignModal && selectedPlan && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Assign "{selectedPlan.name}" Plan
                </h3>
                <button
                  onClick={() => {
                    setShowAssignModal(false)
                    setSelectedPlan(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 max-h-64 overflow-y-auto">
                {tenants.map((tenant) => (
                  <div key={tenant.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{tenant.name}</div>
                      <div className="text-sm text-gray-500">{tenant.domain}</div>
                      {tenant.subscription?.plan && (
                        <div className="text-xs text-blue-600">
                          Current: {tenant.subscription.plan.name}
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleAssignPlan(tenant.id, 'monthly')}
                        disabled={processing}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        Monthly
                      </button>
                      <button
                        onClick={() => handleAssignPlan(tenant.id, 'yearly')}
                        disabled={processing}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                      >
                        Yearly
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowAssignModal(false)
                    setSelectedPlan(null)
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

export default AdminPlansPage