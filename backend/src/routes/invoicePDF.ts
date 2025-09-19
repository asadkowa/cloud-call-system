import express from 'express';
import { query, param, validationResult } from 'express-validator';
import { InvoicePDFService, InvoicePDFOptions } from '../services/invoicePDF';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = express.Router();

// Apply auth middleware to all PDF routes
router.use(authenticateToken);

// Generate PDF for a specific invoice
router.get('/invoice/:id', [
  param('id').isUUID().withMessage('Invoice ID must be a valid UUID'),
  query('theme').optional().isIn(['default', 'minimal', 'corporate']).withMessage('Invalid theme'),
  query('includePaymentDetails').optional().isBoolean().withMessage('includePaymentDetails must be boolean'),
  query('includeTenantLogo').optional().isBoolean().withMessage('includeTenantLogo must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const invoiceId = req.params.id;

    // Check if user has access to this invoice
    const { prisma } = require('../config/database');
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { tenantId: true, invoiceNumber: true }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Check tenant access (admin can access all invoices)
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    if (!isAdmin && invoice.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: 'Access denied: Cannot access other tenant invoices' });
    }

    const options: InvoicePDFOptions = {
      theme: (req.query.theme as any) || 'default',
      includePaymentDetails: req.query.includePaymentDetails === 'true',
      includeTenantLogo: req.query.includeTenantLogo === 'true'
    };

    const htmlContent = await InvoicePDFService.generateInvoiceHTML(invoiceId, options);

    // Set HTML headers for now (can be converted to PDF client-side)
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename=invoice-${invoice.invoiceNumber}.html`);

    res.send(htmlContent);
  } catch (error: any) {
    console.error('Error generating invoice PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download PDF for a specific invoice
router.get('/invoice/:id/download', [
  param('id').isUUID().withMessage('Invoice ID must be a valid UUID'),
  query('theme').optional().isIn(['default', 'minimal', 'corporate']).withMessage('Invalid theme')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const invoiceId = req.params.id;

    // Check access
    const { prisma } = require('../config/database');
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { tenantId: true, invoiceNumber: true }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    if (!isAdmin && invoice.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const options: InvoicePDFOptions = {
      theme: (req.query.theme as any) || 'default',
      includePaymentDetails: true,
      includeTenantLogo: true
    };

    const htmlContent = await InvoicePDFService.generateInvoiceHTML(invoiceId, options);

    // Set download headers for HTML
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.html`);

    res.send(htmlContent);
  } catch (error: any) {
    console.error('Error downloading invoice PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate bulk PDFs for multiple invoices (admin only)
router.post('/bulk', requireRole(['admin', 'super_admin']), [
  query('theme').optional().isIn(['default', 'minimal', 'corporate']).withMessage('Invalid theme'),
  query('includePaymentDetails').optional().isBoolean().withMessage('includePaymentDetails must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { invoiceIds } = req.body;

    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return res.status(400).json({ error: 'invoiceIds must be a non-empty array' });
    }

    // Validate all IDs are UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const invalidIds = invoiceIds.filter(id => !uuidRegex.test(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ error: `Invalid invoice IDs: ${invalidIds.join(', ')}` });
    }

    const options: InvoicePDFOptions = {
      theme: (req.query.theme as any) || 'default',
      includePaymentDetails: req.query.includePaymentDetails === 'true',
      includeTenantLogo: true
    };

    const results = await InvoicePDFService.generateBulkInvoiceHTML(invoiceIds, options);

    res.json({
      success: true,
      results: results,
      generated: Object.keys(results).length,
      requested: invoiceIds.length
    });
  } catch (error: any) {
    console.error('Error generating bulk invoice PDFs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get PDF generation status and options
router.get('/options', (req, res) => {
  res.json({
    success: true,
    themes: ['default', 'minimal', 'corporate'],
    features: {
      paymentDetails: true,
      tenantLogo: true,
      customTemplates: true,
      bulkGeneration: true
    },
    formats: ['PDF'],
    maxBulkSize: 100
  });
});

// Generate PDF with custom styling (admin only)
router.post('/invoice/:id/custom', requireRole(['admin', 'super_admin']), [
  param('id').isUUID().withMessage('Invoice ID must be a valid UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const invoiceId = req.params.id;
    const { customStyles } = req.body;

    // For now, we'll use the default template with custom options
    // In a full implementation, you'd parse customStyles and apply them
    const options: InvoicePDFOptions = {
      theme: 'corporate',
      includePaymentDetails: true,
      includeTenantLogo: true,
      ...customStyles
    };

    const htmlContent = await InvoicePDFService.generateInvoiceHTML(invoiceId, options);

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename=custom-invoice-${invoiceId.slice(0, 8)}.html`);

    res.send(htmlContent);
  } catch (error: any) {
    console.error('Error generating custom invoice PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate statement PDF for a tenant (includes multiple invoices)
router.get('/statement/:tenantId', [
  param('tenantId').isUUID().withMessage('Tenant ID must be a valid UUID'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO date'),
  query('theme').optional().isIn(['default', 'minimal', 'corporate']).withMessage('Invalid theme')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const tenantId = req.params.tenantId;

    // Check tenant access
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    if (!isAdmin && tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: 'Access denied: Cannot access other tenant statements' });
    }

    // Get invoices for the tenant in the date range
    const { prisma } = require('../config/database');
    const where: any = { tenantId };

    if (req.query.startDate || req.query.endDate) {
      where.createdAt = {};
      if (req.query.startDate) {
        where.createdAt.gte = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        where.createdAt.lte = new Date(req.query.endDate as string);
      }
    }

    const invoices = await prisma.invoice.findMany({
      where,
      select: { id: true, invoiceNumber: true },
      orderBy: { createdAt: 'desc' }
    });

    if (invoices.length === 0) {
      return res.status(404).json({ error: 'No invoices found for the specified period' });
    }

    // For now, generate PDF for the most recent invoice
    // In a full implementation, you'd create a combined statement
    const latestInvoice = invoices[0];
    const options: InvoicePDFOptions = {
      theme: (req.query.theme as any) || 'default',
      includePaymentDetails: true,
      includeTenantLogo: true
    };

    const htmlContent = await InvoicePDFService.generateInvoiceHTML(latestInvoice.id, options);

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename=statement-${tenantId.slice(0, 8)}.html`);

    res.send(htmlContent);
  } catch (error: any) {
    console.error('Error generating statement PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;