import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateToken, requireRole } from '../middleware/auth';
import { CallService } from '../services/call';

const router = express.Router();

// Get all calls in tenant with pagination
router.get('/', authenticateToken, [
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

    const limit = req.query.limit || 50;
    const offset = req.query.offset || 0;

    console.log('Calls endpoint called by user:', req.user?.email, 'tenant:', req.user?.tenantId);

    // Return mock calls data for demonstration
    const mockCalls = [
      {
        id: 'call-001',
        fromNumber: '+1234567890',
        toNumber: '+1987654321',
        direction: 'inbound',
        status: 'completed',
        startTime: new Date(Date.now() - 3600000).toISOString(),
        endTime: new Date(Date.now() - 3540000).toISOString(),
        duration: 60,
        recordingUrl: null,
        extension: {
          id: 'ext-001',
          number: '1001',
          displayName: 'Reception',
          type: 'user'
        },
        agent: {
          id: 'user-001',
          firstName: 'John',
          lastName: 'Smith',
          email: 'john@company.com'
        }
      },
      {
        id: 'call-002',
        fromNumber: '+1555666777',
        toNumber: '+1234567890',
        direction: 'outbound',
        status: 'completed',
        startTime: new Date(Date.now() - 7200000).toISOString(),
        endTime: new Date(Date.now() - 7080000).toISOString(),
        duration: 120,
        recordingUrl: '/recordings/call-002.wav',
        extension: {
          id: 'ext-002',
          number: '1002',
          displayName: 'Sales Manager',
          type: 'user'
        },
        agent: {
          id: 'user-002',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@company.com'
        }
      },
      {
        id: 'call-003',
        fromNumber: '+1999888777',
        toNumber: '+1234567890',
        direction: 'inbound',
        status: 'missed',
        startTime: new Date(Date.now() - 1800000).toISOString(),
        duration: 0,
        extension: {
          id: 'ext-001',
          number: '1001',
          displayName: 'Reception',
          type: 'user'
        }
      }
    ];

    console.log('Returning mock calls:', mockCalls.length, 'items');
    res.json({
      success: true,
      data: mockCalls,
      pagination: {
        limit,
        offset,
        count: mockCalls.length
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get active calls
router.get('/active', authenticateToken, async (req: any, res) => {
  try {
    console.log('Active calls endpoint called by user:', req.user?.email, 'tenant:', req.user?.tenantId);

    // Return mock active calls data
    const mockActiveCalls = [
      {
        id: 'active-call-001',
        fromNumber: '+1555123456',
        toNumber: '+1234567890',
        direction: 'inbound',
        status: 'ringing',
        startTime: new Date(Date.now() - 30000).toISOString(),
        extension: {
          id: 'ext-001',
          number: '1001',
          displayName: 'Reception',
          type: 'user'
        },
        agent: {
          id: 'user-001',
          firstName: 'John',
          lastName: 'Smith',
          email: 'john@company.com'
        }
      },
      {
        id: 'active-call-002',
        fromNumber: '+1987654321',
        toNumber: '+1777888999',
        direction: 'outbound',
        status: 'answered',
        startTime: new Date(Date.now() - 120000).toISOString(),
        extension: {
          id: 'ext-002',
          number: '1002',
          displayName: 'Sales Manager',
          type: 'user'
        },
        agent: {
          id: 'user-002',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@company.com'
        }
      }
    ];

    console.log('Returning mock active calls:', mockActiveCalls.length, 'items');
    res.json({
      success: true,
      data: mockActiveCalls
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get call by ID
router.get('/:id', authenticateToken, async (req: any, res) => {
  try {
    const call = await CallService.getCallById(req.params.id, req.user.tenantId);
    res.json({
      success: true,
      data: call
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// Create new call (agents and above)
router.post('/', authenticateToken, requireRole(['agent', 'supervisor', 'company_admin', 'superadmin']), [
  body('fromNumber').trim().isLength({ min: 1 }),
  body('toNumber').trim().isLength({ min: 1 }),
  body('direction').isIn(['inbound', 'outbound']),
  body('extensionId').optional().isUUID(),
  body('queueId').optional().isUUID(),
  body('agentId').optional().isUUID()
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

    const call = await CallService.createCall(req.body, req.user.tenantId);
    res.status(201).json({
      success: true,
      data: call
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update call status
router.put('/:id', authenticateToken, requireRole(['agent', 'supervisor', 'company_admin', 'superadmin']), [
  body('status').optional().isIn(['ringing', 'answered', 'busy', 'failed', 'completed', 'transferred']),
  body('endTime').optional().isISO8601().toDate(),
  body('duration').optional().isInt({ min: 0 }),
  body('recordingUrl').optional().isURL(),
  body('agentId').optional().isUUID()
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

    const call = await CallService.updateCall(req.params.id, req.body, req.user.tenantId);
    res.json({
      success: true,
      data: call
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Transfer call
router.post('/:id/transfer', authenticateToken, requireRole(['agent', 'supervisor', 'company_admin', 'superadmin']), [
  body('targetExtensionId').isUUID()
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

    const call = await CallService.transferCall(
      req.params.id,
      req.body.targetExtensionId,
      req.user.tenantId
    );

    res.json({
      success: true,
      data: call
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get calls by agent
router.get('/agent/:agentId', authenticateToken, [
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
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

    // Users can only view their own calls unless admin/supervisor
    if (req.params.agentId !== req.user.id && !['company_admin', 'superadmin', 'supervisor'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'You can only view your own calls'
      });
    }

    const limit = req.query.limit || 20;
    const calls = await CallService.getCallsByAgent(req.params.agentId, req.user.tenantId, limit);

    res.json({
      success: true,
      data: calls
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get calls by extension
router.get('/extension/:extensionId', authenticateToken, [
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
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

    const limit = req.query.limit || 20;
    const calls = await CallService.getCallsByExtension(req.params.extensionId, req.user.tenantId, limit);

    res.json({
      success: true,
      data: calls
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get call statistics
router.get('/stats/overview', authenticateToken, requireRole(['supervisor', 'company_admin', 'superadmin']), [
  query('startDate').optional().isISO8601().toDate(),
  query('endDate').optional().isISO8601().toDate()
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

    const stats = await CallService.getCallStats(
      req.user.tenantId,
      req.query.startDate,
      req.query.endDate
    );

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get today's call statistics
router.get('/stats/today', authenticateToken, async (req: any, res) => {
  try {
    const stats = await CallService.getTodayStats(req.user.tenantId);
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;