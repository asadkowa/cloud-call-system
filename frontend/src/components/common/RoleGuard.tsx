import React from 'react'
import { useAuthStore, UserRole } from '../../store/authStore'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
  fallback?: React.ReactNode
  requireAll?: boolean
}

const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  allowedRoles,
  fallback = null,
  requireAll = false
}) => {
  const { user } = useAuthStore()

  if (!user) {
    return <>{fallback}</>
  }

  const hasAccess = requireAll
    ? allowedRoles.every(role => user.role === role)
    : allowedRoles.includes(user.role)

  return hasAccess ? <>{children}</> : <>{fallback}</>
}

export default RoleGuard