import React, { useState, useEffect } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'

interface Plan {
  id: string
  name: string
  monthlyPrice: number
  yearlyPrice: number
  features: string[]
  maxExtensions: number
  maxConcurrentCalls: number
}

interface Subscription {
  id: string
  planType: string
  status: string
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAt?: string
  canceledAt?: string
  trialStart?: string
  trialEnd?: string
  quantity: number
}

interface UsageData {
  usage: any[]
  summary: Record<string, number>
  overages: {
    calls: number
    seats: number
    totalOverageAmount: number
  }
}

const BillingPage: React.FC = () => {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [processingAction, setProcessingAction] = useState(false)
  const { user: currentUser } = useAuthStore()

  useEffect(() => {
    fetchBillingData()
  }, [])

  const fetchBillingData = async () => {
    try {
      const [subscriptionResponse, plansResponse, usageResponse] = await Promise.all([
        api.getSubscription().catch(() => ({ success: false, data: null })),
        api.getSubscriptionPlans(),
        api.getUsageData().catch(() => ({ success: false, data: null }))
      ])

      if (subscriptionResponse.success || subscriptionResponse.data) {
        setSubscription(subscriptionResponse.data || subscriptionResponse)
      }
      if (plansResponse.success || Array.isArray(plansResponse)) {
        setPlans(plansResponse.data || plansResponse)
      }
      if (usageResponse.success || usageResponse.data) {
        setUsageData(usageResponse.data || usageResponse)
      }
    } catch (error) {
      console.error('Failed to fetch billing data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getPlanDisplayName = (planType: string) => {
    return planType.charAt(0).toUpperCase() + planType.slice(1)
  }

  const handlePlanSelect = (plan: Plan) => {
    setSelectedPlan(plan)
    setShowPlanModal(true)
  }

  const handleSubscribe = async () => {
    if (!selectedPlan) return

    setProcessingAction(true)
    try {
      const response = await api.createSubscription({
        planType: selectedPlan.id as 'basic' | 'professional' | 'enterprise',
        billingCycle,
        trialDays: 14
      })

      if (response.success || response.subscription) {
        toast.success('Subscription created successfully!')
        setShowPlanModal(false)
        fetchBillingData()
      } else {
        toast.error(response.error || 'Failed to create subscription')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create subscription')
    } finally {
      setProcessingAction(false)
    }
  }

  const handlePlanChange = async (newPlan: Plan) => {
    if (!subscription) return

    setProcessingAction(true)
    try {
      const response = await api.updateSubscription({
        planType: newPlan.id as 'basic' | 'professional' | 'enterprise'
      })

      if (response.success || response.subscription) {
        toast.success('Plan updated successfully!')
        fetchBillingData()
      } else {
        toast.error(response.error || 'Failed to update plan')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update plan')
    } finally {
      setProcessingAction(false)
    }
  }

  const handleCancelSubscription = async (immediate = false) => {
    if (!subscription) return

    setProcessingAction(true)
    try {
      const response = await api.cancelSubscription(immediate)

      if (response.success || response.subscription) {
        toast.success(immediate ? 'Subscription canceled immediately' : 'Subscription will be canceled at the end of the billing period')
        fetchBillingData()
      } else {
        toast.error(response.error || 'Failed to cancel subscription')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel subscription')
    } finally {
      setProcessingAction(false)
    }
  }

  const handleReactivateSubscription = async () => {
    if (!subscription) return

    setProcessingAction(true)
    try {
      const response = await api.reactivateSubscription()

      if (response.success || response.subscription) {
        toast.success('Subscription reactivated successfully!')
        fetchBillingData()
      } else {
        toast.error(response.error || 'Failed to reactivate subscription')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to reactivate subscription')
    } finally {
      setProcessingAction(false)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'trialing': return 'bg-blue-100 text-blue-800'
      case 'canceled': return 'bg-red-100 text-red-800'
      case 'past_due': return 'bg-yellow-100 text-yellow-800'
      case 'unpaid': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const currentPlan = plans.find(plan => plan.id === subscription?.planType)

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
          <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
          <p className="text-gray-600">Manage your subscription and billing information</p>
        </div>
      </div>

      {/* Current Subscription */}
      {subscription ? (
        <div className="card p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Current Subscription</h3>
              <p className="text-gray-600">Plan details and billing information</p>
            </div>
            <span className={`px-3 py-1 text-sm rounded-full ${getStatusBadgeColor(subscription.status)}`}>
              {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Plan</label>
              <div className="text-lg font-semibold text-gray-900">
                {getPlanDisplayName(subscription.planType)}
              </div>
              {currentPlan && (
                <div className="text-sm text-gray-500">
                  {formatPrice(currentPlan.monthlyPrice)}/month
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Current Period</label>
              <div className="text-sm text-gray-900">
                {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
              </div>
            </div>

            {subscription.trialEnd && new Date(subscription.trialEnd) > new Date() && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Trial Ends</label>
                <div className="text-sm text-blue-600 font-medium">
                  {formatDate(subscription.trialEnd)}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Quantity</label>
              <div className="text-lg font-semibold text-gray-900">{subscription.quantity}</div>
            </div>
          </div>

          {subscription.cancelAt && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                Your subscription will be canceled on {formatDate(subscription.cancelAt)}
              </p>
            </div>
          )}

          <div className="mt-6 flex space-x-3">
            {subscription.status === 'active' && !subscription.cancelAt && (
              <>
                <button
                  onClick={() => handleCancelSubscription(false)}
                  disabled={processingAction}
                  className="btn-secondary px-4 py-2 disabled:opacity-50"
                >
                  {processingAction ? 'Processing...' : 'Cancel at Period End'}
                </button>
                <button
                  onClick={() => handleCancelSubscription(true)}
                  disabled={processingAction}
                  className="btn-danger px-4 py-2 disabled:opacity-50"
                >
                  {processingAction ? 'Processing...' : 'Cancel Immediately'}
                </button>
              </>
            )}

            {subscription.cancelAt && (
              <button
                onClick={handleReactivateSubscription}
                disabled={processingAction}
                className="btn-primary px-4 py-2 disabled:opacity-50"
              >
                {processingAction ? 'Processing...' : 'Reactivate Subscription'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card p-6 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Subscription</h3>
          <p className="text-gray-600 mb-4">Choose a plan to get started with our service</p>
        </div>
      )}

      {/* Available Plans */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Available Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`card p-6 relative ${
                subscription?.planType === plan.id ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              {subscription?.planType === plan.id && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-500 text-white px-3 py-1 text-xs rounded-full">
                    Current Plan
                  </span>
                </div>
              )}

              <div className="text-center mb-4">
                <h4 className="text-xl font-semibold text-gray-900">{plan.name}</h4>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-gray-900">
                    {formatPrice(billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice)}
                  </span>
                  <span className="text-gray-600">/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
                </div>
                {billingCycle === 'yearly' && (
                  <p className="text-sm text-green-600 mt-1">
                    Save {Math.round((1 - (plan.yearlyPrice / (plan.monthlyPrice * 12))) * 100)}%
                  </p>
                )}
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Max Extensions</span>
                  <span className="font-medium">{plan.maxExtensions}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Concurrent Calls</span>
                  <span className="font-medium">{plan.maxConcurrentCalls}</span>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                <h5 className="font-medium text-gray-900">Features:</h5>
                <ul className="space-y-1">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-center">
                      <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {feature.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                {!subscription ? (
                  <button
                    onClick={() => handlePlanSelect(plan)}
                    className="w-full btn-primary py-2"
                  >
                    Start Free Trial
                  </button>
                ) : subscription.planType === plan.id ? (
                  <button disabled className="w-full btn-secondary py-2 opacity-50">
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handlePlanChange(plan)}
                    disabled={processingAction}
                    className="w-full btn-primary py-2 disabled:opacity-50"
                  >
                    {processingAction ? 'Processing...' : 'Switch to This Plan'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Usage Statistics */}
      {usageData && subscription && (
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Current Usage</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {usageData.summary.call_minutes || 0}
              </div>
              <div className="text-sm text-gray-600">Call Minutes Used</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {usageData.summary.seat_count || 0}
              </div>
              <div className="text-sm text-gray-600">Active Seats</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {usageData.summary.sms_count || 0}
              </div>
              <div className="text-sm text-gray-600">SMS Sent</div>
            </div>
          </div>

          {usageData.overages.totalOverageAmount > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                <strong>Overage Charges:</strong> ${usageData.overages.totalOverageAmount.toFixed(2)}
                (Calls: {usageData.overages.calls}, Seats: {usageData.overages.seats})
              </p>
            </div>
          )}
        </div>
      )}

      {/* Plan Selection Modal */}
      {showPlanModal && selectedPlan && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Subscribe to {selectedPlan.name}
                </h3>
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Billing Cycle
                  </label>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setBillingCycle('monthly')}
                      className={`flex-1 py-2 px-3 text-sm rounded-md ${
                        billingCycle === 'monthly'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setBillingCycle('yearly')}
                      className={`flex-1 py-2 px-3 text-sm rounded-md ${
                        billingCycle === 'yearly'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Yearly (Save {Math.round((1 - (selectedPlan.yearlyPrice / (selectedPlan.monthlyPrice * 12))) * 100)}%)
                    </button>
                  </div>
                </div>

                <div className="text-center p-4 bg-blue-50 rounded-md">
                  <div className="text-2xl font-bold text-blue-900">
                    {formatPrice(billingCycle === 'yearly' ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice)}
                    <span className="text-sm font-normal text-blue-600">
                      /{billingCycle === 'yearly' ? 'year' : 'month'}
                    </span>
                  </div>
                  <p className="text-sm text-blue-700 mt-1">
                    14-day free trial included
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  disabled={processingAction}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubscribe}
                  disabled={processingAction}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingAction ? 'Creating...' : 'Start Free Trial'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BillingPage