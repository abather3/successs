import express, { Router, Request, Response } from 'express';
import { UserService } from '../services/user';
import { authenticateToken, requireAdmin, logActivity } from '../middleware/auth';
import { UserRole, UserStatus } from '../types';

const router: express.Router = Router();

// Create new user
router.post('/', authenticateToken, requireAdmin, logActivity('create_user'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, email, role } = req.body;
    
    if (!fullName || !email || !role) {
      res.status(400).json({ error: 'Full name, email, and role are required' });
      return;
    }

    if (!['sales', 'cashier'].includes(role)) {
      res.status(400).json({ error: 'Role must be either sales or cashier' });
      return;
    }

    const newUser = await UserService.create({
      fullName,
      email,
      role: role as UserRole
    });

    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error creating user:', error);
    if (error instanceof Error && error.message.includes('already exists')) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// List all users
router.get('/', authenticateToken, requireAdmin, logActivity('list_users'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, status, excludeRole } = req.query;
    const filters = {
      role: role as UserRole,
      status: status as UserStatus,
      excludeRole: excludeRole as UserRole
    };

    const users = await UserService.list(filters);
    res.json(users);
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, requireAdmin, logActivity('get_user'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = Number(id);
    if (!Number.isInteger(userId)) {
      res.status(400).json({ error: 'Invalid user id' });
      return;
    }

    const user = await UserService.findById(userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user
router.put('/:id', authenticateToken, requireAdmin, logActivity('update_user'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = Number(id);
    if (!Number.isInteger(userId)) {
      res.status(400).json({ error: 'Invalid user id' });
      return;
    }

    const updates = req.body;
    const updatedUser = await UserService.update(userId, updates);

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check user dependencies before deletion
router.get('/:id/dependencies', authenticateToken, requireAdmin, logActivity('check_user_dependencies'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = Number(id);
    if (!Number.isInteger(userId)) {
      res.status(400).json({ error: 'Invalid user id' });
      return;
    }

    const dependencies = await UserService.getUserDependencies(userId);
    
    res.json(dependencies);
  } catch (error) {
    console.error('Error checking user dependencies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user
router.delete('/:id', authenticateToken, requireAdmin, logActivity('delete_user'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = Number(id);
    if (!Number.isInteger(userId)) {
      res.status(400).json({ error: 'Invalid user id' });
      return;
    }

    await UserService.delete(userId);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting user:', error);
    if (error instanceof Error && error.message.includes('Cannot delete user')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Trigger password reset for user
router.post('/:id/reset-password', authenticateToken, requireAdmin, logActivity('admin_reset_password'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = Number(id);
    if (!Number.isInteger(userId)) {
      res.status(400).json({ error: 'Invalid user id' });
      return;
    }

    const result = await UserService.triggerPasswordReset(userId);
    
    res.json({ 
      message: 'Password reset email sent successfully',
      resetToken: result.resetToken
    });
  } catch (error) {
    console.error('Error triggering password reset:', error);
    if (error instanceof Error && error.message === 'User not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;
