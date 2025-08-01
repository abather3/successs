"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const activity_1 = require("../services/activity");
const notification_1 = require("../services/notification");
const auth_1 = require("../middleware/auth");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
// Get activity logs
router.get('/activity-logs', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('view_activity_logs'), async (req, res) => {
    try {
        const { action, startDate, endDate, page = '1', limit = '50' } = req.query;
        const filters = {
            action: action,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined
        };
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const offset = (pageNum - 1) * limitNum;
        const logs = await activity_1.ActivityService.getAll(limitNum, offset, filters);
        res.json({
            logs,
            pagination: {
                current_page: pageNum,
                per_page: limitNum
            }
        });
    }
    catch (error) {
        console.error('Error getting activity logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Clean old activity logs
router.delete('/activity-logs/cleanup', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('cleanup_activity_logs'), async (req, res) => {
    try {
        const { retentionDays = 90 } = req.body;
        const deletedCount = await activity_1.ActivityService.deleteOldLogs(retentionDays);
        res.json({
            message: `Deleted ${deletedCount} old activity logs`,
            deletedCount
        });
    }
    catch (error) {
        console.error('Error cleaning up activity logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// SMS Templates management
router.get('/sms-templates', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('list_sms_templates'), async (req, res) => {
    try {
        const templates = await notification_1.NotificationService.listSMSTemplates();
        res.json(templates);
    }
    catch (error) {
        console.error('Error listing SMS templates:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/sms-templates', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('create_sms_template'), async (req, res) => {
    try {
        const { name, template, variables } = req.body;
        if (!name || !template || !variables) {
            res.status(400).json({ error: 'Name, template, and variables are required' });
            return;
        }
        const smsTemplate = await notification_1.NotificationService.createSMSTemplate({
            name,
            template,
            variables
        });
        res.status(201).json(smsTemplate);
    }
    catch (error) {
        console.error('Error creating SMS template:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/sms-templates/:id', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('update_sms_template'), async (req, res) => {
    try {
        const { id } = req.params;
        const templateId = Number(id);
        if (!Number.isInteger(templateId)) {
            res.status(400).json({ error: 'Invalid template id' });
            return;
        }
        const updates = req.body;
        const template = await notification_1.NotificationService.updateSMSTemplate(templateId, updates);
        res.json(template);
    }
    catch (error) {
        console.error('Error updating SMS template:', error);
        if (error instanceof Error && error.message === 'SMS template not found') {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});
// Notification logs
router.get('/notification-logs', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('view_notification_logs'), async (req, res) => {
    try {
        const { customerId, status, startDate, endDate, page = '1', limit = '50' } = req.query;
        const filters = {
            customerId: customerId ? parseInt(customerId, 10) : undefined,
            status: status,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined
        };
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const offset = (pageNum - 1) * limitNum;
        const result = await notification_1.NotificationService.getNotificationLogs(filters, limitNum, offset);
        res.json({
            logs: result.logs,
            pagination: {
                current_page: pageNum,
                per_page: limitNum,
                total: result.total,
                total_pages: Math.ceil(result.total / limitNum)
            }
        });
    }
    catch (error) {
        console.error('Error getting notification logs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Initialize default SMS templates
router.post('/initialize-templates', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('initialize_sms_templates'), async (req, res) => {
    try {
        await notification_1.NotificationService.initializeDefaultTemplates();
        res.json({ message: 'Default SMS templates initialized successfully' });
    }
    catch (error) {
        console.error('Error initializing SMS templates:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// System health check
router.get('/health', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('system_health_check'), async (req, res) => {
    try {
        // Basic health check - could be expanded with more checks
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.version
        };
        res.json(health);
    }
    catch (error) {
        console.error('Error in health check:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Dropdown Management - Grade Types
router.get('/dropdowns/grade-types', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('list_grade_types'), async (req, res) => {
    try {
        const query = 'SELECT * FROM grade_types ORDER BY name ASC';
        const result = await database_1.pool.query(query);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error listing grade types:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/grade-types', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('list_grade_types'), async (req, res) => {
    try {
        const query = 'SELECT * FROM grade_types ORDER BY name ASC';
        const result = await database_1.pool.query(query);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error listing grade types:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/grade-types', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('create_grade_type'), async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            res.status(400).json({ error: 'Name is required' });
            return;
        }
        const query = `
      INSERT INTO grade_types (name, description)
      VALUES ($1, $2)
      RETURNING *
    `;
        const result = await database_1.pool.query(query, [name, description || null]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Error creating grade type:', error);
        if (error.code === '23505') { // Unique violation
            res.status(409).json({ error: 'Grade type with this name already exists' });
        }
        else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});
router.put('/grade-types/:id', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('update_grade_type'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        if (!name) {
            res.status(400).json({ error: 'Name is required' });
            return;
        }
        const query = `
      UPDATE grade_types 
      SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;
        const gradeTypeId = Number(id);
        if (!Number.isInteger(gradeTypeId)) {
            res.status(400).json({ error: 'Invalid grade type id' });
            return;
        }
        const result = await database_1.pool.query(query, [name, description || null, gradeTypeId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Grade type not found' });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Error updating grade type:', error);
        if (error.code === '23505') { // Unique violation
            res.status(409).json({ error: 'Grade type with this name already exists' });
        }
        else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});
router.delete('/grade-types/:id', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('delete_grade_type'), async (req, res) => {
    try {
        const { id } = req.params;
        const gradeTypeId = Number(id);
        if (!Number.isInteger(gradeTypeId)) {
            res.status(400).json({ error: 'Invalid grade type id' });
            return;
        }
        const query = 'DELETE FROM grade_types WHERE id = $1';
        const result = await database_1.pool.query(query, [gradeTypeId]);
        if (result.rowCount === 0) {
            res.status(404).json({ error: 'Grade type not found' });
            return;
        }
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting grade type:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Dropdown Management - Lens Types
router.get('/dropdowns/lens-types', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('list_lens_types'), async (req, res) => {
    try {
        const query = 'SELECT * FROM lens_types ORDER BY name ASC';
        const result = await database_1.pool.query(query);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error listing lens types:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/lens-types', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('list_lens_types'), async (req, res) => {
    try {
        const query = 'SELECT * FROM lens_types ORDER BY name ASC';
        const result = await database_1.pool.query(query);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error listing lens types:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/lens-types', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('create_lens_type'), async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            res.status(400).json({ error: 'Name is required' });
            return;
        }
        const query = `
      INSERT INTO lens_types (name, description)
      VALUES ($1, $2)
      RETURNING *
    `;
        const result = await database_1.pool.query(query, [name, description || null]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Error creating lens type:', error);
        if (error.code === '23505') { // Unique violation
            res.status(409).json({ error: 'Lens type with this name already exists' });
        }
        else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});
router.put('/lens-types/:id', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('update_lens_type'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        if (!name) {
            res.status(400).json({ error: 'Name is required' });
            return;
        }
        const query = `
      UPDATE lens_types 
      SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;
        const lensTypeId = Number(id);
        if (!Number.isInteger(lensTypeId)) {
            res.status(400).json({ error: 'Invalid lens type id' });
            return;
        }
        const result = await database_1.pool.query(query, [name, description || null, lensTypeId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Lens type not found' });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Error updating lens type:', error);
        if (error.code === '23505') { // Unique violation
            res.status(409).json({ error: 'Lens type with this name already exists' });
        }
        else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});
router.delete('/lens-types/:id', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('delete_lens_type'), async (req, res) => {
    try {
        const { id } = req.params;
        const lensTypeId = Number(id);
        if (!Number.isInteger(lensTypeId)) {
            res.status(400).json({ error: 'Invalid lens type id' });
            return;
        }
        const query = 'DELETE FROM lens_types WHERE id = $1';
        const result = await database_1.pool.query(query, [lensTypeId]);
        if (result.rowCount === 0) {
            res.status(404).json({ error: 'Lens type not found' });
            return;
        }
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting lens type:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Counter Management
router.get('/counters', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('list_counters'), async (req, res) => {
    console.log('Getting counters - user:', req.user ? req.user.id : 'none');
    try {
        const query = 'SELECT * FROM counters ORDER BY display_order ASC, name ASC';
        const result = await database_1.pool.query(query);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error listing counters:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/counters', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('create_counter'), async (req, res) => {
    try {
        const { name, displayOrder, isActive = true } = req.body;
        console.log('Creating counter with data:', { name, displayOrder, isActive });
        if (!name) {
            res.status(400).json({ error: 'Name is required' });
            return;
        }
        const query = `
      INSERT INTO counters (name, display_order, is_active)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
        console.log('Executing query:', query);
        console.log('With parameters:', [name, displayOrder || 0, isActive]);
        const result = await database_1.pool.query(query, [name, displayOrder || 0, isActive]);
        console.log('Query result:', result.rows[0]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Error creating counter:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            detail: error.detail
        });
        if (error.code === '23505') { // Unique violation
            res.status(409).json({ error: 'Counter with this name already exists' });
        }
        else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});
router.put('/counters/:id', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('update_counter'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, displayOrder, isActive } = req.body;
        if (!name) {
            res.status(400).json({ error: 'Name is required' });
            return;
        }
        const query = `
      UPDATE counters 
      SET name = $1, display_order = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;
        const counterId = Number(id);
        if (!Number.isInteger(counterId)) {
            res.status(400).json({ error: 'Invalid counter id' });
            return;
        }
        const result = await database_1.pool.query(query, [name, displayOrder || 0, isActive, counterId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Counter not found' });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Error updating counter:', error);
        if (error.code === '23505') { // Unique violation
            res.status(409).json({ error: 'Counter with this name already exists' });
        }
        else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});
router.put('/counters/:id/toggle', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('toggle_counter'), async (req, res) => {
    try {
        const { id } = req.params;
        const counterId = Number(id);
        if (!Number.isInteger(counterId)) {
            res.status(400).json({ error: 'Invalid counter id' });
            return;
        }
        const query = `
      UPDATE counters 
      SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
        const result = await database_1.pool.query(query, [counterId]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Counter not found' });
            return;
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Error toggling counter:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/counters/:id', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('delete_counter'), async (req, res) => {
    try {
        const { id } = req.params;
        const counterId = Number(id);
        if (!Number.isInteger(counterId)) {
            res.status(400).json({ error: 'Invalid counter id' });
            return;
        }
        const query = 'DELETE FROM counters WHERE id = $1';
        const result = await database_1.pool.query(query, [counterId]);
        if (result.rowCount === 0) {
            res.status(404).json({ error: 'Counter not found' });
            return;
        }
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting counter:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map