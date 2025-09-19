import React, { useState, useEffect } from 'react'
import { api } from '../../services/api'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'

interface PaymentMethod {
  id: string
  type: string
  card?: {
    brand: string
    last4: string
    exp_month: number
    exp_year: number
    funding: string
  }
  billing_details?: {
    name?: string
    email?: string
    address?: {
      city?: string
      country?: string
      line1?: string
      line2?: string
      postal_code?: string
      state?: string
    }
  }
  created: number
}

interface PaymentMethodManagerProps {
  onPaymentMethodAdded?: (paymentMethod: PaymentMethod) => void
  onPaymentMethodRemoved?: (paymentMethodId: string) => void
}

const PaymentMethodManager: React.FC<PaymentMethodManagerProps> = ({
  onPaymentMethodAdded,
  onPaymentMethodRemoved
}) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [processingAction, setProcessingAction] = useState<string | null>(null)
  const { user } = useAuthStore()

  useEffect(() => {
    fetchPaymentMethods()
  }, [])

  const fetchPaymentMethods = async () => {
    try {
      const response = await api.get('/payments/methods/list')
      setPaymentMethods(response.data.paymentMethods || [])
    } catch (error: any) {
      console.error('Failed to fetch payment methods:', error)
      toast.error('Failed to load payment methods')
    } finally {
      setLoading(false)
    }
  }

  const handleAddPaymentMethod = async () => {
    setProcessingAction('adding')
    try {
      // Create setup intent
      const setupResponse = await api.post('/payments/setup-intent')
      const { clientSecret } = setupResponse.data

      // In a real implementation, you'd integrate with Stripe Elements
      // For demo purposes, we'll simulate the process
      toast.success('Payment method setup initiated. Please complete the Stripe setup form.')

      // Refresh payment methods after a delay (in real implementation, this would be triggered by webhook)
      setTimeout(() => {
        fetchPaymentMethods()
        setShowAddForm(false)
        if (onPaymentMethodAdded) {
          // This would be the actual payment method from Stripe
          onPaymentMethodAdded({
            id: 'pm_demo_' + Date.now(),
            type: 'card',
            card: {
              brand: 'visa',
              last4: '4242',
              exp_month: 12,
              exp_year: 2025,
              funding: 'credit'
            },
            created: Date.now()
          })
        }
      }, 2000)
    } catch (error: any) {
      console.error('Failed to add payment method:', error)
      toast.error('Failed to add payment method')
    } finally {
      setProcessingAction(null)
    }
  }

  const handleRemovePaymentMethod = async (paymentMethodId: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) {
      return
    }

    setProcessingAction(paymentMethodId)
    try {
      await api.delete(`/payments/methods/${paymentMethodId}`)
      setPaymentMethods(prev => prev.filter(pm => pm.id !== paymentMethodId))
      toast.success('Payment method removed successfully')

      if (onPaymentMethodRemoved) {
        onPaymentMethodRemoved(paymentMethodId)
      }
    } catch (error: any) {
      console.error('Failed to remove payment method:', error)
      toast.error('Failed to remove payment method')
    } finally {
      setProcessingAction(null)
    }
  }

  const formatCardBrand = (brand: string) => {
    return brand.charAt(0).toUpperCase() + brand.slice(1)
  }

  const getCardIcon = (brand: string) => {
    const icons: Record<string, string> = {
      visa: '💳',
      mastercard: '💳',
      amex: '💳',
      discover: '💳',
      diners: '💳',
      jcb: '💳',
      unionpay: '💳'
    }
    return icons[brand.toLowerCase()] || '💳'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Payment Methods</h3>
          <p className="text-sm text-gray-600">Manage your saved payment methods</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary px-4 py-2 text-sm"
          disabled={processingAction === 'adding'}
        >
          {processingAction === 'adding' ? 'Adding...' : 'Add Payment Method'}
        </button>
      </div>

      {/* Payment Methods List */}
      {paymentMethods.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <h4 className="text-lg font-medium text-gray-900 mb-2">No payment methods</h4>
          <p className="text-gray-600 mb-4">Add a payment method to enable automatic billing</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-primary px-4 py-2"
          >
            Add Your First Payment Method
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {paymentMethods.map((paymentMethod) => (
            <div key={paymentMethod.id} className="card p-4 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-8 bg-gray-100 rounded flex items-center justify-center text-lg">
                  {paymentMethod.card ? getCardIcon(paymentMethod.card.brand) : '💳'}
                </div>
                <div>
                  <div className="font-medium text-gray-900">
                    {paymentMethod.card
                      ? `${formatCardBrand(paymentMethod.card.brand)} ending in ${paymentMethod.card.last4}`
                      : 'Unknown payment method'
                    }
                  </div>
                  {paymentMethod.card && (
                    <div className="text-sm text-gray-600">
                      Expires {paymentMethod.card.exp_month.toString().padStart(2, '0')}/{paymentMethod.card.exp_year}
                      {paymentMethod.card.funding && (
                        <span className="ml-2 px-2 py-1 bg-gray-100 rounded text-xs">
                          {paymentMethod.card.funding}
                        </span>
                      )}
                    </div>
                  )}
                  {paymentMethod.billing_details?.name && (
                    <div className="text-sm text-gray-600">
                      {paymentMethod.billing_details.name}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                  Active
                </span>
                <button
                  onClick={() => handleRemovePaymentMethod(paymentMethod.id)}
                  disabled={processingAction === paymentMethod.id}
                  className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                >
                  {processingAction === paymentMethod.id ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Payment Method Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Add Payment Method</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-400 hover:text-gray-600"
                disabled={processingAction === 'adding'}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      Secure Payment Setup
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>
                        In a production environment, this would show a secure Stripe Elements form
                        for collecting payment method details.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Demo Form - In production, this would be Stripe Elements */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Card Number
                  </label>
                  <input
                    type="text"
                    placeholder="4242 4242 4242 4242"
                    className="input w-full"
                    disabled
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expiry
                    </label>
                    <input
                      type="text"
                      placeholder="MM/YY"
                      className="input w-full"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CVC
                    </label>
                    <input
                      type="text"
                      placeholder="123"
                      className="input w-full"
                      disabled
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                  disabled={processingAction === 'adding'}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddPaymentMethod}
                  disabled={processingAction === 'adding'}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingAction === 'adding' ? 'Adding...' : 'Add Payment Method'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PaymentMethodManager