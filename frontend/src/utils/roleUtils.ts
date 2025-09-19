import { UserRole } from '../store/authStore'

export const ROLE_HIERARCHY = {
  superadmin: 5,
  company_admin: 4,
  supervisor: 3,
  agent: 2,
  user: 1
}

export const hasHigherRole = (userRole: UserRole, requiredRole: UserRole): boolean => {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

export const canAccessTenantData = (userRole: UserRole, userTenantId: string, targetTenantId: string): boolean => {
  // Super admin can access all tenant data
  if (userRole === 'superadmin') {
    return true
  }

  // Other roles can only access their own tenant data
  return userTenantId === targetTenantId
}

export const getMaxAllowedActions = (role: UserRole) => {
  switch (role) {
    case 'superadmin':
      return {
        maxTenants: Infinity,
        maxUsers: Infinity,
        maxExtensions: Infinity,
        canDeleteAnyUser: true,
        canModifyBilling: true,
        canAccessSystemSettings: true
      }
    case 'company_admin':
      return {
        maxTenants: 1,
        maxUsers: Infinity,
        maxExtensions: Infinity,
        canDeleteAnyUser: true,
        canModifyBilling: true,
        canAccessSystemSettings: false
      }
    case 'supervisor':
      return {
        maxTenants: 1,
        maxUsers: 50,
        maxExtensions: 50,
        canDeleteAnyUser: false,
        canModifyBilling: false,
        canAccessSystemSettings: false
      }
    case 'agent':
      return {
        maxTenants: 1,
        maxUsers: 0,
        maxExtensions: 1,
        canDeleteAnyUser: false,
        canModifyBilling: false,
        canAccessSystemSettings: false
      }
    case 'user':
      return {
        maxTenants: 1,
        maxUsers: 0,
        maxExtensions: 1,
        canDeleteAnyUser: false,
        canModifyBilling: false,
        canAccessSystemSettings: false
      }
    default:
      return {
        maxTenants: 0,
        maxUsers: 0,
        maxExtensions: 0,
        canDeleteAnyUser: false,
        canModifyBilling: false,
        canAccessSystemSettings: false
      }
  }
}

export const getRoleDisplayInfo = (role: UserRole) => {
  switch (role) {
    case 'superadmin':
      return {
        name: 'Super Administrator',
        description: 'Full system access across all organizations',
        color: 'red',
        icon: '👑'
      }
    case 'company_admin':
      return {
        name: 'Company Administrator',
        description: 'Complete control over company resources',
        color: 'blue',
        icon: '🏢'
      }
    case 'supervisor':
      return {
        name: 'Supervisor',
        description: 'Manages team members and operations',
        color: 'purple',
        icon: '👥'
      }
    case 'agent':
      return {
        name: 'Agent',
        description: 'Handles customer calls and interactions',
        color: 'green',
        icon: '🎧'
      }
    case 'user':
      return {
        name: 'User',
        description: 'Basic access to personal features',
        color: 'gray',
        icon: '👤'
      }
    default:
      return {
        name: 'Unknown',
        description: 'Unknown role',
        color: 'gray',
        icon: '❓'
      }
  }
}