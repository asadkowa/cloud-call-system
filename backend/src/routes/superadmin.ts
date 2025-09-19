import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateToken, requireRole } from '../middleware/auth';
import { TenantService } from '../services/tenant';
import { UserService } from '../services/user';
import { SubscriptionPlanService } from '../services/subscriptionPlan';
import { SubscriptionService } from '../services/subscription';

const router = express.Router();


// Apply auth middleware and superadmin role to all routes below
router.use(authenticateToken);
router.use(requireRole(['superadmin']));

// TENANT MANAGEMENT

// Get all tenants across the platform
router.get('/tenants', [
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt(),
  query('status').optional().isIn(['active', 'inactive', 'all'])
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: errors.array()
      });
    }

    const limit = req.query.limit || 50;
    const offset = req.query.offset || 0;
    const status = req.query.status || 'all';

    const tenants = await TenantService.getAllTenants({
      limit,
      offset,
      includeInactive: status === 'inactive' || status === 'all'
    });

    res.json({
      success: true,
      data: tenants,
      pagination: { limit, offset }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create new tenant
router.post('/tenants', [
  body('name').trim().isLength({ min: 1 }),
  body('domain').isLength({ min: 1 }),
  body('planType').isIn(['basic', 'professional', 'enterprise']),
  body('maxExtensions').optional().isInt({ min: 1 }),
  body('maxConcurrentCalls').optional().isInt({ min: 1 }),
  body('features').optional().isArray()
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        details: errors.array()
      });
    }

    const tenant = await TenantService.createTenant(req.body);
    res.status(201).json({
      success: true,
      data: tenant
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update any tenant
router.put('/tenants/:id', [
  body('name').optional().trim().isLength({ min: 1 }),
  body('planType').optional().isIn(['basic', 'professional', 'enterprise']),
  body('maxExtensions').optional().isInt({ min: 1 }),
  body('maxConcurrentCalls').optional().isInt({ min: 1 }),
  body('isActive').optional().isBoolean()
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        details: errors.array()
      });
    }

    const tenant = await TenantService.updateTenant(req.params.id, req.body);
    res.json({
      success: true,
      data: tenant
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Delete tenant (hard delete)
router.delete('/tenants/:id', async (req: any, res) => {
  try {
    await TenantService.deleteTenant(req.params.id);
    res.json({
      success: true,
      message: 'Tenant deleted successfully'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// PLATFORM STATISTICS

// Get platform overview statistics
router.get('/stats/platform', async (req: any, res) => {
  try {
    console.log('Platform stats endpoint called by user:', req.user?.email);
    const stats = await TenantService.getPlatformStats();
    console.log('Platform stats retrieved:', JSON.stringify(stats, null, 2));
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Error in platform stats endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


// USER MANAGEMENT ACROSS TENANTS

// Get users across all tenants
router.get('/users', [
  query('tenantId').optional().isUUID(),
  query('role').optional().isIn(['superadmin', 'company_admin', 'supervisor', 'agent', 'user']),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt()
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: errors.array()
      });
    }

    const { tenantId, role, limit = 50, offset = 0 } = req.query;
    const users = await UserService.getAllUsersAcrossTenants({
      tenantId,
      role,
      limit,
      offset
    });

    res.json({
      success: true,
      data: users,
      pagination: { limit, offset }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create superadmin user
router.post('/users/superadmin', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('firstName').trim().isLength({ min: 1 }),
  body('lastName').trim().isLength({ min: 1 })
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        details: errors.array()
      });
    }

    const userData = {
      ...req.body,
      role: 'superadmin' as const
    };

    const user = await UserService.createSuperAdminUser(userData);
    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// SUBSCRIPTION PLAN MANAGEMENT

// Get all subscription plans
router.get('/subscription-plans', async (req: any, res) => {
  try {
    const plans = await SubscriptionPlanService.getAllPlans(true); // Include inactive
    res.json({
      success: true,
      data: plans
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create subscription plan
router.post('/subscription-plans', [
  body('name').trim().isLength({ min: 1 }),
  body('description').optional().trim(),
  body('monthlyPrice').isInt({ min: 0 }),
  body('yearlyPrice').isInt({ min: 0 }),
  body('maxExtensions').isInt({ min: 1 }),
  body('maxConcurrentCalls').isInt({ min: 1 }),
  body('maxUsers').isInt({ min: 1 }),
  body('features').isArray()
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        details: errors.array()
      });
    }

    const plan = await SubscriptionPlanService.createPlan(req.body);
    res.status(201).json({
      success: true,
      data: plan
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update subscription plan
router.put('/subscription-plans/:id', [
  body('name').optional().trim().isLength({ min: 1 }),
  body('description').optional().trim(),
  body('monthlyPrice').optional().isInt({ min: 0 }),
  body('yearlyPrice').optional().isInt({ min: 0 }),
  body('maxExtensions').optional().isInt({ min: 1 }),
  body('maxConcurrentCalls').optional().isInt({ min: 1 }),
  body('maxUsers').optional().isInt({ min: 1 }),
  body('features').optional().isArray(),
  body('isActive').optional().isBoolean()
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        details: errors.array()
      });
    }

    const plan = await SubscriptionPlanService.updatePlan(req.params.id, req.body);
    res.json({
      success: true,
      data: plan
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ADMIN CONFIGURATION MANAGEMENT

// Get admin configuration
router.get('/config', async (req: any, res) => {
  try {
    console.log('Admin config endpoint called by user:', req.user?.email);

    // For now, return default configuration - in production this would be stored in database
    const defaultConfig = {
      systemMaintenance: {
        enabled: false,
        message: 'System is under maintenance. Please check back later.',
        allowedRoles: ['superadmin']
      },
      security: {
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: false
        },
        sessionTimeout: 3600,
        maxLoginAttempts: 5,
        lockoutDuration: 900
      },
      notifications: {
        emailEnabled: true,
        smsEnabled: false,
        webhookEnabled: true,
        defaultEmailTemplates: ['welcome', 'password_reset', 'billing_reminder']
      },
      apiLimits: {
        rateLimit: 1000,
        burstLimit: 100,
        maxPayloadSize: 10485760
      },
      paymentMethods: {
        paypal: {
          enabled: false,
          clientId: process.env.PAYPAL_CLIENT_ID || '',
          clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
          sandboxMode: process.env.NODE_ENV !== 'production',
          webhookId: process.env.PAYPAL_WEBHOOK_ID || ''
        },
        stripe: {
          enabled: false,
          publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
          secretKey: process.env.STRIPE_SECRET_KEY || '',
          webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || ''
        }
      }
    };

    console.log('Admin config retrieved successfully');
    res.json({
      success: true,
      data: defaultConfig
    });
  } catch (error: any) {
    console.error('Error in admin config endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update admin configuration
router.put('/config', [
  body('systemMaintenance').optional().isObject(),
  body('security').optional().isObject(),
  body('notifications').optional().isObject(),
  body('apiLimits').optional().isObject(),
  body('paymentMethods').optional().isObject()
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid configuration data',
        details: errors.array()
      });
    }

    console.log('Updating admin config by user:', req.user?.email);
    console.log('Config update data:', JSON.stringify(req.body, null, 2));

    // In production, this would update the database
    // For now, we'll just return success

    res.json({
      success: true,
      message: 'Configuration updated successfully',
      data: req.body
    });
  } catch (error: any) {
    console.error('Error updating admin config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;