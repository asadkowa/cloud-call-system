import { Request, Response, NextFunction } from 'express';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
  };
}

export type UserRole = 'superadmin' | 'company_admin' | 'supervisor' | 'agent' | 'user';

export interface Permission {
  resource: string;
  action: string;
  conditions?: (req: AuthRequest) => boolean;
}

// Role hierarchy for easier permission checking
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  superadmin: 5,
  company_admin: 4,
  supervisor: 3,
  agent: 2,
  user: 1
};

// Define permissions for each role
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  superadmin: [
    { resource: '*', action: '*' }, // Full access
  ],
  company_admin: [
    { resource: 'users', action: '*', conditions: (req) => req.user?.tenantId === req.params.tenantId || !req.params.tenantId },
    { resource: 'extensions', action: '*', conditions: (req) => req.user?.tenantId === req.params.tenantId || !req.params.tenantId },
    { resource: 'calls', action: '*', conditions: (req) => req.user?.tenantId === req.params.tenantId || !req.params.tenantId },
    { resource: 'queues', action: '*', conditions: (req) => req.user?.tenantId === req.params.tenantId || !req.params.tenantId },
    { resource: 'pbx', action: '*', conditions: (req) => req.user?.tenantId === req.params.tenantId || !req.params.tenantId },
    { resource: 'subscription', action: 'read', conditions: (req) => req.user?.tenantId === req.params.tenantId || !req.params.tenantId },
    { resource: 'subscription', action: 'update', conditions: (req) => req.user?.tenantId === req.params.tenantId || !req.params.tenantId },
    { resource: 'admin', action: 'read' },
    { resource: 'tenant', action: 'read', conditions: (req) => req.user?.tenantId === req.params.id },
    { resource: 'tenant', action: 'update', conditions: (req) => req.user?.tenantId === req.params.id },
  ],
  supervisor: [
    { resource: 'users', action: 'read', conditions: (req) => req.user?.tenantId === req.params.tenantId || !req.params.tenantId },
    { resource: 'users', action: 'create', conditions: (req) => req.user?.tenantId === req.params.tenantId || !req.params.tenantId },
    { resource: 'users', action: 'update', conditions: (req) => req.user?.tenantId === req.params.tenantId || !req.params.tenantId },
    { resource: 'extensions', action: '*', conditions: (req) => req.user?.tenantId === req.params.tenantId || !req.params.tenantId },
    { resource: 'calls', action: '*', conditions: (req) => req.user?.tenantId === req.params.tenantId || !req.params.tenantId },
    { resource: 'queues', action: '*', conditions: (req) => req.user?.tenantId === req.params.tenantId || !req.params.tenantId },
    { resource: 'pbx', action: '*', conditions: (req) => req.user?.tenantId === req.params.tenantId || !req.params.tenantId },
  ],
  agent: [
    { resource: 'users', action: 'read', conditions: (req) => req.user?.id === req.params.id },
    { resource: 'users', action: 'update', conditions: (req) => req.user?.id === req.params.id },
    { resource: 'extensions', action: 'read' },
    { resource: 'calls', action: 'read', conditions: (req) => req.user?.id === req.params.agentId || !req.params.agentId },
    { resource: 'calls', action: 'create' },
    { resource: 'calls', action: 'update', conditions: (req) => req.user?.id === req.params.agentId || !req.params.agentId },
    { resource: 'queues', action: 'read' },
  ],
  user: [
    { resource: 'users', action: 'read', conditions: (req) => req.user?.id === req.params.id },
    { resource: 'users', action: 'update', conditions: (req) => req.user?.id === req.params.id },
    { resource: 'extensions', action: 'read', conditions: (req) => req.user?.id === req.params.userId },
    { resource: 'calls', action: 'read', conditions: (req) => req.user?.id === req.params.userId },
  ]
};

/**
 * Check if a user has a specific permission
 */
export function hasPermission(
  userRole: UserRole,
  resource: string,
  action: string,
  req?: AuthRequest
): boolean {
  const permissions = ROLE_PERMISSIONS[userRole] || [];

  for (const permission of permissions) {
    // Check for wildcard permissions
    if (permission.resource === '*' && permission.action === '*') {
      return true;
    }

    // Check for specific resource with wildcard action
    if (permission.resource === resource && permission.action === '*') {
      if (!permission.conditions || permission.conditions(req!)) {
        return true;
      }
    }

    // Check for exact match
    if (permission.resource === resource && permission.action === action) {
      if (!permission.conditions || permission.conditions(req!)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if user role has higher or equal hierarchy level
 */
export function hasHigherRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * RBAC middleware factory
 */
export function requirePermission(resource: string, action: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userRole = req.user.role as UserRole;

    if (hasPermission(userRole, resource, action, req)) {
      next();
    } else {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: { resource, action }
      });
    }
  };
}

/**
 * Tenant access control middleware
 */
export function requireTenantAccess() {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userRole = req.user.role as UserRole;

    // Superadmin can access any tenant
    if (userRole === 'superadmin') {
      return next();
    }

    // Extract tenant ID from various sources
    const targetTenantId = req.params.tenantId || req.body.tenantId || req.query.tenantId;

    // If no specific tenant is being accessed, allow (user's own tenant will be used)
    if (!targetTenantId) {
      return next();
    }

    // Users can only access their own tenant
    if (req.user.tenantId !== targetTenantId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this tenant'
      });
    }

    next();
  };
}

/**
 * Resource ownership middleware (for user-specific resources)
 */
export function requireResourceOwnership(resourceIdField: string = 'id') {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userRole = req.user.role as UserRole;
    const resourceId = req.params[resourceIdField];

    // Admins and supervisors can access any resource within their tenant
    if (hasHigherRole(userRole, 'supervisor')) {
      return next();
    }

    // Regular users can only access their own resources
    if (req.user.id !== resourceId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this resource'
      });
    }

    next();
  };
}

/**
 * Feature flag middleware
 */
export function requireFeature(featureName: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Superadmin has access to all features
      if (req.user.role === 'superadmin') {
        return next();
      }

      // TODO: Implement feature checking logic based on tenant's subscription
      // For now, allow all features
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error checking feature access'
      });
    }
  };
}