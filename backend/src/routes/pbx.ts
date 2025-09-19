import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken, requireRole } from '../middleware/auth';
import { pbxService } from '../services/pbx';

const router = express.Router();

// Get PBX status
router.get('/status', authenticateToken, async (req: any, res) => {
  try {
    const status = pbxService.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all PBX extensions for tenant
router.get('/extensions', authenticateToken, async (req: any, res) => {
  try {
    console.log('PBX extensions endpoint called by user:', req.user?.email, 'tenant:', req.user?.tenantId);

    // Return mock PBX extension data
    const mockSipExtensions = [
      {
        id: 'sip-001',
        number: '1001',
        domain: 'pbx.cloudcall.local',
        tenantId: req.user.tenantId,
        userId: 'user-001',
        status: 'available'
      },
      {
        id: 'sip-002',
        number: '1002',
        domain: 'pbx.cloudcall.local',
        tenantId: req.user.tenantId,
        userId: 'user-002',
        status: 'busy'
      },
      {
        id: 'sip-003',
        number: '1003',
        domain: 'pbx.cloudcall.local',
        tenantId: req.user.tenantId,
        status: 'offline'
      },
      {
        id: 'sip-004',
        number: '1004',
        domain: 'pbx.cloudcall.local',
        tenantId: req.user.tenantId,
        status: 'ringing'
      }
    ];

    console.log('Returning mock PBX extensions:', mockSipExtensions.length, 'items');
    res.json({
      success: true,
      data: mockSipExtensions
    });
  } catch (error: any) {
    console.error('Error in PBX extensions endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get specific extension
router.get('/extensions/:number', authenticateToken, async (req: any, res) => {
  try {
    const extension = pbxService.getExtension(req.params.number);

    if (!extension) {
      return res.status(404).json({
        success: false,
        error: 'Extension not found'
      });
    }

    // Check tenant access
    if (extension.tenantId !== req.user.tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: extension
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create extension
router.post('/extensions', authenticateToken, requireRole(['admin', 'supervisor']), [
  body('number').isLength({ min: 3, max: 10 }).matches(/^\d+$/),
  body('userId').optional().isUUID()
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

    const extensionData = {
      ...req.body,
      tenantId: req.user.tenantId
    };

    const extension = await pbxService.createExtension(extensionData);

    res.status(201).json({
      success: true,
      data: extension
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update extension status
router.put('/extensions/:number/status', authenticateToken, [
  body('status').isIn(['available', 'busy', 'offline', 'ringing'])
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status value',
        details: errors.array()
      });
    }

    const extension = pbxService.getExtension(req.params.number);
    if (!extension) {
      return res.status(404).json({
        success: false,
        error: 'Extension not found'
      });
    }

    // Check tenant access
    if (extension.tenantId !== req.user.tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await pbxService.updateExtensionStatus(req.params.number, req.body.status);

    res.json({
      success: true,
      message: 'Extension status updated'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get active calls for tenant
router.get('/calls', authenticateToken, async (req: any, res) => {
  try {
    console.log('PBX calls endpoint called by user:', req.user?.email, 'tenant:', req.user?.tenantId);

    // Return mock PBX call sessions data
    const mockPbxCalls = [
      {
        id: 'pbx-session-001',
        callId: 'call-pbx-001',
        fromNumber: '+1555999888',
        toNumber: '1001',
        fromExtension: null,
        toExtension: '1001',
        direction: 'inbound',
        status: 'ringing',
        startTime: new Date(Date.now() - 45000).toISOString(),
        tenantId: req.user.tenantId,
        recordingEnabled: true
      },
      {
        id: 'pbx-session-002',
        callId: 'call-pbx-002',
        fromNumber: '1002',
        toNumber: '+1777555444',
        fromExtension: '1002',
        toExtension: null,
        direction: 'outbound',
        status: 'answered',
        startTime: new Date(Date.now() - 180000).toISOString(),
        answerTime: new Date(Date.now() - 165000).toISOString(),
        tenantId: req.user.tenantId,
        recordingEnabled: true
      },
      {
        id: 'pbx-session-003',
        callId: 'call-pbx-003',
        fromNumber: '1001',
        toNumber: '1003',
        fromExtension: '1001',
        toExtension: '1003',
        direction: 'internal',
        status: 'hold',
        startTime: new Date(Date.now() - 300000).toISOString(),
        answerTime: new Date(Date.now() - 285000).toISOString(),
        tenantId: req.user.tenantId,
        recordingEnabled: false
      }
    ];

    console.log('Returning mock PBX calls:', mockPbxCalls.length, 'items');
    res.json({
      success: true,
      data: mockPbxCalls
    });
  } catch (error: any) {
    console.error('Error in PBX calls endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get specific call
router.get('/calls/:callId', authenticateToken, async (req: any, res) => {
  try {
    const call = pbxService.getActiveCall(req.params.callId);

    if (!call) {
      return res.status(404).json({
        success: false,
        error: 'Call not found'
      });
    }

    // Check tenant access
    if (call.tenantId !== req.user.tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: call
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Initiate call
router.post('/calls', authenticateToken, [
  body('fromNumber').isLength({ min: 3 }),
  body('toNumber').isLength({ min: 3 })
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

    const { fromNumber, toNumber } = req.body;

    const call = await pbxService.initiateCall(
      fromNumber,
      toNumber,
      req.user.tenantId
    );

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

// Answer call
router.post('/calls/:callId/answer', authenticateToken, async (req: any, res) => {
  try {
    const call = pbxService.getActiveCall(req.params.callId);

    if (!call) {
      return res.status(404).json({
        success: false,
        error: 'Call not found'
      });
    }

    // Check tenant access
    if (call.tenantId !== req.user.tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await pbxService.answerCall(req.params.callId);

    res.json({
      success: true,
      message: 'Call answered'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// End call
router.post('/calls/:callId/end', authenticateToken, async (req: any, res) => {
  try {
    const call = pbxService.getActiveCall(req.params.callId);

    if (!call) {
      return res.status(404).json({
        success: false,
        error: 'Call not found'
      });
    }

    // Check tenant access
    if (call.tenantId !== req.user.tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await pbxService.endCall(req.params.callId);

    res.json({
      success: true,
      message: 'Call ended'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Transfer call
router.post('/calls/:callId/transfer', authenticateToken, [
  body('targetExtension').isLength({ min: 3, max: 10 }).matches(/^\d+$/)
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid target extension',
        details: errors.array()
      });
    }

    const call = pbxService.getActiveCall(req.params.callId);

    if (!call) {
      return res.status(404).json({
        success: false,
        error: 'Call not found'
      });
    }

    // Check tenant access
    if (call.tenantId !== req.user.tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await pbxService.transferCall(req.params.callId, req.body.targetExtension);

    res.json({
      success: true,
      message: 'Call transferred'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

export default router;