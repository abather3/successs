"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logActivity = exports.requireForcedTransitions = exports.requireServeToProcessing = exports.requireProcessingView = exports.requireSuperAdmin = exports.requireCashierOrAdmin = exports.requireSalesOrAdmin = exports.requireAdmin = exports.requireRole = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config/config");
const types_1 = require("../types");
const user_1 = require("../services/user");
const errorHandler_1 = require("./errorHandler");
exports.authenticateToken = (0, errorHandler_1.asyncErrorHandler)(async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) {
        (0, errorHandler_1.throwAuthError)(errorHandler_1.AuthErrors.TOKEN_MISSING);
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.config.JWT_SECRET);
        const user = await user_1.UserService.findById(decoded.userId);
        if (!user) {
            (0, errorHandler_1.throwAuthError)(errorHandler_1.AuthErrors.USER_NOT_FOUND);
        }
        if (user.status !== 'active') {
            (0, errorHandler_1.throwAuthError)(errorHandler_1.AuthErrors.USER_INACTIVE);
        }
        req.user = user;
        next();
    }
    catch (jwtError) {
        // JWT errors will be handled by the global error handler
        throw jwtError;
    }
});
const requireRole = (roles, resourceName) => {
    return (0, errorHandler_1.asyncErrorHandler)(async (req, res, next) => {
        if (!req.user) {
            (0, errorHandler_1.throwAuthError)(errorHandler_1.AuthErrors.TOKEN_MISSING);
        }
        if (!roles.includes(req.user.role)) {
            // Create a more specific error with required roles information
            const requiredRoles = roles.join(', ');
            const userRole = req.user.role;
            const resource = resourceName || req.path;
            console.warn(`Access denied for user ${req.user.email} (${userRole}) to ${resource}. Required roles: ${requiredRoles}`);
            const enhancedError = new errorHandler_1.AuthErrors.INSUFFICIENT_PERMISSIONS.constructor('INSUFFICIENT_PERMISSIONS', `Insufficient permissions. User role '${userRole}' does not have access to ${resource}`, `Access denied. Required roles: ${requiredRoles}. Your role: ${userRole}`, 403);
            throw enhancedError;
        }
        next();
    });
};
exports.requireRole = requireRole;
exports.requireAdmin = (0, exports.requireRole)([types_1.UserRole.ADMIN, types_1.UserRole.SUPER_ADMIN]);
exports.requireSalesOrAdmin = (0, exports.requireRole)([types_1.UserRole.SALES, types_1.UserRole.ADMIN, types_1.UserRole.SUPER_ADMIN]);
exports.requireCashierOrAdmin = (0, exports.requireRole)([types_1.UserRole.CASHIER, types_1.UserRole.ADMIN, types_1.UserRole.SUPER_ADMIN]);
exports.requireSuperAdmin = (0, exports.requireRole)([types_1.UserRole.SUPER_ADMIN]);
// RBAC middleware for viewing processing items (Admin, Sales, Cashier can view)
exports.requireProcessingView = (0, exports.requireRole)([types_1.UserRole.ADMIN, types_1.UserRole.SALES, types_1.UserRole.CASHIER, types_1.UserRole.SUPER_ADMIN], 'processing items view');
// RBAC middleware for Serve → Processing transitions (only Admin & Cashier)
exports.requireServeToProcessing = (0, exports.requireRole)([types_1.UserRole.ADMIN, types_1.UserRole.CASHIER, types_1.UserRole.SUPER_ADMIN], 'serve to processing transition');
// RBAC middleware for forced status transitions (only Admin)
exports.requireForcedTransitions = (0, exports.requireRole)([types_1.UserRole.ADMIN, types_1.UserRole.SUPER_ADMIN], 'forced status transitions');
const logActivity = (action) => {
    return async (req, res, next) => {
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
                        const { ActivityService } = await Promise.resolve().then(() => __importStar(require('../services/activity')));
                        await ActivityService.log({
                            user_id: req.user.id,
                            action,
                            details,
                            ip_address: req.ip,
                            user_agent: req.get('User-Agent'),
                        });
                    }
                    catch (error) {
                        console.error('Failed to log activity:', error);
                    }
                });
            }
            next();
        }
        catch (error) {
            console.error('Activity logging middleware error:', error);
            next();
        }
    };
};
exports.logActivity = logActivity;
//# sourceMappingURL=auth.js.map