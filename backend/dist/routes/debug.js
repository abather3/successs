"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const types_1 = require("../types");
const jwtDebugger_1 = require("../utils/jwtDebugger");
const config_1 = require("../config/config");
const router = (0, express_1.Router)();
/**
 * Debug endpoint to analyze token and role information
 * Only accessible to admin users
 */
router.get('/token-info', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            return res.status(400).json({ error: 'No token provided' });
        }
        const decoded = jwtDebugger_1.JWTDebugger.decodeToken(token);
        const verified = jwtDebugger_1.JWTDebugger.verifyToken(token);
        const hierarchy = jwtDebugger_1.JWTDebugger.getRoleHierarchy();
        const response = {
            timestamp: new Date().toISOString(),
            token_info: {
                decoded: decoded,
                verified: !!verified,
                validation_errors: verified ? null : 'Token verification failed'
            },
            user_info: {
                current_user: req.user,
                role_hierarchy: hierarchy,
                user_role_level: req.user ? hierarchy[req.user.role] : 0
            },
            rbac_info: {
                available_roles: Object.values(types_1.UserRole),
                role_hierarchy: hierarchy,
                middleware_functions: [
                    'requireAdmin: ADMIN, SUPER_ADMIN',
                    'requireSalesOrAdmin: SALES, ADMIN, SUPER_ADMIN',
                    'requireCashierOrAdmin: CASHIER, ADMIN, SUPER_ADMIN',
                    'requireSuperAdmin: SUPER_ADMIN only'
                ]
            },
            config_info: {
                jwt_expires_in: config_1.config.JWT_EXPIRES_IN,
                refresh_expires_in: config_1.config.JWT_REFRESH_EXPIRES_IN,
                node_env: config_1.config.NODE_ENV
            }
        };
        res.json(response);
    }
    catch (error) {
        console.error('Debug endpoint error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Test role permissions endpoint
 */
router.post('/test-permissions', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        const { test_role, required_roles } = req.body;
        if (!test_role || !required_roles || !Array.isArray(required_roles)) {
            return res.status(400).json({
                error: 'Missing required fields: test_role, required_roles (array)'
            });
        }
        const hasPermission = jwtDebugger_1.JWTDebugger.checkRolePermission(test_role, required_roles);
        const hierarchy = jwtDebugger_1.JWTDebugger.getRoleHierarchy();
        res.json({
            test_role,
            required_roles,
            has_permission: hasPermission,
            role_level: hierarchy[test_role] || 0,
            required_levels: required_roles.map((role) => ({
                role,
                level: hierarchy[role] || 0
            })),
            recommendation: hasPermission
                ? 'Access would be granted'
                : `Access denied. User needs one of these roles: ${required_roles.join(', ')}`
        });
    }
    catch (error) {
        console.error('Permission test error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * Generate test token endpoint (for development only)
 */
router.post('/generate-test-token', auth_1.requireAdmin, async (req, res) => {
    try {
        if (config_1.config.NODE_ENV === 'production') {
            return res.status(403).json({ error: 'Test token generation not available in production' });
        }
        const { user_id, email, role } = req.body;
        if (!user_id || !email || !role) {
            return res.status(400).json({
                error: 'Missing required fields: user_id, email, role'
            });
        }
        if (!Object.values(types_1.UserRole).includes(role)) {
            return res.status(400).json({
                error: 'Invalid role. Valid roles: ' + Object.values(types_1.UserRole).join(', ')
            });
        }
        const testToken = jwtDebugger_1.JWTDebugger.generateTestToken(user_id, email, role);
        const decoded = jwtDebugger_1.JWTDebugger.decodeToken(testToken);
        res.json({
            message: 'Test token generated successfully',
            token: testToken,
            decoded_payload: decoded,
            warning: 'This is a test token for development purposes only'
        });
    }
    catch (error) {
        console.error('Test token generation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=debug.js.map