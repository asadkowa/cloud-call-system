import React, { useState, useEffect } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'

interface Company {
  id: string
  name: string
  domain: string
  planType: string
  maxExtensions: number
  maxConcurrentCalls: number
  features: string
  isActive: boolean
  createdAt: string
  _count: {
    users: number
    extensions: number
    calls: number
  }
}

interface SubscriptionPlan {
  id: string
  name: string
  description: string
  monthlyPrice: number
  yearlyPrice: number
  features: any[]
  maxExtensions: number
  maxConcurrentCalls: number
  maxUsers: number
  isActive: boolean
}

interface CompanyFormData {
  name: string
  domain: string
  planType: string
  maxExtensions: number
  maxConcurrentCalls: number
  isActive: boolean
}

const CompaniesPage: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([])
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [processing, setProcessing] = useState(false)
  const [formData, setFormData] = useState<CompanyFormData>({
    name: '',
    domain: '',
    planType: 'basic',
    maxExtensions: 10,
    maxConcurrentCalls: 5,
    isActive: true
  })

  const { user: currentUser } = useAuthStore()

  useEffect(() => {
    if (currentUser?.role !== 'superadmin') {
      toast.error('SuperAdmin access required')
      return
    }
    fetchCompanies()
    fetchPlans()
  }, [currentUser])

  const fetchCompanies = async () => {
    try {
      const response = await api.getTenants()
      if (response.success) {
        setCompanies(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error)
      toast.error('Failed to load companies')
    } finally {
      setLoading(false)
    }
  }

  const fetchPlans = async () => {
    try {
      const response = await api.getAdminPlans()
      if (response.success) {
        setPlans(response.data)
      }
    } catch (error) {
      console.error('Failed to fetch plans:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      domain: '',
      planType: 'basic',
      maxExtensions: 10,
      maxConcurrentCalls: 5,
      isActive: true
    })
  }

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.domain) {
      toast.error('Please fill in all required fields')
      return
    }

    setProcessing(true)
    try {
      const response = await api.createTenant(formData)
      if (response.success) {
        // Create subscription for the company
        try {
          await api.createSubscription({
            planType: formData.planType as 'basic' | 'professional' | 'enterprise',
            billingCycle: 'monthly'
          })
        } catch (subError) {
          console.warn('Failed to create subscription:', subError)
          // Don't fail the company creation if subscription fails
        }

        toast.success('Company created successfully')
        setShowCreateModal(false)
        resetForm()
        fetchCompanies()
      } else {
        toast.error(response.error || 'Failed to create company')
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to create company')
    } finally {
      setProcessing(false)
    }
  }

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedCompany || !formData.name || !formData.domain) {
      toast.error('Please fill in all required fields')
      return
    }

    setProcessing(true)
    try {
      const response = await api.updateTenant(selectedCompany.id, formData)
      if (response.success) {
        toast.success('Company updated successfully')
        setShowEditModal(false)
        setSelectedCompany(null)
        resetForm()
        fetchCompanies()
      } else {
        toast.error(response.error || 'Failed to update company')
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to update company')
    } finally {
      setProcessing(false)
    }
  }

  const handleDeleteCompany = async () => {
    if (!selectedCompany) return

    setProcessing(true)
    try {
      const response = await api.deleteTenant(selectedCompany.id)
      if (response.success) {
        toast.success('Company deleted successfully')
        setShowDeleteModal(false)
        setSelectedCompany(null)
        fetchCompanies()
      } else {
        toast.error(response.error || 'Failed to delete company')
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to delete company')
    } finally {
      setProcessing(false)
    }
  }

  const openEditModal = (company: Company) => {
    setSelectedCompany(company)
    setFormData({
      name: company.name,
      domain: company.domain,
      planType: company.planType,
      maxExtensions: company.maxExtensions,
      maxConcurrentCalls: company.maxConcurrentCalls,
      isActive: company.isActive
    })
    setShowEditModal(true)
  }

  const formatFeatures = (featuresString: string) => {
    try {
      const features = JSON.parse(featuresString)
      if (Array.isArray(features)) {
        return features.filter(f => f.enabled).map(f => f.name).join(', ')
      }
      return 'N/A'
    } catch {
      return 'N/A'
    }
  }

  const getPlanBadgeColor = (planType: string) => {
    switch (planType) {
      case 'basic': return 'bg-blue-100 text-blue-800'
      case 'professional': return 'bg-purple-100 text-purple-800'
      case 'enterprise': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (currentUser?.role !== 'superadmin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">SuperAdmin access required to view this page</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Company Management</h1>
          <p className="text-gray-600">Manage companies linked to your PBX system</p>
        </div>
        <div className="flex space-x-3">
          <a
            href="/admin/plans"
            className="btn-secondary px-4 py-2 flex items-center space-x-2"
          >
            <span>⚙️</span>
            <span>Manage Plans</span>
          </a>
          <button
            onClick={() => {
              resetForm()
              setShowCreateModal(true)
            }}
            className="btn-primary px-4 py-2"
          >
            Add Company
          </button>
        </div>
      </div>

      {/* Companies Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Limits</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Features</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{company.name}</div>
                      <div className="text-sm text-gray-500">{company.domain}</div>
                      <div className="text-xs text-gray-400">
                        Created: {new Date(company.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <span className={`px-2 py-1 text-xs rounded-full capitalize ${getPlanBadgeColor(company.planType)}`}>
                        {company.planType}
                      </span>
                      {(() => {
                        const plan = plans.find(p => p.name.toLowerCase() === company.planType.toLowerCase())
                        return plan ? (
                          <div className="text-xs text-gray-500 mt-1">
                            ${(plan.monthlyPrice / 100).toFixed(2)}/month
                          </div>
                        ) : null
                      })()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>{company.maxExtensions} extensions</div>
                    <div>{company.maxConcurrentCalls} concurrent calls</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>{company._count.users} users</div>
                    <div>{company._count.extensions} extensions</div>
                    <div>{company._count.calls} calls</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      company.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {company.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="max-w-xs truncate" title={formatFeatures(company.features)}>
                      {formatFeatures(company.features)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => openEditModal(company)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCompany(company)
                        setShowDeleteModal(true)
                      }}
                      disabled={company._count.users > 0 || company._count.extensions > 0}
                      className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={company._count.users > 0 || company._count.extensions > 0
                        ? 'Cannot delete company with active users or extensions'
                        : 'Delete company'
                      }
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

      {companies.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg">No companies found</div>
          <p className="text-gray-500 mt-2">Get started by adding your first company</p>
        </div>
      )}

      {/* Create Company Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Add New Company</h2>
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

            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter company name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Domain *
                </label>
                <input
                  type="text"
                  value={formData.domain}
                  onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="company.example.com"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Plan Type
                  </label>
                  <select
                    value={formData.planType}
                    onChange={(e) => {
                      const selectedPlan = plans.find(p => p.name.toLowerCase() === e.target.value)
                      if (selectedPlan) {
                        setFormData(prev => ({
                          ...prev,
                          planType: e.target.value,
                          maxExtensions: selectedPlan.maxExtensions,
                          maxConcurrentCalls: selectedPlan.maxConcurrentCalls
                        }))
                      } else {
                        setFormData(prev => ({ ...prev, planType: e.target.value }))
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="basic">Basic</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                    {plans.filter(plan => !['basic', 'professional', 'enterprise'].includes(plan.name.toLowerCase())).map(plan => (
                      <option key={plan.id} value={plan.name.toLowerCase()}>
                        {plan.name} - ${(plan.monthlyPrice / 100).toFixed(2)}/month
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Extensions
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxExtensions}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxExtensions: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Concurrent Calls
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxConcurrentCalls}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxConcurrentCalls: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700">Active</span>
                  </label>
                </div>
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
                  disabled={processing}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </div>
                  ) : (
                    'Create Company'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Company Modal */}
      {showEditModal && selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Edit Company</h2>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedCompany(null)
                  resetForm()
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter company name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Domain *
                </label>
                <input
                  type="text"
                  value={formData.domain}
                  onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value }))}
                  required
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  placeholder="company.example.com"
                />
                <p className="text-xs text-gray-500 mt-1">Domain cannot be changed after creation</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Plan Type
                  </label>
                  <select
                    value={formData.planType}
                    onChange={(e) => {
                      const selectedPlan = plans.find(p => p.name.toLowerCase() === e.target.value)
                      if (selectedPlan) {
                        setFormData(prev => ({
                          ...prev,
                          planType: e.target.value,
                          maxExtensions: selectedPlan.maxExtensions,
                          maxConcurrentCalls: selectedPlan.maxConcurrentCalls
                        }))
                      } else {
                        setFormData(prev => ({ ...prev, planType: e.target.value }))
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="basic">Basic</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                    {plans.filter(plan => !['basic', 'professional', 'enterprise'].includes(plan.name.toLowerCase())).map(plan => (
                      <option key={plan.id} value={plan.name.toLowerCase()}>
                        {plan.name} - ${(plan.monthlyPrice / 100).toFixed(2)}/month
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Extensions
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxExtensions}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxExtensions: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Concurrent Calls
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxConcurrentCalls}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxConcurrentCalls: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedCompany(null)
                    resetForm()
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </div>
                  ) : (
                    'Update Company'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Company Modal */}
      {showDeleteModal && selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Delete Company</h2>
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setSelectedCompany(null)
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
                        Are you sure you want to delete company "{selectedCompany.name}"?
                      </p>
                      <p className="mt-2">
                        This action cannot be undone. All company data will be permanently removed.
                      </p>
                      {(selectedCompany._count.users > 0 || selectedCompany._count.extensions > 0) && (
                        <p className="mt-2 font-semibold">
                          This company has {selectedCompany._count.users} users and {selectedCompany._count.extensions} extensions.
                          Remove all users and extensions before deletion.
                        </p>
                      )}
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
                  setSelectedCompany(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCompany}
                disabled={processing || selectedCompany._count.users > 0 || selectedCompany._count.extensions > 0}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </div>
                ) : (
                  'Delete Company'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CompaniesPage