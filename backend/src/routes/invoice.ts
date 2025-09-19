import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { InvoiceService } from '../services/invoice';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply auth middleware to all invoice routes
router.use(authenticateToken);

// Get invoices for current tenant
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

    const invoices = await InvoiceService.getInvoicesByTenant(tenantId, limit, offset);
    res.json(invoices);
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific invoice
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const invoice = await InvoiceService.getInvoiceById(id, tenantId);
    res.json(invoice);
  } catch (error: any) {
    console.error('Error fetching invoice:', error);
    if (error.message === 'Invoice not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Create manual invoice (admin only)
router.post('/', [
  body('description').optional().isString().withMessage('Description must be a string'),
  body('dueDate').optional().isISO8601().withMessage('Due date must be a valid ISO date'),
  body('items').isArray({ min: 1 }).withMessage('Items array is required'),
  body('items.*.description').isString().withMessage('Item description is required'),
  body('items.*.quantity').isFloat({ min: 0 }).withMessage('Item quantity must be positive'),
  body('items.*.unitAmount').isInt({ min: 0 }).withMessage('Unit amount must be non-negative')
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

    const { description, dueDate, items } = req.body;
    const tenantId = req.user.tenantId;

    const invoice = await InvoiceService.createInvoice({
      tenantId,
      description,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      items
    });

    res.status(201).json({
      message: 'Invoice created successfully',
      invoice
    });
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    res.status(400).json({ error: error.message });
  }
});

// Generate subscription invoice (admin only)
router.post('/generate', [
  body('billingPeriod').optional().matches(/^\d{4}-\d{2}$/).withMessage('Billing period must be in YYYY-MM format')
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

    const { billingPeriod } = req.body;
    const tenantId = req.user.tenantId;

    const invoice = await InvoiceService.generateInvoiceForSubscription(tenantId, billingPeriod);

    res.status(201).json({
      message: 'Subscription invoice generated successfully',
      invoice
    });
  } catch (error: any) {
    console.error('Error generating invoice:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update invoice status (admin only)
router.patch('/:id/status', [
  body('status').isIn(['draft', 'open', 'paid', 'void', 'uncollectible']).withMessage('Invalid status')
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
    const { status } = req.body;
    const tenantId = req.user.tenantId;

    const invoice = await InvoiceService.updateInvoiceStatus(id, status, tenantId);

    res.json({
      message: 'Invoice status updated successfully',
      invoice
    });
  } catch (error: any) {
    console.error('Error updating invoice status:', error);
    if (error.message === 'Invoice not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
});

// Record payment for invoice
router.post('/:id/payment', [
  body('amount').isInt({ min: 1 }).withMessage('Amount must be positive'),
  body('paymentMethodId').optional().isString().withMessage('Payment method ID must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { amount, paymentMethodId } = req.body;

    const payment = await InvoiceService.recordPayment(id, amount, paymentMethodId);

    res.status(201).json({
      message: 'Payment recorded successfully',
      payment
    });
  } catch (error: any) {
    console.error('Error recording payment:', error);
    res.status(400).json({ error: error.message });
  }
});

// Generate monthly invoices for all tenants (system admin only)
router.post('/generate-monthly', async (req, res) => {
  try {
    // This would typically be restricted to system administrators
    // For now, we'll allow admin users to trigger it for their tenant
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const results = await InvoiceService.generateMonthlyInvoices();

    res.json({
      message: 'Monthly invoice generation completed',
      results
    });
  } catch (error: any) {
    console.error('Error generating monthly invoices:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync invoice from Stripe (admin only)
router.post('/:id/sync-stripe', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    // Get the invoice to find the Stripe invoice ID
    const invoice = await InvoiceService.getInvoiceById(id, req.user.tenantId);

    if (!invoice.stripeInvoiceId) {
      return res.status(400).json({ error: 'Invoice is not linked to Stripe' });
    }

    const updatedInvoice = await InvoiceService.syncInvoiceFromStripe(invoice.stripeInvoiceId);

    res.json({
      message: 'Invoice synced from Stripe successfully',
      invoice: updatedInvoice
    });
  } catch (error: any) {
    console.error('Error syncing invoice from Stripe:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;