import express from 'express';
import { body, validationResult } from 'express-validator';
import { SubscriptionService } from '../services/subscription';
import { UsageService } from '../services/usage';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply auth middleware to all subscription routes
router.use(authenticateToken);

// Create subscription
router.post('/', [
  body('planType').isIn(['basic', 'professional', 'enterprise']).withMessage('Invalid plan type'),
  body('billingCycle').optional().isIn(['monthly', 'yearly']).withMessage('Invalid billing cycle'),
  body('paymentMethodId').optional().isString().withMessage('Payment method ID must be a string'),
  body('trialDays').optional().isInt({ min: 0, max: 90 }).withMessage('Trial days must be between 0 and 90')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { planType, billingCycle, paymentMethodId, trialDays } = req.body;
    const tenantId = req.user.tenantId;

    const result = await SubscriptionService.createSubscription({
      tenantId,
      planType,
      paymentMethodId,
      trialDays
    }, billingCycle);

    res.status(201).json({
      message: 'Subscription created successfully',
      subscription: result.subscription,
      clientSecret: result.clientSecret
    });
  } catch (error: any) {
    console.error('Error creating subscription:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get subscription for current tenant (TEMPORARILY DISABLED to stop infinite loops)
router.get('/', async (req, res) => {
  try {

    const tenantId = req.user.tenantId;
    const subscription = await SubscriptionService.getSubscriptionByTenant(tenantId);

    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    res.json(subscription);
  } catch (error: any) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update subscription
router.put('/', [
  body('planType').optional().isIn(['basic', 'professional', 'enterprise']).withMessage('Invalid plan type'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { planType, quantity } = req.body;
    const tenantId = req.user.tenantId;

    const subscription = await SubscriptionService.updateSubscription(tenantId, {
      planType,
      quantity
    });

    res.json({
      message: 'Subscription updated successfully',
      subscription
    });
  } catch (error: any) {
    console.error('Error updating subscription:', error);
    res.status(400).json({ error: error.message });
  }
});

// Cancel subscription
router.delete('/', [
  body('immediate').optional().isBoolean().withMessage('Immediate must be a boolean')
], async (req, res) => {
  try {
    const { immediate = false } = req.body;
    const tenantId = req.user.tenantId;

    const subscription = await SubscriptionService.cancelSubscription(tenantId, immediate);

    res.json({
      message: 'Subscription canceled successfully',
      subscription
    });
  } catch (error: any) {
    console.error('Error canceling subscription:', error);
    res.status(400).json({ error: error.message });
  }
});

// Reactivate subscription
router.post('/reactivate', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const subscription = await SubscriptionService.reactivateSubscription(tenantId);

    res.json({
      message: 'Subscription reactivated successfully',
      subscription
    });
  } catch (error: any) {
    console.error('Error reactivating subscription:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get available plans
router.get('/plans', async (req, res) => {
  try {
    const plans = SubscriptionService.getAllPlans();
    res.json(plans);
  } catch (error: any) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get usage for current billing period
router.get('/usage', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { billingPeriod } = req.query;

    const [usage, summary, overages] = await Promise.all([
      UsageService.getUsageForPeriod(tenantId, billingPeriod as string),
      UsageService.getUsageSummary(tenantId, billingPeriod as string),
      UsageService.calculateOverageCharges(tenantId, billingPeriod as string)
    ]);

    res.json({
      usage,
      summary,
      overages
    });
  } catch (error: any) {
    console.error('Error fetching usage:', error);
    res.status(500).json({ error: error.message });
  }
});

// Record manual usage (admin only)
router.post('/usage', [
  body('recordType').isIn(['call_minutes', 'seat_count', 'sms_count']).withMessage('Invalid record type'),
  body('quantity').isFloat({ min: 0 }).withMessage('Quantity must be a positive number'),
  body('description').optional().isString().withMessage('Description must be a string')
], async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { recordType, quantity, description } = req.body;
    const tenantId = req.user.tenantId;

    const usageRecord = await UsageService.recordUsage({
      tenantId,
      recordType,
      quantity,
      description
    });

    res.status(201).json({
      message: 'Usage recorded successfully',
      usageRecord
    });
  } catch (error: any) {
    console.error('Error recording usage:', error);
    res.status(400).json({ error: error.message });
  }
});

// Process pending usage records (admin only)
router.post('/usage/process', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const tenantId = req.user.tenantId;
    await UsageService.processPendingUsage(tenantId);

    res.json({ message: 'Pending usage processed successfully' });
  } catch (error: any) {
    console.error('Error processing usage:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;