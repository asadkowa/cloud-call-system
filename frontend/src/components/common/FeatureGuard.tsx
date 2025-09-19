import React from 'react'
import { useAuthStore } from '../../store/authStore'

interface FeatureGuardProps {
  children: React.ReactNode
  feature: string
  fallback?: React.ReactNode
  tenantCheck?: boolean
}

const FeatureGuard: React.FC<FeatureGuardProps> = ({
  children,
  feature,
  fallback = null,
  tenantCheck = true
}) => {
  const { user, isSuperAdmin } = useAuthStore()

  if (!user) {
    return <>{fallback}</>
  }

  // Super admin has access to all features
  if (isSuperAdmin()) {
    return <>{children}</>
  }

  // Check tenant subscription features
  if (tenantCheck && user.subscription?.plan?.features) {
    const hasFeature = user.subscription.plan.features.some(
      (f: any) => f === feature || f.name === feature || f.key === feature
    )

    if (!hasFeature) {
      return <>{fallback}</>
    }
  }

  // Check tenant features
  if (user.tenant && typeof user.tenant.features === 'string') {
    try {
      const features = JSON.parse(user.tenant.features)
      if (Array.isArray(features) && !features.includes(feature)) {
        return <>{fallback}</>
      }
    } catch {
      // If features parsing fails, allow access
    }
  }

  return <>{children}</>
}

export default FeatureGuard