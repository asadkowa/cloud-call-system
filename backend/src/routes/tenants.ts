import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken, requireRole } from '../middleware/auth';
import { TenantService } from '../services/tenant';

const router = express.Router();

// Get all tenants (superadmin only)
router.get('/', authenticateToken, requireRole(['superadmin']), async (req: any, res) => {
  try {
    const tenants = await TenantService.getAllTenants();
    res.json({
      success: true,
      data: tenants
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get current tenant info
router.get('/current', authenticateToken, async (req: any, res) => {
  try {
    const tenant = await TenantService.getTenantById(req.user.tenantId);
    res.json({
      success: true,
      data: tenant
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// Get specific tenant by ID
router.get('/:id', authenticateToken, async (req: any, res) => {
  try {
    // Allow users to only access their own tenant unless they're superadmin
    if (req.user.role !== 'superadmin' && req.params.id !== req.user.tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const tenant = await TenantService.getTenantById(req.params.id);
    res.json({
      success: true,
      data: tenant
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// Create new tenant (superadmin only)
router.post('/', authenticateToken, requireRole(['superadmin']), [
  body('name').trim().isLength({ min: 1 }),
  body('domain').isLength({ min: 1 }),
  body('planType').isIn(['basic', 'professional', 'enterprise'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        details: errors.array()
      });
    }

    const tenant = await TenantService.createTenant(req.body);
    res.status(201).json({
      success: true,
      data: tenant
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update tenant
router.put('/:id', authenticateToken, [
  body('name').optional().trim().isLength({ min: 1 }),
  body('planType').optional().isIn(['basic', 'professional', 'enterprise'])
], async (req: any, res) => {
  try {
    // Allow users to only update their own tenant unless they're superadmin
    if (req.user.role !== 'superadmin' && req.params.id !== req.user.tenantId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input data',
        details: errors.array()
      });
    }

    const tenant = await TenantService.updateTenant(req.params.id, req.body);
    res.json({
      success: true,
      data: tenant
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Delete tenant (superadmin only)
router.delete('/:id', authenticateToken, requireRole(['superadmin']), async (req: any, res) => {
  try {
    await TenantService.deleteTenant(req.params.id);
    res.json({
      success: true,
      message: 'Tenant deleted successfully'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

export default router;