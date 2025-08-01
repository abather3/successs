"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWTDebugger = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config/config");
const types_1 = require("../types");
/**
 * Debug utility to analyze JWT tokens and role permissions
 */
class JWTDebugger {
    /**
     * Decode and analyze a JWT token without verification (for debugging)
     */
    static decodeToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.decode(token);
            return decoded;
        }
        catch (error) {
            console.error('Failed to decode token:', error);
            return null;
        }
    }
    /**
     * Verify and decode a JWT token
     */
    static verifyToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, config_1.config.JWT_SECRET);
            return decoded;
        }
        catch (error) {
            console.error('Failed to verify token:', error);
            return null;
        }
    }
    /**
     * Check if a role has permission for specific actions
     */
    static checkRolePermission(userRole, requiredRoles) {
        return requiredRoles.includes(userRole);
    }
    /**
     * Get role hierarchy (higher roles have more permissions)
     */
    static getRoleHierarchy() {
        return {
            [types_1.UserRole.SUPER_ADMIN]: 4,
            [types_1.UserRole.ADMIN]: 3,
            [types_1.UserRole.SALES]: 2,
            [types_1.UserRole.CASHIER]: 1
        };
    }
    /**
     * Debug a failing request - logs detailed information
     */
    static debugFailingRequest(token, requiredRoles, endpoint) {
        console.log('\n=== RBAC Debug Information ===');
        console.log(`Endpoint: ${endpoint}`);
        console.log(`Required Roles: ${requiredRoles.join(', ')}`);
        if (!token) {
            console.log('❌ No token provided');
            return;
        }
        // Decode token (without verification for debug purposes)
        const decoded = this.decodeToken(token);
        if (!decoded) {
            console.log('❌ Failed to decode token');
            return;
        }
        console.log(`User ID: ${decoded.userId}`);
        console.log(`User Email: ${decoded.email}`);
        console.log(`User Role: ${decoded.role}`);
        if (decoded.exp) {
            const expDate = new Date(decoded.exp * 1000);
            const isExpired = Date.now() > decoded.exp * 1000;
            console.log(`Token Expiry: ${expDate.toISOString()} ${isExpired ? '(EXPIRED)' : '(VALID)'}`);
        }
        // Check role permissions
        const hasPermission = this.checkRolePermission(decoded.role, requiredRoles);
        console.log(`Permission Check: ${hasPermission ? '✅ ALLOWED' : '❌ DENIED'}`);
        if (!hasPermission) {
            const hierarchy = this.getRoleHierarchy();
            const userLevel = hierarchy[decoded.role] || 0;
            const requiredLevels = requiredRoles.map(role => hierarchy[role] || 0);
            const minRequiredLevel = Math.min(...requiredLevels);
            console.log(`User Role Level: ${userLevel}`);
            console.log(`Minimum Required Level: ${minRequiredLevel}`);
            console.log('Suggested Solutions:');
            console.log('1. Update user role in database');
            console.log('2. Update middleware to include user\'s role');
            console.log('3. Check if role is correctly included in JWT generation');
        }
        console.log('===============================\n');
    }
    /**
     * Generate a test token for debugging
     */
    static generateTestToken(userId, email, role) {
        return jsonwebtoken_1.default.sign({ userId, email, role }, config_1.config.JWT_SECRET, { expiresIn: '1h' });
    }
}
exports.JWTDebugger = JWTDebugger;
//# sourceMappingURL=jwtDebugger.js.map