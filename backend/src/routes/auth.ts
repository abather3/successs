import express, { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
const { body } = require('express-validator');
import { UserService } from '../services/user';
import { ActivityService } from '../services/activity';
import { config, getSecureConfig } from '../config/config';
import { pool } from '../config/database';
import { UserRole } from '../types';
import { validate } from '../middleware/validation';
import { PasswordPolicyService } from '../services/passwordPolicy';
import { AccountLockoutService } from '../services/accountLockout';
import { MfaService } from '../services/mfaService';
import { JwtService } from '../services/jwtService';
import { AuthErrors, throwAuthError, asyncErrorHandler } from '../middleware/errorHandler';
import { 
  resetPasswordSchema, 
  verifyTokenSchema, 
  requestPasswordResetSchema 
} from '../validation/schemas/auth';

const router: express.Router = Router();

// Login
router.post('/login',
  validate([
    body('email').isEmail().withMessage('Invalid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
  ]),
  asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;
    // Validate user credentials
    const user = await UserService.validatePassword(email, password);
    
    if (!user) {
      throwAuthError(AuthErrors.INVALID_CREDENTIALS);
    }

    if (user!.status !== 'active') {
      throwAuthError(AuthErrors.USER_INACTIVE);
    }

    // Generate JWT tokens
    const accessToken = (jwt as any).sign(
      { userId: user!.id, email: user!.email, role: user!.role },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    const refreshToken = (jwt as any).sign(
      { userId: user!.id, tokenId: Date.now() }, // Add tokenId for rotation
      config.JWT_REFRESH_SECRET,
      { expiresIn: config.JWT_REFRESH_EXPIRES_IN }
    );

    // Set refresh token as HttpOnly cookie
    res.cookie(config.REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth/refresh'
    });

    // Log activity
    await ActivityService.log({
      user_id: user!.id,
      action: 'login',
      details: { method: 'password' },
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.json({
      user: {
        id: user!.id,
        email: user!.email,
        full_name: user!.full_name,
        role: user!.role,
        status: user!.status
      },
      accessToken,
      refreshToken
    });
  }));

// Refresh token
router.post('/refresh', asyncErrorHandler(async (req: Request, res: Response): Promise<void> => {
  // Support both cookie and body-based refresh tokens
  const refreshToken = req.cookies[config.REFRESH_TOKEN_COOKIE_NAME] || req.body.refreshToken;

  if (!refreshToken) {
    throwAuthError(AuthErrors.REFRESH_TOKEN_MISSING);
  }

  try {
    const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as any;
    const user = await UserService.findById(decoded.userId);

    if (!user) {
      throwAuthError(AuthErrors.REFRESH_TOKEN_INVALID);
    }

    if (user!.status !== 'active') {
      throwAuthError(AuthErrors.USER_INACTIVE);
    }

    // Generate new access token
    const accessToken = (jwt as any).sign(
      { userId: user!.id, email: user!.email, role: user!.role },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN }
    );

    let newRefreshToken = refreshToken;
    
    // Token rotation: generate new refresh token if enabled
    if (config.TOKEN_ROTATION_ENABLED) {
      newRefreshToken = (jwt as any).sign(
        { userId: user!.id, tokenId: Date.now() },
        config.JWT_REFRESH_SECRET,
        { expiresIn: config.JWT_REFRESH_EXPIRES_IN }
      );
      
      // Update refresh token cookie
      res.cookie(config.REFRESH_TOKEN_COOKIE_NAME, newRefreshToken, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/api/auth/refresh'
      });
    }

    res.json({ 
      accessToken,
      refreshToken: newRefreshToken,
      expiresAt: Date.now() + (30 * 60 * 1000) // 30 minutes from now
    });
  } catch (jwtError) {
    // JWT errors will be handled by the global error handler
    // Convert JWT errors to refresh token errors
    if (jwtError instanceof jwt.TokenExpiredError) {
      throwAuthError(AuthErrors.REFRESH_TOKEN_EXPIRED);
    } else if (jwtError instanceof jwt.JsonWebTokenError || jwtError instanceof jwt.NotBeforeError) {
      throwAuthError(AuthErrors.REFRESH_TOKEN_INVALID);
    } else {
      throw jwtError;
    }
  }
}));

// Register (Admin only)
router.post('/register',
  validate([
    body('email').isEmail().withMessage('Invalid email address'),
    body('full_name').notEmpty().withMessage('Full name is required'),
    body('password').isLength({ min: config.PASSWORD_MIN_LENGTH }).withMessage(`Password must be at least ${config.PASSWORD_MIN_LENGTH} characters long`),
    body('role').custom((value: any) => Object.values(UserRole).includes(value)).withMessage('Invalid role')
  ]),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, full_name, password, role } = req.body;
      const user = await UserService.create({
        email,
        fullName: full_name,
        role
      });

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          status: user.status,
          created_at: user.created_at
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      
      if (error instanceof Error && error.message.includes('already exists')) {
        res.status(409).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

// Change password
router.post('/change-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, currentPassword, newPassword } = req.body;

    if (!email || !currentPassword || !newPassword) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    if (newPassword.length < config.PASSWORD_MIN_LENGTH) {
      res.status(400).json({ 
        error: `Password must be at least ${config.PASSWORD_MIN_LENGTH} characters long` 
      });
      return;
    }

    // Validate current password
    const user = await UserService.validatePassword(email, currentPassword);
    if (!user) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Update password
    await UserService.updatePassword(user.id, newPassword);

    // Log activity
    await ActivityService.log({
      user_id: user.id,
      action: 'password_change',
      details: { method: 'self_service' },
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Request password reset (send reset email)
router.post('/request-password-reset', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    await UserService.requestPasswordReset(email);

    // Always return success message for security (don't reveal if email exists)
    res.json({ message: 'If the email exists, a reset link will be sent' });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password with token
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({ error: 'Token and new password are required' });
      return;
    }

    const success = await UserService.resetPasswordWithToken(token, newPassword);
    
    if (success) {
      res.json({ message: 'Password reset successfully' });
    } else {
      res.status(400).json({ error: 'Failed to reset password' });
    }
  } catch (error) {
    console.error('Password reset error:', error);
    if (error instanceof Error && (error.message.includes('Invalid') || error.message.includes('expired'))) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Verify reset token
router.post('/verify-reset-token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ error: 'Token is required' });
      return;
    }

    const query = `
      SELECT id, full_name, email, reset_token_expiry
      FROM users 
      WHERE reset_token = $1 AND reset_token_expiry > CURRENT_TIMESTAMP
    `;
    
    const result = await pool.query(query, [token]);
    
    if (result.rows.length === 0) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    const user = result.rows[0];
    res.json({ 
      valid: true, 
      email: user.email,
      name: user.full_name
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout (optional - mainly for logging purposes)
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, config.JWT_SECRET) as any;
        
        // Log activity
        await ActivityService.log({
          user_id: decoded.userId,
          action: 'logout',
          details: {},
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        });
      } catch (error) {
        // Token might be invalid, but that's okay for logout
      }
    }

    // Clear refresh token cookie
    res.clearCookie(config.REFRESH_TOKEN_COOKIE_NAME, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh'
    });
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token
router.get('/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const decoded = jwt.verify(token, config.JWT_SECRET) as any;
    const user = await UserService.findById(decoded.userId);

    if (!user || user.status !== 'active') {
      res.status(401).json({ error: 'Invalid or inactive user' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
