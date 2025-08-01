"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.throwAuthError = exports.asyncErrorHandler = exports.errorHandler = exports.getJwtErrorType = exports.createAuthError = exports.AuthErrors = exports.AuthError = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const monitoring_1 = require("../services/monitoring");
// Define standardized auth error types
class AuthError extends Error {
    constructor(code, message, userMessage, statusCode = 401) {
        super(message);
        this.name = 'AuthError';
        this.code = code;
        this.userMessage = userMessage;
        this.statusCode = statusCode;
    }
}
exports.AuthError = AuthError;
// Predefined auth error types
exports.AuthErrors = {
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
const createAuthError = (errorType) => {
    return new AuthError(errorType.code, errorType.message, errorType.userMessage, errorType.statusCode);
};
exports.createAuthError = createAuthError;
// Helper function to determine error type from JWT errors
const getJwtErrorType = (error) => {
    if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
        return exports.AuthErrors.TOKEN_EXPIRED;
    }
    else if (error instanceof jsonwebtoken_1.default.NotBeforeError) {
        return exports.AuthErrors.TOKEN_INVALID;
    }
    else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
        return exports.AuthErrors.TOKEN_MALFORMED;
    }
    else {
        return exports.AuthErrors.TOKEN_INVALID;
    }
};
exports.getJwtErrorType = getJwtErrorType;
// Global error handler middleware
const errorHandler = (error, req, res, next) => {
    // Handle AuthError instances
    if (error instanceof AuthError) {
        console.warn(`Auth error [${error.code}]: ${error.message}`);
        // Record error in monitoring service
        monitoring_1.monitoringService.recordError(error, {
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
    if (error instanceof jsonwebtoken_1.default.TokenExpiredError ||
        error instanceof jsonwebtoken_1.default.JsonWebTokenError ||
        error instanceof jsonwebtoken_1.default.NotBeforeError) {
        const authError = (0, exports.getJwtErrorType)(error);
        console.warn(`JWT error [${authError.code}]: ${authError.message}`);
        // Record JWT error in monitoring service
        monitoring_1.monitoringService.recordError(authError, {
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
    monitoring_1.monitoringService.recordError(error, {
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
exports.errorHandler = errorHandler;
// Express error handler wrapper for async functions
const asyncErrorHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncErrorHandler = asyncErrorHandler;
// Helper function to throw auth errors
const throwAuthError = (errorType) => {
    throw (0, exports.createAuthError)(errorType);
};
exports.throwAuthError = throwAuthError;
//# sourceMappingURL=errorHandler.js.map