import express from 'express';
import { query, validationResult } from 'express-validator';
import { PaymentReportingService, PaymentReportFilters } from '../services/paymentReporting';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = express.Router();

// Apply auth middleware to all reporting routes
router.use(authenticateToken);

// Get payment report with filters
router.get('/payments', [
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date'),
  query('status').optional().isString().withMessage('Status must be a string'),
  query('paymentMethod').optional().isString().withMessage('Payment method must be a string'),
  query('minAmount').optional().isFloat({ min: 0 }).withMessage('Min amount must be a positive number'),
  query('maxAmount').optional().isFloat({ min: 0 }).withMessage('Max amount must be a positive number'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be between 1 and 500'),
  query('tenantId').optional().isUUID().withMessage('Tenant ID must be a valid UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check admin access for cross-tenant reports
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    const requestedTenantId = req.query.tenantId as string;

    if (requestedTenantId && requestedTenantId !== req.user.tenantId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied: Cannot view other tenant reports' });
    }

    const filters: PaymentReportFilters = {
      tenantId: isAdmin ? requestedTenantId : req.user.tenantId,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      status: req.query.status ? (req.query.status as string).split(',') : undefined,
      paymentMethod: req.query.paymentMethod ? (req.query.paymentMethod as string).split(',') : undefined,
      minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
      maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined
    };

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const report = await PaymentReportingService.generatePaymentReport(filters, page, limit);

    res.json({
      success: true,
      data: report
    });
  } catch (error: any) {
    console.error('Error generating payment report:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get payment summary only
router.get('/payments/summary', [
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date'),
  query('status').optional().isString().withMessage('Status must be a string'),
  query('paymentMethod').optional().isString().withMessage('Payment method must be a string'),
  query('minAmount').optional().isFloat({ min: 0 }).withMessage('Min amount must be a positive number'),
  query('maxAmount').optional().isFloat({ min: 0 }).withMessage('Max amount must be a positive number'),
  query('tenantId').optional().isUUID().withMessage('Tenant ID must be a valid UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check admin access for cross-tenant reports
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    const requestedTenantId = req.query.tenantId as string;

    if (requestedTenantId && requestedTenantId !== req.user.tenantId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied: Cannot view other tenant reports' });
    }

    const filters: PaymentReportFilters = {
      tenantId: isAdmin ? requestedTenantId : req.user.tenantId,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      status: req.query.status ? (req.query.status as string).split(',') : undefined,
      paymentMethod: req.query.paymentMethod ? (req.query.paymentMethod as string).split(',') : undefined,
      minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
      maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined
    };

    const summary = await PaymentReportingService.generatePaymentSummary(filters);

    res.json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    console.error('Error generating payment summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get revenue analytics (admin only)
router.get('/revenue', requireRole(['admin', 'super_admin']), [
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date'),
  query('tenantId').optional().isUUID().withMessage('Tenant ID must be a valid UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const filters: PaymentReportFilters = {
      tenantId: req.query.tenantId as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
    };

    const analytics = await PaymentReportingService.generateRevenueAnalytics(filters);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error: any) {
    console.error('Error generating revenue analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export payments to CSV
router.get('/payments/export', [
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date'),
  query('status').optional().isString().withMessage('Status must be a string'),
  query('paymentMethod').optional().isString().withMessage('Payment method must be a string'),
  query('minAmount').optional().isFloat({ min: 0 }).withMessage('Min amount must be a positive number'),
  query('maxAmount').optional().isFloat({ min: 0 }).withMessage('Max amount must be a positive number'),
  query('tenantId').optional().isUUID().withMessage('Tenant ID must be a valid UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check admin access for cross-tenant exports
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    const requestedTenantId = req.query.tenantId as string;

    if (requestedTenantId && requestedTenantId !== req.user.tenantId && !isAdmin) {
      return res.status(403).json({ error: 'Access denied: Cannot export other tenant data' });
    }

    const filters: PaymentReportFilters = {
      tenantId: isAdmin ? requestedTenantId : req.user.tenantId,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      status: req.query.status ? (req.query.status as string).split(',') : undefined,
      paymentMethod: req.query.paymentMethod ? (req.query.paymentMethod as string).split(',') : undefined,
      minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
      maxAmount: req.query.maxAmount ? parseFloat(req.query.maxAmount as string) : undefined
    };

    const csvData = await PaymentReportingService.exportPaymentsToCSV(filters);

    // Set CSV headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=payments-export-${new Date().toISOString().split('T')[0]}.csv`);

    res.send(csvData);
  } catch (error: any) {
    console.error('Error exporting payment data:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;