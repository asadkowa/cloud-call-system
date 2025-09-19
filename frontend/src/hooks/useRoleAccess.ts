import { useAuthStore, UserRole } from '../store/authStore'

export interface RolePermissions {
  canManageUsers: boolean
  canManageExtensions: boolean
  canViewBilling: boolean
  canManageBilling: boolean
  canViewCalls: boolean
  canManageCalls: boolean
  canViewReports: boolean
  canManageCompanies: boolean
  canManagePlans: boolean
  canViewPbx: boolean
  canManagePbx: boolean
  canAccessAllTenants: boolean
  canManageSettings: boolean
  canCreateUsers: boolean
  canDeleteUsers: boolean
  canAssignExtensions: boolean
  canViewFullCallHistory: boolean
  canExportData: boolean
}

export const useRoleAccess = () => {
  const { user, isSuperAdmin, isCompanyAdmin } = useAuthStore()

  const getPermissions = (): RolePermissions => {
    if (!user) {
      return {
        canManageUsers: false,
        canManageExtensions: false,
        canViewBilling: false,
        canManageBilling: false,
        canViewCalls: false,
        canManageCalls: false,
        canViewReports: false,
        canManageCompanies: false,
        canManagePlans: false,
        canViewPbx: false,
        canManagePbx: false,
        canAccessAllTenants: false,
        canManageSettings: false,
        canCreateUsers: false,
        canDeleteUsers: false,
        canAssignExtensions: false,
        canViewFullCallHistory: false,
        canExportData: false,
      }
    }

    const role = user.role

    switch (role) {
      case 'superadmin':
        return {
          canManageUsers: true,
          canManageExtensions: true,
          canViewBilling: true,
          canManageBilling: true,
          canViewCalls: true,
          canManageCalls: true,
          canViewReports: true,
          canManageCompanies: true,
          canManagePlans: true,
          canViewPbx: true,
          canManagePbx: true,
          canAccessAllTenants: true,
          canManageSettings: true,
          canCreateUsers: true,
          canDeleteUsers: true,
          canAssignExtensions: true,
          canViewFullCallHistory: true,
          canExportData: true,
        }

      case 'company_admin':
        return {
          canManageUsers: true,
          canManageExtensions: true,
          canViewBilling: true,
          canManageBilling: true,
          canViewCalls: true,
          canManageCalls: true,
          canViewReports: true,
          canManageCompanies: false,
          canManagePlans: false,
          canViewPbx: true,
          canManagePbx: true,
          canAccessAllTenants: false,
          canManageSettings: true,
          canCreateUsers: true,
          canDeleteUsers: true,
          canAssignExtensions: true,
          canViewFullCallHistory: true,
          canExportData: true,
        }

      case 'supervisor':
        return {
          canManageUsers: true,
          canManageExtensions: true,
          canViewBilling: true,
          canManageBilling: false,
          canViewCalls: true,
          canManageCalls: true,
          canViewReports: true,
          canManageCompanies: false,
          canManagePlans: false,
          canViewPbx: true,
          canManagePbx: false,
          canAccessAllTenants: false,
          canManageSettings: false,
          canCreateUsers: false,
          canDeleteUsers: false,
          canAssignExtensions: true,
          canViewFullCallHistory: true,
          canExportData: false,
        }

      case 'agent':
        return {
          canManageUsers: false,
          canManageExtensions: false,
          canViewBilling: false,
          canManageBilling: false,
          canViewCalls: true,
          canManageCalls: false,
          canViewReports: false,
          canManageCompanies: false,
          canManagePlans: false,
          canViewPbx: false,
          canManagePbx: false,
          canAccessAllTenants: false,
          canManageSettings: false,
          canCreateUsers: false,
          canDeleteUsers: false,
          canAssignExtensions: false,
          canViewFullCallHistory: false,
          canExportData: false,
        }

      case 'user':
        return {
          canManageUsers: false,
          canManageExtensions: false,
          canViewBilling: false,
          canManageBilling: false,
          canViewCalls: true,
          canManageCalls: false,
          canViewReports: false,
          canManageCompanies: false,
          canManagePlans: false,
          canViewPbx: false,
          canManagePbx: false,
          canAccessAllTenants: false,
          canManageSettings: false,
          canCreateUsers: false,
          canDeleteUsers: false,
          canAssignExtensions: false,
          canViewFullCallHistory: false,
          canExportData: false,
        }

      default:
        return {
          canManageUsers: false,
          canManageExtensions: false,
          canViewBilling: false,
          canManageBilling: false,
          canViewCalls: false,
          canManageCalls: false,
          canViewReports: false,
          canManageCompanies: false,
          canManagePlans: false,
          canViewPbx: false,
          canManagePbx: false,
          canAccessAllTenants: false,
          canManageSettings: false,
          canCreateUsers: false,
          canDeleteUsers: false,
          canAssignExtensions: false,
          canViewFullCallHistory: false,
          canExportData: false,
        }
    }
  }

  const permissions = getPermissions()

  const hasRole = (roles: UserRole | UserRole[]): boolean => {
    if (!user) return false
    const allowedRoles = Array.isArray(roles) ? roles : [roles]
    return allowedRoles.includes(user.role)
  }

  const hasPermission = (permission: keyof RolePermissions): boolean => {
    return permissions[permission]
  }

  const hasAnyPermission = (permissionKeys: (keyof RolePermissions)[]): boolean => {
    return permissionKeys.some(key => permissions[key])
  }

  const hasAllPermissions = (permissionKeys: (keyof RolePermissions)[]): boolean => {
    return permissionKeys.every(key => permissions[key])
  }

  const canAccessFeature = (feature: string): boolean => {
    if (isSuperAdmin()) return true

    // Check subscription features
    if (user?.subscription?.plan?.features) {
      return user.subscription.plan.features.some(
        (f: any) => f === feature || f.name === feature || f.key === feature
      )
    }

    // Check tenant features
    if (user?.tenant?.features) {
      try {
        const features = typeof user.tenant.features === 'string'
          ? JSON.parse(user.tenant.features)
          : user.tenant.features

        if (Array.isArray(features)) {
          return features.includes(feature)
        }
      } catch {
        // If parsing fails, deny access for safety
        return false
      }
    }

    return false
  }

  return {
    user,
    permissions,
    hasRole,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessFeature,
    isSuperAdmin: isSuperAdmin(),
    isCompanyAdmin: isCompanyAdmin(),
  }
}

export default useRoleAccess