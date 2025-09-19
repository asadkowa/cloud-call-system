import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UserRole = 'superadmin' | 'company_admin' | 'supervisor' | 'agent' | 'user'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  tenantId: string
  extensionId?: string
  tenant?: {
    id: string
    name: string
    domain: string
    planType: string
    isActive: boolean
    features?: string | string[]
  }
  subscription?: {
    id: string
    status: string
    planType: string
    currentPeriodEnd: string
    trialEnd?: string
    plan?: {
      name: string
      monthlyPrice: number
      features: any[]
    }
  }
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (user: User, token: string) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
  setLoading: (loading: boolean) => void
  isSuperAdmin: () => boolean
  isCompanyAdmin: () => boolean
  canAccessTenant: (tenantId: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: (user, token) => {
        set({ user, token, isAuthenticated: true, isLoading: false })
      },
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false, isLoading: false })
      },
      updateUser: (userData) => {
        const currentUser = get().user
        if (currentUser) {
          set({ user: { ...currentUser, ...userData } })
        }
      },
      setLoading: (loading) => {
        set({ isLoading: loading })
      },
      isSuperAdmin: () => {
        const user = get().user
        return user?.role === 'superadmin'
      },
      isCompanyAdmin: () => {
        const user = get().user
        return user?.role === 'company_admin'
      },
      canAccessTenant: (tenantId) => {
        const user = get().user
        if (!user) return false
        if (user.role === 'superadmin') return true
        return user.tenantId === tenantId
      },
    }),
    {
      name: 'auth-storage',
    }
  )
)