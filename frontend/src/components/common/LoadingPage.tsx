import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../services/api'

interface LoadingPageProps {
  onComplete: () => void
}

const LoadingPage: React.FC<LoadingPageProps> = ({ onComplete }) => {
  const { user, updateUser } = useAuthStore()
  const [loadingSteps, setLoadingSteps] = useState([
    { id: 1, label: 'Authenticating user', completed: false, loading: true },
    { id: 2, label: 'Loading subscription data', completed: false, loading: false },
    { id: 3, label: 'Fetching tenant information', completed: false, loading: false },
    { id: 4, label: 'Initializing workspace', completed: false, loading: false },
  ])
  const [currentStep, setCurrentStep] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)

  useEffect(() => {
    if (!user || hasStarted) return

    setHasStarted(true)
    const loadData = async () => {
      try {
        // Step 1: User Authentication (already done)
        setTimeout(() => {
          setLoadingSteps(prev =>
            prev.map((step, idx) =>
              idx === 0 ? { ...step, completed: true, loading: false } : step
            )
          )
          setCurrentStep(1)
        }, 800)

        // Step 2: Load subscription data
        setTimeout(async () => {
          setLoadingSteps(prev =>
            prev.map((step, idx) =>
              idx === 1 ? { ...step, loading: true } : step
            )
          )

          try {
            const subscription = await api.getSubscription()
            updateUser({ subscription: subscription.data })
          } catch (error) {
            console.warn('No subscription found:', error)
          }

          setLoadingSteps(prev =>
            prev.map((step, idx) =>
              idx === 1 ? { ...step, completed: true, loading: false } : step
            )
          )
          setCurrentStep(2)
        }, 1200)

        // Step 3: Load tenant information
        setTimeout(async () => {
          setLoadingSteps(prev =>
            prev.map((step, idx) =>
              idx === 2 ? { ...step, loading: true } : step
            )
          )

          try {
            const tenant = await api.getCurrentTenant()
            updateUser({ tenant: tenant.data })
          } catch (error) {
            console.warn('Failed to load tenant:', error)
          }

          setLoadingSteps(prev =>
            prev.map((step, idx) =>
              idx === 2 ? { ...step, completed: true, loading: false } : step
            )
          )
          setCurrentStep(3)
        }, 2000)

        // Step 4: Initialize workspace
        setTimeout(() => {
          setLoadingSteps(prev =>
            prev.map((step, idx) =>
              idx === 3 ? { ...step, loading: true } : step
            )
          )

          setTimeout(() => {
            setLoadingSteps(prev =>
              prev.map((step, idx) =>
                idx === 3 ? { ...step, completed: true, loading: false } : step
              )
            )

            // Complete loading
            setTimeout(() => {
              onComplete()
            }, 500)
          }, 1000)
        }, 2800)

      } catch (error) {
        console.error('Loading error:', error)
        onComplete()
      }
    }

    loadData()
  }, [user, hasStarted])

  const getStepIcon = (step: typeof loadingSteps[0]) => {
    if (step.completed) {
      return <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </div>
    } else if (step.loading) {
      return <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    } else {
      return <div className="w-6 h-6 bg-gray-300 rounded-full"></div>
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
      <div className="max-w-md w-full px-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">CloudCall PBX</h1>
          <p className="text-gray-600">Setting up your workspace...</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="space-y-4">
            {loadingSteps.map((step, index) => (
              <div key={step.id} className="flex items-center space-x-3">
                {getStepIcon(step)}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    step.completed ? 'text-green-600' :
                    step.loading ? 'text-blue-600' : 'text-gray-400'
                  }`}>
                    {step.label}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="mt-6">
            <div className="flex justify-between text-xs text-gray-600 mb-2">
              <span>Progress</span>
              <span>{Math.round(((currentStep) / loadingSteps.length) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${((currentStep) / loadingSteps.length) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* User info */}
          {user && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Welcome back, {user.firstName}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {user.role.replace('_', ' ')} • {user.tenant?.name || 'Loading...'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            Powered by CloudCall PBX • Enterprise Cloud Communications
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoadingPage