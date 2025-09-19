import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { BillingCycleService } from '../services/billingCycle';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = express.Router();

// Apply auth middleware to all billing cycle routes
router.use(authenticateToken);

// Get billing cycle status (admin only)
router.get('/status', requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const status = BillingCycleService.getBillingStatus();
    res.json(status);
  } catch (error: any) {
    console.error('Error fetching billing cycle status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Trigger manual billing cycle (admin only)
router.post('/trigger', [
  requireRole(['admin', 'super_admin']),
  body('tenantId').optional().isUUID().withMessage('Tenant ID must be a valid UUID'),
  body('dryRun').optional().isBoolean().withMessage('Dry run must be a boolean'),
  body('processOverages').optional().isBoolean().withMessage('Process overages must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tenantId, dryRun = true, processOverages = true } = req.body;

    const summary = await BillingCycleService.processBillingCycle({
      tenantId,
      dryRun,
      processOverages
    });

    res.json({
      message: dryRun ? 'Billing cycle simulation completed' : 'Billing cycle processing completed',
      summary
    });
  } catch (error: any) {
    console.error('Error triggering billing cycle:', error);
    res.status(500).json({ error: error.message });
  }
});

// Trigger billing for specific tenant (admin only)
router.post('/tenant/:tenantId', [
  requireRole(['admin', 'super_admin']),
  body('dryRun').optional().isBoolean().withMessage('Dry run must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tenantId } = req.params;
    const { dryRun = false } = req.body;

    const summary = await BillingCycleService.triggerManualBilling(tenantId, dryRun);

    res.json({
      message: dryRun ? 'Tenant billing simulation completed' : 'Tenant billing processing completed',
      summary
    });
  } catch (error: any) {
    console.error('Error processing tenant billing:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process overages only (admin only)
router.post('/overages', [
  requireRole(['admin', 'super_admin']),
  body('tenantId').optional().isUUID().withMessage('Tenant ID must be a valid UUID'),
  body('dryRun').optional().isBoolean().withMessage('Dry run must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tenantId, dryRun = true } = req.body;

    const summary = await BillingCycleService.processBillingCycle({
      tenantId,
      dryRun,
      processOverages: true
    });

    res.json({
      message: dryRun ? 'Overage processing simulation completed' : 'Overage processing completed',
      summary
    });
  } catch (error: any) {
    console.error('Error processing overages:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;