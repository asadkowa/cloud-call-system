import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { SubscriptionPlanService } from '../services/subscriptionPlan';

const router = express.Router();

// Apply auth middleware to all admin routes
router.use(authenticateToken);

// Admin-only middleware
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'SuperAdmin access required' });
  }
  next();
};

// Get all plans (admin view)
router.get('/plans', requireAdmin, async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const plans = await SubscriptionPlanService.getAllPlans(includeInactive);

    const formattedPlans = plans.map(plan => ({
      ...SubscriptionPlanService.formatPlan(plan),
      activeSubscriptions: plan._count.subscriptions
    }));

    res.json({
      success: true,
      data: formattedPlans
    });
  } catch (error: any) {
    console.error('Error fetching admin plans:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get plan by ID
router.get('/plans/:id', requireAdmin, async (req, res) => {
  try {
    const plan = await SubscriptionPlanService.getPlanById(req.params.id);

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json({
      success: true,
      data: {
        ...SubscriptionPlanService.formatPlan(plan),
        activeSubscriptions: plan._count.subscriptions
      }
    });
  } catch (error: any) {
    console.error('Error fetching plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new plan
router.post('/plans', [
  requireAdmin,
  body('name').notEmpty().withMessage('Name is required'),
  body('monthlyPrice').isInt({ min: 0 }).withMessage('Monthly price must be a positive integer'),
  body('yearlyPrice').isInt({ min: 0 }).withMessage('Yearly price must be a positive integer'),
  body('features').isArray().withMessage('Features must be an array'),
  body('maxExtensions').isInt({ min: 1 }).withMessage('Max extensions must be at least 1'),
  body('maxConcurrentCalls').isInt({ min: 1 }).withMessage('Max concurrent calls must be at least 1'),
  body('maxUsers').isInt({ min: 1 }).withMessage('Max users must be at least 1')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const plan = await SubscriptionPlanService.createPlan(req.body);

    res.status(201).json({
      success: true,
      message: 'Plan created successfully',
      data: SubscriptionPlanService.formatPlan(plan)
    });
  } catch (error: any) {
    console.error('Error creating plan:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update plan
router.put('/plans/:id', [
  requireAdmin,
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('monthlyPrice').optional().isInt({ min: 0 }).withMessage('Monthly price must be a positive integer'),
  body('yearlyPrice').optional().isInt({ min: 0 }).withMessage('Yearly price must be a positive integer'),
  body('features').optional().isArray().withMessage('Features must be an array'),
  body('maxExtensions').optional().isInt({ min: 1 }).withMessage('Max extensions must be at least 1'),
  body('maxConcurrentCalls').optional().isInt({ min: 1 }).withMessage('Max concurrent calls must be at least 1'),
  body('maxUsers').optional().isInt({ min: 1 }).withMessage('Max users must be at least 1')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const plan = await SubscriptionPlanService.updatePlan(req.params.id, req.body);

    res.json({
      success: true,
      message: 'Plan updated successfully',
      data: SubscriptionPlanService.formatPlan(plan)
    });
  } catch (error: any) {
    console.error('Error updating plan:', error);
    res.status(400).json({ error: error.message });
  }
});

// Delete plan
router.delete('/plans/:id', requireAdmin, async (req, res) => {
  try {
    await SubscriptionPlanService.deletePlan(req.params.id);

    res.json({
      success: true,
      message: 'Plan deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting plan:', error);
    res.status(400).json({ error: error.message });
  }
});

// Toggle plan status
router.post('/plans/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;
    const plan = await SubscriptionPlanService.togglePlanStatus(req.params.id, isActive);

    res.json({
      success: true,
      message: `Plan ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: SubscriptionPlanService.formatPlan(plan)
    });
  } catch (error: any) {
    console.error('Error toggling plan status:', error);
    res.status(400).json({ error: error.message });
  }
});

// Assign plan to tenant
router.post('/plans/:id/assign', [
  requireAdmin,
  body('tenantId').notEmpty().withMessage('Tenant ID is required'),
  body('billingCycle').optional().isIn(['monthly', 'yearly']).withMessage('Invalid billing cycle')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tenantId, billingCycle = 'monthly' } = req.body;
    const subscription = await SubscriptionPlanService.assignPlanToTenant(
      tenantId,
      req.params.id,
      billingCycle
    );

    res.json({
      success: true,
      message: 'Plan assigned successfully',
      data: subscription
    });
  } catch (error: any) {
    console.error('Error assigning plan:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get all tenants for plan assignment
router.get('/tenants', requireAdmin, async (req, res) => {
  try {
    const { prisma } = require('../config/database');
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        domain: true,
        planType: true,
        isActive: true,
        subscription: {
          select: {
            id: true,
            status: true,
            plan: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    res.json({
      success: true,
      data: tenants
    });
  } catch (error: any) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ error: error.message });
  }
});

// Seed default plans
router.post('/plans/seed', requireAdmin, async (req, res) => {
  try {
    await SubscriptionPlanService.seedDefaultPlans();

    res.json({
      success: true,
      message: 'Default plans seeded successfully'
    });
  } catch (error: any) {
    console.error('Error seeding plans:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;