import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken, requireRole } from '../middleware/auth';
import { UserService } from '../services/user';

const router = express.Router();

// Get all users in tenant
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const users = await UserService.getUsersByTenant(req.user.tenantId);
    res.json({
      success: true,
      data: users
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req: any, res) => {
  try {
    const user = await UserService.getUserById(req.params.id, req.user.tenantId);
    res.json({
      success: true,
      data: user
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// Create new user (admin/supervisor only)
router.post('/', authenticateToken, requireRole(['superadmin', 'company_admin', 'supervisor']), [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('firstName').trim().isLength({ min: 1 }),
  body('lastName').trim().isLength({ min: 1 }),
  body('role').isIn(['superadmin', 'company_admin', 'agent', 'supervisor', 'user']),
  body('extensionId').optional().isUUID()
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

    const user = await UserService.createUser(req.body, req.user.tenantId);
    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update user
router.put('/:id', authenticateToken, requireRole(['superadmin', 'company_admin', 'supervisor']), [
  body('firstName').optional().trim().isLength({ min: 1 }),
  body('lastName').optional().trim().isLength({ min: 1 }),
  body('role').optional().isIn(['superadmin', 'company_admin', 'agent', 'supervisor', 'user']),
  body('extensionId').optional().isUUID(),
  body('isActive').optional().isBoolean()
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

    const user = await UserService.updateUser(req.params.id, req.body, req.user.tenantId);
    res.json({
      success: true,
      data: user
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Delete user (soft delete)
router.delete('/:id', authenticateToken, requireRole(['superadmin', 'company_admin']), async (req: any, res) => {
  try {
    await UserService.deleteUser(req.params.id, req.user.tenantId);
    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Change password
router.post('/:id/change-password', authenticateToken, [
  body('currentPassword').isLength({ min: 6 }),
  body('newPassword').isLength({ min: 6 })
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

    // Users can only change their own password unless admin
    if (req.params.id !== req.user.id && !['superadmin', 'company_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'You can only change your own password'
      });
    }

    const result = await UserService.changePassword(
      req.params.id,
      req.body.currentPassword,
      req.body.newPassword,
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

// Get user statistics
router.get('/stats/overview', authenticateToken, requireRole(['superadmin', 'company_admin', 'supervisor']), async (req: any, res) => {
  try {
    const stats = await UserService.getUserStats(req.user.tenantId);
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