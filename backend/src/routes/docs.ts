import express from 'express';

const router = express.Router();

// API Documentation endpoint
router.get('/', (req, res) => {
  const apiDocs = {
    title: 'Cloud Call System API',
    version: '1.0.0',
    description: 'Multi-tenant cloud-based call center system API',
    baseUrl: `${req.protocol}://${req.get('Host')}/api`,
    authentication: {
      type: 'Bearer Token',
      description: 'Include JWT token in Authorization header: Bearer <token>'
    },
    roles: {
      superadmin: {
        description: 'Full platform access across all tenants',
        permissions: ['*']
      },
      company_admin: {
        description: 'Complete control over company resources',
        permissions: ['users:*', 'extensions:*', 'calls:*', 'queues:*', 'pbx:*', 'subscription:read,update']
      },
      supervisor: {
        description: 'Manages team members and operations',
        permissions: ['users:read,create,update', 'extensions:*', 'calls:*', 'queues:*']
      },
      agent: {
        description: 'Handles customer calls and interactions',
        permissions: ['calls:read,create,update', 'extensions:read', 'queues:read']
      },
      user: {
        description: 'Basic access to personal features',
        permissions: ['users:read,update (own)', 'calls:read (own)']
      }
    },
    endpoints: {
      '/auth': {
        description: 'Authentication and authorization',
        methods: {
          'POST /login': {
            description: 'Authenticate user and get JWT token',
            body: { email: 'string', password: 'string' },
            response: { token: 'string', user: 'object' }
          },
          'POST /register': {
            description: 'Register new user account',
            body: { email: 'string', password: 'string', firstName: 'string', lastName: 'string', tenantId: 'string' },
            response: { user: 'object' }
          },
          'POST /logout': {
            description: 'Logout current user',
            auth: 'required'
          }
        }
      },
      '/users': {
        description: 'User management',
        auth: 'required',
        methods: {
          'GET /': {
            description: 'Get all users in tenant',
            roles: ['company_admin', 'supervisor', 'agent']
          },
          'GET /:id': {
            description: 'Get user by ID',
            roles: ['company_admin', 'supervisor', 'agent', 'user (own)']
          },
          'POST /': {
            description: 'Create new user',
            roles: ['superadmin', 'company_admin', 'supervisor'],
            body: { email: 'string', password: 'string', firstName: 'string', lastName: 'string', role: 'string' }
          },
          'PUT /:id': {
            description: 'Update user',
            roles: ['superadmin', 'company_admin', 'supervisor', 'user (own)']
          },
          'DELETE /:id': {
            description: 'Delete user',
            roles: ['superadmin', 'company_admin']
          },
          'GET /stats/overview': {
            description: 'Get user statistics',
            roles: ['superadmin', 'company_admin', 'supervisor']
          }
        }
      },
      '/extensions': {
        description: 'Extension management',
        auth: 'required',
        methods: {
          'GET /': {
            description: 'Get all extensions in tenant'
          },
          'GET /:id': {
            description: 'Get extension by ID'
          },
          'POST /': {
            description: 'Create new extension',
            roles: ['superadmin', 'company_admin', 'supervisor']
          },
          'PUT /:id': {
            description: 'Update extension',
            roles: ['superadmin', 'company_admin', 'supervisor']
          },
          'DELETE /:id': {
            description: 'Delete extension',
            roles: ['superadmin', 'company_admin']
          },
          'POST /:id/assign': {
            description: 'Assign extension to user',
            roles: ['superadmin', 'company_admin', 'supervisor']
          },
          'POST /:id/unassign': {
            description: 'Unassign extension from user',
            roles: ['superadmin', 'company_admin', 'supervisor']
          }
        }
      },
      '/calls': {
        description: 'Call management and tracking',
        auth: 'required',
        methods: {
          'GET /': {
            description: 'Get all calls in tenant with pagination',
            query: { limit: 'number', offset: 'number' }
          },
          'GET /active': {
            description: 'Get currently active calls'
          },
          'GET /:id': {
            description: 'Get call by ID'
          },
          'POST /': {
            description: 'Create new call',
            roles: ['agent', 'supervisor', 'company_admin', 'superadmin'],
            body: { fromNumber: 'string', toNumber: 'string', direction: 'inbound|outbound' }
          },
          'PUT /:id': {
            description: 'Update call status',
            roles: ['agent', 'supervisor', 'company_admin', 'superadmin']
          },
          'POST /:id/transfer': {
            description: 'Transfer call to another extension',
            roles: ['agent', 'supervisor', 'company_admin', 'superadmin']
          },
          'GET /agent/:agentId': {
            description: 'Get calls by agent',
            restrictions: 'Agents can only view own calls'
          },
          'GET /stats/overview': {
            description: 'Get call statistics',
            roles: ['supervisor', 'company_admin', 'superadmin']
          }
        }
      },
      '/queues': {
        description: 'Queue management',
        auth: 'required',
        methods: {
          'GET /': {
            description: 'Get all queues in tenant'
          },
          'GET /:id': {
            description: 'Get queue by ID'
          },
          'POST /': {
            description: 'Create new queue',
            roles: ['superadmin', 'company_admin', 'supervisor']
          },
          'PUT /:id': {
            description: 'Update queue',
            roles: ['superadmin', 'company_admin', 'supervisor']
          },
          'DELETE /:id': {
            description: 'Delete queue',
            roles: ['superadmin', 'company_admin']
          }
        }
      },
      '/pbx': {
        description: 'PBX system management',
        auth: 'required',
        methods: {
          'GET /status': {
            description: 'Get PBX system status'
          },
          'GET /extensions': {
            description: 'Get registered SIP extensions'
          },
          'GET /calls': {
            description: 'Get active PBX calls'
          },
          'POST /extensions': {
            description: 'Create PBX extension',
            roles: ['superadmin', 'company_admin', 'supervisor']
          }
        }
      },
      '/tenants': {
        description: 'Tenant management',
        auth: 'required',
        methods: {
          'GET /': {
            description: 'Get all tenants',
            roles: ['superadmin']
          },
          'GET /current': {
            description: 'Get current tenant info'
          },
          'GET /:id': {
            description: 'Get tenant by ID',
            restrictions: 'Users can only access own tenant unless superadmin'
          },
          'POST /': {
            description: 'Create new tenant',
            roles: ['superadmin']
          },
          'PUT /:id': {
            description: 'Update tenant',
            restrictions: 'Users can only update own tenant unless superadmin'
          },
          'DELETE /:id': {
            description: 'Delete tenant',
            roles: ['superadmin']
          }
        }
      },
      '/subscription': {
        description: 'Subscription management',
        auth: 'required',
        methods: {
          'GET /': {
            description: 'Get current subscription'
          },
          'POST /': {
            description: 'Create subscription'
          },
          'PUT /': {
            description: 'Update subscription'
          },
          'DELETE /': {
            description: 'Cancel subscription'
          },
          'POST /reactivate': {
            description: 'Reactivate subscription'
          },
          'GET /usage': {
            description: 'Get usage statistics'
          }
        }
      },
      '/admin': {
        description: 'Admin-specific operations',
        auth: 'required',
        roles: ['superadmin', 'company_admin'],
        methods: {
          'GET /plans': {
            description: 'Get all subscription plans'
          },
          'GET /plans/:id': {
            description: 'Get subscription plan by ID'
          },
          'POST /plans': {
            description: 'Create subscription plan'
          },
          'PUT /plans/:id': {
            description: 'Update subscription plan'
          },
          'DELETE /plans/:id': {
            description: 'Delete subscription plan'
          }
        }
      },
      '/superadmin': {
        description: 'Platform administration (Superadmin only)',
        auth: 'required',
        roles: ['superadmin'],
        methods: {
          'GET /tenants': {
            description: 'Get all tenants across platform'
          },
          'POST /tenants': {
            description: 'Create new tenant'
          },
          'PUT /tenants/:id': {
            description: 'Update any tenant'
          },
          'DELETE /tenants/:id': {
            description: 'Delete tenant (hard delete)'
          },
          'GET /stats/platform': {
            description: 'Get platform-wide statistics'
          },
          'GET /users': {
            description: 'Get users across all tenants'
          },
          'POST /users/superadmin': {
            description: 'Create superadmin user'
          },
          'GET /subscription-plans': {
            description: 'Get all subscription plans'
          },
          'POST /subscription-plans': {
            description: 'Create subscription plan'
          },
          'PUT /subscription-plans/:id': {
            description: 'Update subscription plan'
          }
        }
      }
    },
    errorCodes: {
      400: 'Bad Request - Invalid input data',
      401: 'Unauthorized - Authentication required',
      403: 'Forbidden - Insufficient permissions',
      404: 'Not Found - Resource not found',
      409: 'Conflict - Resource already exists',
      422: 'Unprocessable Entity - Validation failed',
      500: 'Internal Server Error - Server error'
    },
    examples: {
      authentication: {
        request: {
          method: 'POST',
          url: '/api/auth/login',
          body: {
            email: 'admin@example.com',
            password: 'password123'
          }
        },
        response: {
          success: true,
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          user: {
            id: 'user-id',
            email: 'admin@example.com',
            role: 'company_admin',
            tenantId: 'tenant-id'
          }
        }
      },
      createUser: {
        request: {
          method: 'POST',
          url: '/api/users',
          headers: {
            'Authorization': 'Bearer <token>',
            'Content-Type': 'application/json'
          },
          body: {
            email: 'newuser@example.com',
            password: 'securepass123',
            firstName: 'John',
            lastName: 'Doe',
            role: 'agent'
          }
        },
        response: {
          success: true,
          data: {
            id: 'new-user-id',
            email: 'newuser@example.com',
            firstName: 'John',
            lastName: 'Doe',
            role: 'agent',
            tenantId: 'tenant-id'
          }
        }
      }
    }
  };

  res.json(apiDocs);
});

export default router;