"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_1 = require("../services/user");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Create new user
router.post('/', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('create_user'), async (req, res) => {
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
        const newUser = await user_1.UserService.create({
            fullName,
            email,
            role: role
        });
        res.status(201).json(newUser);
    }
    catch (error) {
        console.error('Error creating user:', error);
        if (error instanceof Error && error.message.includes('already exists')) {
            res.status(409).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});
// List all users
router.get('/', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('list_users'), async (req, res) => {
    try {
        const { role, status, excludeRole } = req.query;
        const filters = {
            role: role,
            status: status,
            excludeRole: excludeRole
        };
        const users = await user_1.UserService.list(filters);
        res.json(users);
    }
    catch (error) {
        console.error('Error listing users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get user by ID
router.get('/:id', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('get_user'), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = Number(id);
        if (!Number.isInteger(userId)) {
            res.status(400).json({ error: 'Invalid user id' });
            return;
        }
        const user = await user_1.UserService.findById(userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json(user);
    }
    catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update user
router.put('/:id', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('update_user'), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = Number(id);
        if (!Number.isInteger(userId)) {
            res.status(400).json({ error: 'Invalid user id' });
            return;
        }
        const updates = req.body;
        const updatedUser = await user_1.UserService.update(userId, updates);
        res.json(updatedUser);
    }
    catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Check user dependencies before deletion
router.get('/:id/dependencies', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('check_user_dependencies'), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = Number(id);
        if (!Number.isInteger(userId)) {
            res.status(400).json({ error: 'Invalid user id' });
            return;
        }
        const dependencies = await user_1.UserService.getUserDependencies(userId);
        res.json(dependencies);
    }
    catch (error) {
        console.error('Error checking user dependencies:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Delete user
router.delete('/:id', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('delete_user'), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = Number(id);
        if (!Number.isInteger(userId)) {
            res.status(400).json({ error: 'Invalid user id' });
            return;
        }
        await user_1.UserService.delete(userId);
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting user:', error);
        if (error instanceof Error && error.message.includes('Cannot delete user')) {
            res.status(400).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});
// Trigger password reset for user
router.post('/:id/reset-password', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('admin_reset_password'), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = Number(id);
        if (!Number.isInteger(userId)) {
            res.status(400).json({ error: 'Invalid user id' });
            return;
        }
        const result = await user_1.UserService.triggerPasswordReset(userId);
        res.json({
            message: 'Password reset email sent successfully',
            resetToken: result.resetToken
        });
    }
    catch (error) {
        console.error('Error triggering password reset:', error);
        if (error instanceof Error && error.message === 'User not found') {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map