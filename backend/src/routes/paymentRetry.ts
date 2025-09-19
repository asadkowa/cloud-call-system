import express from 'express';
import { param, body, query, validationResult } from 'express-validator';
import { PaymentRetryService } from '../services/paymentRetry';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = express.Router();

// Apply auth middleware to all retry routes
router.use(authenticateToken);

// Process pending payment retries (admin only)
router.post('/process', requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    console.log('🔄 Manual payment retry processing triggered...');
    const results = await PaymentRetryService.processRetries();

    res.json({
      success: true,
      message: 'Payment retry processing completed',
      data: results
    });
  } catch (error: any) {
    console.error('Error processing payment retries:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get retry status for a specific payment
router.get('/payment/:paymentId', [
  param('paymentId').isUUID().withMessage('Payment ID must be a valid UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const paymentId = req.params.paymentId;

    // Check access (admin can access all, others only their tenant's payments)
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    if (!isAdmin) {
      const { prisma } = require('../config/database');
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        select: { tenantId: true }
      });

      if (!payment || payment.tenantId !== req.user.tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const retryStatus = await PaymentRetryService.getPaymentRetryStatus(paymentId);

    res.json({
      success: true,
      data: retryStatus
    });
  } catch (error: any) {
    console.error('Error getting payment retry status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Trigger manual retry for a payment (admin only)
router.post('/payment/:paymentId/retry', requireRole(['admin', 'super_admin']), [
  param('paymentId').isUUID().withMessage('Payment ID must be a valid UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const paymentId = req.params.paymentId;
    const result = await PaymentRetryService.triggerManualRetry(paymentId);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message
      });
    }
  } catch (error: any) {
    console.error('Error triggering manual retry:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel pending retries for a payment (admin only)
router.delete('/payment/:paymentId/retries', requireRole(['admin', 'super_admin']), [
  param('paymentId').isUUID().withMessage('Payment ID must be a valid UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const paymentId = req.params.paymentId;
    const cancelledCount = await PaymentRetryService.cancelRetries(paymentId);

    res.json({
      success: true,
      message: `Cancelled ${cancelledCount} pending retries`,
      cancelledCount
    });
  } catch (error: any) {
    console.error('Error cancelling retries:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get retry statistics (admin only)
router.get('/statistics', requireRole(['admin', 'super_admin']), [
  query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const days = parseInt(req.query.days as string) || 30;
    const statistics = await PaymentRetryService.getRetryStatistics(days);

    res.json({
      success: true,
      data: {
        period: `Last ${days} days`,
        ...statistics
      }
    });
  } catch (error: any) {
    console.error('Error getting retry statistics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get retry configuration and status
router.get('/config', requireRole(['admin', 'super_admin']), (req, res) => {
  res.json({
    success: true,
    data: {
      maxRetries: 3,
      retryDelayMinutes: 60,
      exponentialBackoff: true,
      retryReasons: [
        'insufficient_funds',
        'card_declined',
        'processing_error',
        'network_error',
        'rate_limit_exceeded'
      ],
      automatedProcessing: process.env.NODE_ENV !== 'development',
      processingInterval: '15 minutes'
    }
  });
});

// Schedule a retry for a specific payment with custom reason (admin only)
router.post('/payment/:paymentId/schedule', requireRole(['admin', 'super_admin']), [
  param('paymentId').isUUID().withMessage('Payment ID must be a valid UUID'),
  body('reason').isString().notEmpty().withMessage('Reason is required'),
  body('options').optional().isObject().withMessage('Options must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { paymentId } = req.params;
    const { reason, options } = req.body;

    await PaymentRetryService.schedulePaymentRetry(paymentId, reason, options);

    res.json({
      success: true,
      message: `Payment retry scheduled for reason: ${reason}`
    });
  } catch (error: any) {
    console.error('Error scheduling payment retry:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all retry attempts for a payment (admin only)
router.get('/payment/:paymentId/attempts', requireRole(['admin', 'super_admin']), [
  param('paymentId').isUUID().withMessage('Payment ID must be a valid UUID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const paymentId = req.params.paymentId;

    const { prisma } = require('../config/database');
    const attempts = await prisma.paymentRetryAttempt.findMany({
      where: { paymentId },
      orderBy: { attemptNumber: 'asc' }
    });

    res.json({
      success: true,
      data: attempts
    });
  } catch (error: any) {
    console.error('Error getting retry attempts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check for retry service
router.get('/health', requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const { prisma } = require('../config/database');

    // Get pending retries count
    const pendingRetries = await prisma.paymentRetryAttempt.count({
      where: {
        status: 'pending',
        scheduledAt: {
          lte: new Date()
        }
      }
    });

    // Get overdue retries (more than 1 hour past scheduled time)
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const overdueRetries = await prisma.paymentRetryAttempt.count({
      where: {
        status: 'pending',
        scheduledAt: {
          lte: oneHourAgo
        }
      }
    });

    res.json({
      success: true,
      data: {
        serviceStatus: 'operational',
        pendingRetries,
        overdueRetries,
        lastCheck: new Date().toISOString(),
        automatedProcessing: process.env.NODE_ENV !== 'development'
      }
    });
  } catch (error: any) {
    console.error('Error checking retry service health:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;