import React from 'react'
import { useAuthStore } from '../../store/authStore'
import { useRoleAccess } from '../../hooks/useRoleAccess'
import AccessBadge from './AccessBadge'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore()
  const { permissions } = useRoleAccess()

  // Define navigation items based on user permissions
  const getNavigationItems = () => {
    const items = []

    // Dashboard (all roles)
    items.push({
      name: 'Dashboard',
      href: '/dashboard',
      icon: '🏠',
      permission: null,
      section: 'main'
    })

    // Calls (all roles can view, but different access levels)
    if (permissions.canViewCalls) {
      items.push({
        name: 'Calls',
        href: '/calls',
        icon: '📞',
        permission: 'canViewCalls',
        section: 'main'
      })
    }

    // Dialpad (all roles can use)
    items.push({
      name: 'Dialpad',
      href: '/dialpad',
      icon: '🔢',
      permission: null,
      section: 'main'
    })

    // User management
    if (permissions.canManageUsers) {
      items.push({
        name: 'Users',
        href: '/users',
        icon: '👥',
        permission: 'canManageUsers',
        section: 'main'
      })
    }

    // Extension management
    if (permissions.canManageExtensions) {
      items.push({
        name: 'Extensions',
        href: '/extensions',
        icon: '📱',
        permission: 'canManageExtensions',
        section: 'main'
      })
    }

    // PBX management
    if (permissions.canViewPbx) {
      items.push({
        name: 'PBX Cluster',
        href: '/pbx',
        icon: '🔧',
        permission: 'canViewPbx',
        section: 'main'
      })
    }

    // Billing section
    if (permissions.canViewBilling) {
      items.push({
        name: 'Billing',
        href: '/billing',
        icon: '💳',
        permission: 'canViewBilling',
        section: 'billing'
      })
    }

    // SuperAdmin-specific billing features
    if (user?.role === 'superadmin') {
      items.push({
        name: 'Payment Reports',
        href: '/billing/reports',
        icon: '📊',
        permission: null,
        section: 'billing'
      })
    }

    // Company and Platform Management (Super Admin only)
    if (permissions.canManageCompanies) {
      items.push({
        name: 'Companies',
        href: '/companies',
        icon: '🏢',
        permission: 'canManageCompanies',
        section: 'platform'
      })
    }

    // Plan management (Super Admin only)
    if (permissions.canManagePlans) {
      items.push({
        name: 'Plan Management',
        href: '/admin/plans',
        icon: '📋',
        permission: 'canManagePlans',
        section: 'platform'
      })
    }

    // SuperAdmin-specific platform features
    if (user?.role === 'superadmin') {
      items.push({
        name: 'System Analytics',
        href: '/admin/analytics',
        icon: '📈',
        permission: null,
        section: 'platform'
      })

      items.push({
        name: 'System Health',
        href: '/admin/health',
        icon: '💓',
        permission: null,
        section: 'platform'
      })
    }

    // Settings (role-specific settings pages)
    if (user?.role === 'superadmin') {
      items.push({
        name: 'Platform Settings',
        href: '/settings',
        icon: '⚙️',
        permission: null,
        section: 'settings'
      })

      items.push({
        name: 'Admin Configuration',
        href: '/admin/settings',
        icon: '🔧',
        permission: null,
        section: 'settings'
      })
    } else if (permissions.canManageSettings || user?.role === 'agent' || user?.role === 'user') {
      items.push({
        name: 'Settings',
        href: '/settings',
        icon: '🔧',
        permission: null,
        section: 'settings'
      })
    }

    return items
  }

  const navigationItems = getNavigationItems()

  // Group navigation items by section for SuperAdmin
  const groupedNavigation = () => {
    if (user?.role !== 'superadmin') {
      return { ungrouped: navigationItems }
    }

    const grouped = navigationItems.reduce((acc, item) => {
      const section = item.section || 'ungrouped'
      if (!acc[section]) acc[section] = []
      acc[section].push(item)
      return acc
    }, {})

    return grouped
  }

  const navGroups = groupedNavigation()

  const getSectionTitle = (section) => {
    const titles = {
      main: 'Main',
      billing: 'Billing & Finance',
      platform: 'Platform Management',
      settings: 'Configuration'
    }
    return titles[section] || ''
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Cloud Call Center</h1>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-700">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className="text-xs text-gray-500 capitalize">
                  {user?.role}
                </div>
              </div>
              <button
                onClick={logout}
                className="btn-secondary px-3 py-1"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        <aside className="w-64 bg-white shadow-sm min-h-screen border-r border-gray-200">
          <nav className="mt-8 px-4">
            {user?.role === 'superadmin' ? (
              <div className="space-y-6">
                {Object.entries(navGroups).map(([section, items]) => (
                  <div key={section}>
                    {section !== 'ungrouped' && (
                      <div className="mb-3">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2">
                          {getSectionTitle(section)}
                        </h3>
                      </div>
                    )}
                    <ul className="space-y-1">
                      {items.map((item) => (
                        <li key={item.name}>
                          <a
                            href={item.href}
                            className="block px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-blue-50 hover:text-blue-700 flex items-center space-x-3 transition-colors"
                          >
                            <span className="text-base">{item.icon}</span>
                            <span>{item.name}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="space-y-2">
                {navigationItems.map((item) => (
                  <li key={item.name}>
                    <a
                      href={item.href}
                      className="block px-4 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-100 flex items-center space-x-2"
                    >
                      <span>{item.icon}</span>
                      <span>{item.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}

            {/* Role and access indicator */}
            <div className="mt-8 px-4 py-3 bg-gray-100 rounded-lg">
              <div className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
                Access Level
              </div>
              <AccessBadge showTenant={true} showSubscription={true} />

              {/* Tenant status */}
              {user?.tenant && (
                <div className="mt-2 text-xs text-gray-500">
                  <div className="flex items-center justify-between">
                    <span>Status:</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                      user.tenant.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.tenant.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </nav>
        </aside>

        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout