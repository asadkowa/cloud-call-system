import React from 'react'
import { useAuthStore, UserRole } from '../../store/authStore'

interface AccessBadgeProps {
  className?: string
  showTenant?: boolean
  showSubscription?: boolean
}

const AccessBadge: React.FC<AccessBadgeProps> = ({
  className = '',
  showTenant = false,
  showSubscription = false
}) => {
  const { user } = useAuthStore()

  if (!user) return null

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'superadmin':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'company_admin':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'supervisor':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'agent':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'user':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getRoleDisplayName = (role: UserRole) => {
    switch (role) {
      case 'superadmin':
        return 'Super Admin'
      case 'company_admin':
        return 'Company Admin'
      case 'supervisor':
        return 'Supervisor'
      case 'agent':
        return 'Agent'
      case 'user':
        return 'User'
      default:
        return role
    }
  }

  const getSubscriptionStatus = () => {
    if (!user.subscription) return 'No Subscription'

    switch (user.subscription.status) {
      case 'active':
        return user.subscription.plan?.name || 'Active Plan'
      case 'trialing':
        return 'Trial Period'
      case 'past_due':
        return 'Payment Due'
      case 'canceled':
        return 'Canceled'
      case 'incomplete':
        return 'Setup Required'
      default:
        return user.subscription.status
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Role Badge */}
      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeStyle(user.role)}`}>
        {getRoleDisplayName(user.role)}
      </div>

      {/* Tenant Info */}
      {showTenant && user.tenant && (
        <div className="text-xs text-gray-600">
          <div className="font-medium">{user.tenant.name}</div>
          <div className="text-gray-500">{user.tenant.domain}</div>
        </div>
      )}

      {/* Subscription Info */}
      {showSubscription && (
        <div className="text-xs">
          <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
            user.subscription?.status === 'active' ? 'bg-green-100 text-green-800' :
            user.subscription?.status === 'trialing' ? 'bg-yellow-100 text-yellow-800' :
            user.subscription?.status === 'past_due' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {getSubscriptionStatus()}
          </div>
        </div>
      )}
    </div>
  )
}

export default AccessBadge