import express from 'express';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply auth middleware to all subscription routes
router.use(authenticateToken);

// Get available plans
router.get('/plans', async (req, res) => {
  try {
    const { prisma } = await import('../config/database');

    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        monthlyPrice: true,
        yearlyPrice: true,
        features: true,
        maxExtensions: true,
        maxConcurrentCalls: true,
        maxUsers: true,
        isCustom: true
      },
      orderBy: { monthlyPrice: 'asc' }
    });

    // Parse features from JSON string and format for client
    const formattedPlans = plans.map(plan => ({
      ...plan,
      features: JSON.parse(plan.features)
    }));

    res.json({
      success: true,
      data: formattedPlans
    });
  } catch (error: any) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get subscription for current tenant
router.get('/', async (req: any, res) => {
  try {
    const { prisma } = await import('../config/database');

    const subscription = await prisma.subscription.findUnique({
      where: { tenantId: req.user.tenantId },
      include: {
        plan: true,
        tenant: true
      }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'No subscription found'
      });
    }

    // Parse plan features if plan exists
    const formattedSubscription = {
      ...subscription,
      plan: subscription.plan ? {
        ...subscription.plan,
        features: JSON.parse(subscription.plan.features)
      } : null
    };

    res.json({
      success: true,
      data: formattedSubscription
    });
  } catch (error: any) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create subscription
router.post('/', async (req, res) => {
  try {
    const { planType, billingCycle, paymentMethodId, trialDays } = req.body;

    // For now, return a mock success response
    res.status(201).json({
      message: 'Subscription created successfully (demo mode)',
      subscription: {
        id: 'demo-sub-id',
        planType,
        status: 'trialing',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        quantity: 1
      }
    });
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update subscription
router.put('/', async (req, res) => {
  try {
    const { planType, quantity } = req.body;

    res.json({
      message: 'Subscription updated successfully (demo mode)',
      subscription: {
        id: 'demo-sub-id',
        planType: planType || 'basic',
        status: 'active',
        quantity: quantity || 1
      }
    });
  } catch (error: any) {
    console.error('Error updating subscription:', error);
    res.status(400).json({ error: error.message });
  }
});

// Cancel subscription
router.delete('/', async (req, res) => {
  try {
    const { immediate = false } = req.body;

    res.json({
      message: immediate ? 'Subscription canceled immediately (demo mode)' : 'Subscription will be canceled at period end (demo mode)',
      subscription: {
        id: 'demo-sub-id',
        status: immediate ? 'canceled' : 'active',
        cancelAt: immediate ? new Date().toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    res.status(400).json({ error: error.message });
  }
});

// Reactivate subscription
router.post('/reactivate', async (req, res) => {
  try {
    res.json({
      message: 'Subscription reactivated successfully (demo mode)',
      subscription: {
        id: 'demo-sub-id',
        status: 'active',
        cancelAt: null,
        canceledAt: null
      }
    });
  } catch (error: any) {
    console.error('Error reactivating subscription:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get usage for current billing period
router.get('/usage', async (req, res) => {
  try {
    res.json({
      usage: [],
      summary: {
        call_minutes: 150,
        seat_count: 5,
        sms_count: 25
      },
      overages: {
        calls: 0,
        seats: 0,
        totalOverageAmount: 0
      }
    });
  } catch (error: any) {
    console.error('Error fetching usage:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;