import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { PaymentService } from '../services/payment';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply auth middleware to all payment routes
router.use(authenticateToken);

// Get payments for current tenant
router.get('/', [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const tenantId = req.user.tenantId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const payments = await PaymentService.getPaymentsByTenant(tenantId, limit, offset);
    res.json(payments);
  } catch (error: any) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific payment
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const payment = await PaymentService.getPaymentById(id, tenantId);
    res.json(payment);
  } catch (error: any) {
    console.error('Error fetching payment:', error);
    if (error.message === 'Payment not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Process a payment
router.post('/', [
  body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('invoiceId').optional().isUUID().withMessage('Invoice ID must be a valid UUID'),
  body('paymentMethod.type').isIn(['card', 'bank_transfer', 'paypal', 'manual']).withMessage('Invalid payment method type'),
  body('paymentMethod.stripePaymentMethodId').optional().isString().withMessage('Stripe payment method ID must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, currency, description, invoiceId, paymentMethod } = req.body;
    const tenantId = req.user.tenantId;

    const payment = await PaymentService.processPayment({
      amount,
      currency,
      description,
      paymentMethod,
      tenantId,
      invoiceId
    });

    res.status(201).json({
      message: 'Payment processed successfully',
      payment
    });
  } catch (error: any) {
    console.error('Error processing payment:', error);
    res.status(400).json({ error: error.message });
  }
});

// Refund a payment (admin only)
router.post('/:id/refund', [
  body('amount').optional().isInt({ min: 1 }).withMessage('Refund amount must be positive'),
  body('reason').optional().isString().withMessage('Reason must be a string')
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

    const { id } = req.params;
    const { amount, reason } = req.body;

    const refundResult = await PaymentService.refundPayment(id, amount, reason);

    res.json({
      message: 'Refund processed successfully',
      ...refundResult
    });
  } catch (error: any) {
    console.error('Error processing refund:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create setup intent for saving payment methods
router.post('/setup-intent', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const setupIntent = await PaymentService.createStripeSetupIntent(tenantId);

    res.json({
      message: 'Setup intent created successfully',
      ...setupIntent
    });
  } catch (error: any) {
    console.error('Error creating setup intent:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get saved payment methods
router.get('/methods/list', async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const paymentMethods = await PaymentService.getPaymentMethods(tenantId);

    res.json({
      paymentMethods
    });
  } catch (error: any) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a saved payment method
router.delete('/methods/:paymentMethodId', async (req, res) => {
  try {
    const { paymentMethodId } = req.params;

    await PaymentService.deletePaymentMethod(paymentMethodId);

    res.json({
      message: 'Payment method deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting payment method:', error);
    res.status(400).json({ error: error.message });
  }
});

// Sync payment from Stripe (admin only)
router.post('/:id/sync-stripe', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    // Get the payment to find the Stripe payment intent ID
    const payment = await PaymentService.getPaymentById(id, req.user.tenantId);

    if (!payment.stripePaymentIntentId) {
      return res.status(400).json({ error: 'Payment is not linked to Stripe' });
    }

    const updatedPayment = await PaymentService.syncPaymentFromStripe(payment.stripePaymentIntentId);

    res.json({
      message: 'Payment synced from Stripe successfully',
      payment: updatedPayment
    });
  } catch (error: any) {
    console.error('Error syncing payment from Stripe:', error);
    res.status(400).json({ error: error.message });
  }
});

// PayPal-specific routes

// Capture PayPal order
router.post('/paypal/capture/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const tenantId = req.user.tenantId;

    const result = await PaymentService.capturePayPalOrder(orderId, tenantId);

    res.json({
      message: 'PayPal order captured successfully',
      ...result
    });
  } catch (error: any) {
    console.error('Error capturing PayPal order:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create PayPal subscription
router.post('/paypal/subscription', [
  body('planId').isString().withMessage('Plan ID is required'),
  body('payerInfo.email').optional().isEmail().withMessage('Valid email required'),
  body('payerInfo.firstName').optional().isString().withMessage('First name must be a string'),
  body('payerInfo.lastName').optional().isString().withMessage('Last name must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { planId, payerInfo } = req.body;
    const tenantId = req.user.tenantId;

    const result = await PaymentService.createPayPalSubscription(planId, tenantId, payerInfo);

    res.status(201).json({
      message: 'PayPal subscription created successfully',
      ...result
    });
  } catch (error: any) {
    console.error('Error creating PayPal subscription:', error);
    res.status(400).json({ error: error.message });
  }
});

// Cancel PayPal subscription
router.post('/paypal/subscription/:subscriptionId/cancel', [
  body('reason').optional().isString().withMessage('Reason must be a string')
], async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { subscriptionId } = req.params;
    const { reason } = req.body;

    const result = await PaymentService.cancelPayPalSubscription(subscriptionId, reason);

    res.json({
      message: 'PayPal subscription canceled successfully',
      ...result
    });
  } catch (error: any) {
    console.error('Error canceling PayPal subscription:', error);
    res.status(400).json({ error: error.message });
  }
});

// PayPal webhook endpoint
router.post('/paypal/webhook', async (req, res) => {
  try {
    const webhookBody = req.body;
    const headers = req.headers;

    const result = await PaymentService.handlePayPalWebhook(webhookBody, headers);

    res.json(result);
  } catch (error: any) {
    console.error('Error processing PayPal webhook:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;