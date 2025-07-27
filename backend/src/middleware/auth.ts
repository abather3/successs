import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { AuthRequest, User, UserRole } from '../types';
import { UserService } from '../services/user';
import { AuthErrors, throwAuthError, asyncErrorHandler } from './errorHandler';

export const authenticateToken = asyncErrorHandler(async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    throwAuthError(AuthErrors.TOKEN_MISSING);
  }

  try {
    const decoded = jwt.verify(token!, config.JWT_SECRET) as any;
    const user = await UserService.findById(decoded.userId);

    if (!user) {
      throwAuthError(AuthErrors.USER_NOT_FOUND);
    }

    if (user!.status !== 'active') {
      throwAuthError(AuthErrors.USER_INACTIVE);
    }

    req.user = user!;
    next();
  } catch (jwtError) {
    // JWT errors will be handled by the global error handler
    throw jwtError;
  }
});

export const requireRole = (roles: UserRole[], resourceName?: string) => {
  return asyncErrorHandler(async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      throwAuthError(AuthErrors.TOKEN_MISSING);
    }

    if (!roles.includes(req.user!.role)) {
      // Create a more specific error with required roles information
      const requiredRoles = roles.join(', ');
      const userRole = req.user!.role;
      const resource = resourceName || req.path;
      
      console.warn(`Access denied for user ${req.user!.email} (${userRole}) to ${resource}. Required roles: ${requiredRoles}`);
      
      const enhancedError = new (AuthErrors.INSUFFICIENT_PERMISSIONS.constructor as any)(
        'INSUFFICIENT_PERMISSIONS',
        `Insufficient permissions. User role '${userRole}' does not have access to ${resource}`,
        `Access denied. Required roles: ${requiredRoles}. Your role: ${userRole}`,
        403
      );
      
      throw enhancedError;
    }

    next();
  });
};

export const requireAdmin = requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
export const requireSalesOrAdmin = requireRole([UserRole.SALES, UserRole.ADMIN, UserRole.SUPER_ADMIN]);
export const requireCashierOrAdmin = requireRole([UserRole.CASHIER, UserRole.ADMIN, UserRole.SUPER_ADMIN]);
export const requireSuperAdmin = requireRole([UserRole.SUPER_ADMIN]);

// RBAC middleware for viewing processing items (Admin, Sales, Cashier can view)
export const requireProcessingView = requireRole(
  [UserRole.ADMIN, UserRole.SALES, UserRole.CASHIER, UserRole.SUPER_ADMIN], 
  'processing items view'
);

// RBAC middleware for Serve → Processing transitions (only Admin & Cashier)
export const requireServeToProcessing = requireRole(
  [UserRole.ADMIN, UserRole.CASHIER, UserRole.SUPER_ADMIN],
  'serve to processing transition'
);

// RBAC middleware for forced status transitions (only Admin)
export const requireForcedTransitions = requireRole(
  [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  'forced status transitions'
);

export const logActivity = (action: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user) {
        const details = {
          method: req.method,
          path: req.path,
          params: req.params,
          query: req.query,
          body: req.method !== 'GET' ? req.body : undefined,
        };

        // Log activity after response is sent
        res.on('finish', async () => {
          try {
            const { ActivityService } = await import('../services/activity');
            await ActivityService.log({
              user_id: req.user!.id,
              action,
              details,
              ip_address: req.ip,
              user_agent: req.get('User-Agent'),
            });
          } catch (error) {
            console.error('Failed to log activity:', error);
          }
        });
      }
      next();
    } catch (error) {
      console.error('Activity logging middleware error:', error);
      next();
    }
  };
};
