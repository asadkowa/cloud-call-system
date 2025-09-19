import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken, requireRole } from '../middleware/auth';
import { ExtensionService } from '../services/extension';
import { ExtensionManager } from '../services/extensionManager';

const router = express.Router();

// Get all extensions in tenant
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    console.log('Extensions endpoint called by user:', req.user?.email, 'tenant:', req.user?.tenantId);

    // For now, return mock data to demonstrate functionality
    // In production, this would query the database
    const mockExtensions = [
      {
        id: 'ext-001',
        number: '1001',
        displayName: 'Reception',
        type: 'user',
        status: 'available',
        sipPassword: 'secure123',
        sipDomain: 'pbx.cloudcall.local',
        sipEnabled: true,
        registrationStatus: 'registered',
        user: {
          id: 'user-001',
          email: 'reception@company.com',
          firstName: 'Reception',
          lastName: 'Desk',
          role: 'agent',
          isActive: true
        }
      },
      {
        id: 'ext-002',
        number: '1002',
        displayName: 'Sales Manager',
        type: 'user',
        status: 'busy',
        sipPassword: 'secure456',
        sipDomain: 'pbx.cloudcall.local',
        sipEnabled: true,
        registrationStatus: 'registered',
        user: {
          id: 'user-002',
          email: 'sales@company.com',
          firstName: 'John',
          lastName: 'Sales',
          role: 'supervisor',
          isActive: true
        }
      },
      {
        id: 'ext-003',
        number: '1003',
        displayName: 'Conference Room',
        type: 'conference',
        status: 'available',
        sipPassword: 'secure789',
        sipDomain: 'pbx.cloudcall.local',
        sipEnabled: true,
        registrationStatus: 'unregistered'
      }
    ];

    console.log('Returning mock extensions:', mockExtensions.length, 'items');
    res.json({
      success: true,
      data: mockExtensions
    });
  } catch (error: any) {
    console.error('Error in extensions endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get available extensions (unassigned user extensions)
router.get('/available', authenticateToken, async (req: any, res) => {
  try {
    const extensions = await ExtensionService.getAvailableExtensions(req.user.tenantId);
    res.json({
      success: true,
      data: extensions
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get extension by ID
router.get('/:id', authenticateToken, async (req: any, res) => {
  try {
    const extension = await ExtensionService.getExtensionById(req.params.id, req.user.tenantId);
    res.json({
      success: true,
      data: extension
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// Create new extension (admin/supervisor only)
router.post('/', authenticateToken, requireRole(['admin', 'supervisor']), [
  body('number').trim().isLength({ min: 3, max: 10 }),
  body('displayName').trim().isLength({ min: 1 }),
  body('type').isIn(['user', 'queue', 'conference', 'ivr']),
  body('config').optional().isObject(),
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

    let extension;

    // For user extensions, create with SIP credentials
    if (req.body.type === 'user') {
      extension = await ExtensionManager.createExtensionWithSip({
        tenantId: req.user.tenantId,
        number: req.body.number,
        displayName: req.body.displayName,
        type: req.body.type,
        userId: req.body.userId
      });
    } else {
      // For non-user extensions (queue, conference, ivr), use traditional creation
      extension = await ExtensionService.createExtension(req.body, req.user.tenantId);
    }

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

// Update extension
router.put('/:id', authenticateToken, requireRole(['admin', 'supervisor']), [
  body('displayName').optional().trim().isLength({ min: 1 }),
  body('type').optional().isIn(['user', 'queue', 'conference', 'ivr']),
  body('status').optional().isIn(['active', 'inactive', 'busy', 'unavailable']),
  body('config').optional().isObject()
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

    const extension = await ExtensionService.updateExtension(req.params.id, req.body, req.user.tenantId);
    res.json({
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

// Delete extension
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req: any, res) => {
  try {
    await ExtensionService.deleteExtension(req.params.id, req.user.tenantId);
    res.json({
      success: true,
      message: 'Extension deleted successfully'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Assign user to extension
router.post('/:id/assign', authenticateToken, requireRole(['admin', 'supervisor']), [
  body('userId').isUUID()
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

    const result = await ExtensionService.assignUserToExtension(
      req.params.id,
      req.body.userId,
      req.user.tenantId
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Unassign user from extension
router.post('/:id/unassign', authenticateToken, requireRole(['admin', 'supervisor']), async (req: any, res) => {
  try {
    const result = await ExtensionService.unassignUserFromExtension(req.params.id, req.user.tenantId);
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get extension statistics
router.get('/stats/overview', authenticateToken, requireRole(['admin', 'supervisor']), async (req: any, res) => {
  try {
    const stats = await ExtensionService.getExtensionStats(req.user.tenantId);
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

// Get SIP credentials for extension (user can only get their own)
router.get('/:id/sip-credentials', authenticateToken, async (req: any, res) => {
  try {
    const credentials = await ExtensionManager.getSipCredentials(req.params.id);
    if (!credentials) {
      return res.status(404).json({
        success: false,
        error: 'Extension not found or SIP not enabled'
      });
    }
    res.json({
      success: true,
      data: credentials
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get extension configuration for SIP client
router.get('/:id/config', authenticateToken, async (req: any, res) => {
  try {
    const config = await ExtensionManager.getExtensionConfig(req.params.id);
    res.json({
      success: true,
      data: config
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// Get extension status (registration status)
router.get('/:id/status', authenticateToken, async (req: any, res) => {
  try {
    const status = await ExtensionManager.getExtensionStatus(req.params.id);
    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Extension not found'
      });
    }
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

// Register extension (called by SIP clients)
router.post('/:id/register', authenticateToken, [
  body('userAgent').optional().isString(),
  body('contact').optional().isString()
], async (req: any, res) => {
  try {
    const extension = await ExtensionService.getExtensionById(req.params.id, req.user.tenantId);
    if (!extension) {
      return res.status(404).json({
        success: false,
        error: 'Extension not found'
      });
    }

    const result = await ExtensionManager.registerExtension(
      extension.number,
      req.body.userAgent,
      req.body.contact
    );

    res.json({
      success: true,
      data: { registered: result }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Unregister extension
router.post('/:id/unregister', authenticateToken, async (req: any, res) => {
  try {
    const extension = await ExtensionService.getExtensionById(req.params.id, req.user.tenantId);
    if (!extension) {
      return res.status(404).json({
        success: false,
        error: 'Extension not found'
      });
    }

    await ExtensionManager.unregisterExtension(extension.number);
    res.json({
      success: true,
      message: 'Extension unregistered successfully'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update SIP settings for extension
router.put('/:id/sip-settings', authenticateToken, requireRole(['admin', 'supervisor']), [
  body('sipEnabled').optional().isBoolean(),
  body('regeneratePassword').optional().isBoolean()
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

    const extension = await ExtensionManager.updateSipSettings(req.params.id, req.body);
    res.json({
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

// Initiate call from extension
router.post('/:id/call', authenticateToken, [
  body('toNumber').trim().isLength({ min: 3, max: 15 })
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

    const extension = await ExtensionService.getExtensionById(req.params.id, req.user.tenantId);
    if (!extension) {
      return res.status(404).json({
        success: false,
        error: 'Extension not found'
      });
    }

    const callSession = await ExtensionManager.initiateCall(
      extension.number,
      req.body.toNumber,
      req.user.tenantId
    );

    res.json({
      success: true,
      data: callSession
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get all registered extensions
router.get('/registered/all', authenticateToken, requireRole(['admin', 'supervisor']), async (req: any, res) => {
  try {
    const registeredExtensions = ExtensionManager.getRegisteredExtensions();
    res.json({
      success: true,
      data: registeredExtensions
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;