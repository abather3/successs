import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { monitoringService } from '../services/monitoring';

// Define standardized auth error types
export class AuthError extends Error {
  public code: string;
  public statusCode: number;
  public userMessage: string;

  constructor(code: string, message: string, userMessage: string, statusCode: number = 401) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.userMessage = userMessage;
    this.statusCode = statusCode;
  }
}

// Predefined auth error types
export const AuthErrors = {
  TOKEN_MISSING: new AuthError('TOKEN_MISSING', 'No token provided', 'Authentication token is required', 401),
  TOKEN_EXPIRED: new AuthError('TOKEN_EXPIRED', 'Token has expired', 'Your session has expired', 401),
  TOKEN_INVALID: new AuthError('TOKEN_INVALID', 'Invalid token', 'Invalid authentication token', 401),
  TOKEN_MALFORMED: new AuthError('TOKEN_MALFORMED', 'Token is malformed', 'Invalid token format', 401),
  USER_NOT_FOUND: new AuthError('USER_NOT_FOUND', 'User not found', 'Invalid user credentials', 401),
  USER_INACTIVE: new AuthError('USER_INACTIVE', 'User account is inactive', 'Your account is inactive', 401),
  INSUFFICIENT_PERMISSIONS: new AuthError('INSUFFICIENT_PERMISSIONS', 'Insufficient permissions', 'You do not have permission to access this resource', 403),
  INVALID_CREDENTIALS: new AuthError('INVALID_CREDENTIALS', 'Invalid email or password', 'Invalid email or password', 401),
  ACCOUNT_LOCKED: new AuthError('ACCOUNT_LOCKED', 'Account is locked', 'Your account has been locked due to too many failed attempts', 401),
  REFRESH_TOKEN_MISSING: new AuthError('REFRESH_TOKEN_MISSING', 'Refresh token required', 'Refresh token is required', 400),
  REFRESH_TOKEN_INVALID: new AuthError('REFRESH_TOKEN_INVALID', 'Invalid refresh token', 'Invalid refresh token', 401),
  REFRESH_TOKEN_EXPIRED: new AuthError('REFRESH_TOKEN_EXPIRED', 'Refresh token expired', 'Your refresh token has expired', 401),
};

// Helper function to create auth errors
export const createAuthError = (errorType: AuthError): AuthError => {
  return new AuthError(errorType.code, errorType.message, errorType.userMessage, errorType.statusCode);
};

// Helper function to determine error type from JWT errors
export const getJwtErrorType = (error: any): AuthError => {
  if (error instanceof jwt.TokenExpiredError) {
    return AuthErrors.TOKEN_EXPIRED;
  } else if (error instanceof jwt.NotBeforeError) {
    return AuthErrors.TOKEN_INVALID;
  } else if (error instanceof jwt.JsonWebTokenError) {
    return AuthErrors.TOKEN_MALFORMED;
  } else {
    return AuthErrors.TOKEN_INVALID;
  }
};

// Global error handler middleware
export const errorHandler = (
  error: Error | AuthError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Handle AuthError instances
  if (error instanceof AuthError) {
    console.warn(`Auth error [${error.code}]: ${error.message}`);
    
    // Record error in monitoring service
    monitoringService.recordError(error, {
      endpoint: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      code: error.code
    });
    
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.userMessage
      }
    });
    return;
  }

  // Handle JWT errors
  if (error instanceof jwt.TokenExpiredError || 
      error instanceof jwt.JsonWebTokenError || 
      error instanceof jwt.NotBeforeError) {
    const authError = getJwtErrorType(error);
    console.warn(`JWT error [${authError.code}]: ${authError.message}`);
    
    // Record JWT error in monitoring service
    monitoringService.recordError(authError, {
      endpoint: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      code: authError.code,
      type: 'JWT_ERROR'
    });
    
    res.status(authError.statusCode).json({
      error: {
        code: authError.code,
        message: authError.userMessage
      }
    });
    return;
  }

  // Handle other errors
  console.error('Unhandled error:', error);
  
  // Record unhandled error in monitoring service
  monitoringService.recordError(error, {
    endpoint: req.path,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    type: 'UNHANDLED_ERROR',
    stack: error.stack
  });
  
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal server error occurred'
    }
  });
};

// Express error handler wrapper for async functions
export const asyncErrorHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Helper function to throw auth errors
export const throwAuthError = (errorType: AuthError): never => {
  throw createAuthError(errorType);
};
