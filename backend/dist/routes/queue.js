"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const queue_1 = require("../services/queue");
const displayService_1 = require("../services/displayService");
const auth_1 = require("../middleware/auth");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
// Helper functions
const calculatePriorityScore = (priorityFlags) => {
    let score = 0;
    if (priorityFlags.senior_citizen)
        score += 1000;
    if (priorityFlags.pwd)
        score += 900;
    if (priorityFlags.pregnant)
        score += 800;
    return score;
};
const calculateEstimatedWaitTime = (position) => {
    // Estimated wait time based on position and average service time
    const averageServiceTime = 15; // minutes
    return (position - 1) * averageServiceTime;
};
// Debug route to check customers
router.get('/debug', auth_1.authenticateToken, async (req, res) => {
    try {
        const allCustomers = await database_1.pool.query('SELECT id, name, queue_status, created_at FROM customers ORDER BY created_at DESC LIMIT 10');
        const waitingCustomers = await database_1.pool.query('SELECT id, name, queue_status, created_at FROM customers WHERE queue_status = $1', ['waiting']);
        res.json({
            allCustomers: allCustomers.rows,
            waitingCustomers: waitingCustomers.rows,
            user: req.user
        });
    }
    catch (error) {
        console.error('Error getting debug info:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get current queue with optional status filtering
router.get('/', auth_1.authenticateToken, (0, auth_1.logActivity)('get_queue'), async (req, res) => {
    try {
        console.log('Queue route accessed by user:', req.user?.full_name, 'role:', req.user?.role);
        const statusFilter = req.query.status;
        const queue = await queue_1.QueueService.getQueue(statusFilter);
        console.log('Queue data fetched:', queue.length, 'items', statusFilter ? `with status filter: ${statusFilter}` : '');
        res.json(queue);
    }
    catch (error) {
        console.error('Error getting queue:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Call next customer
router.post('/call-next', auth_1.authenticateToken, auth_1.requireCashierOrAdmin, (0, auth_1.logActivity)('call_next_customer'), async (req, res) => {
    try {
        const { counterId } = req.body;
        if (!counterId) {
            res.status(400).json({ error: 'Counter ID is required' });
            return;
        }
        const customer = await queue_1.QueueService.callNext(counterId);
        if (!customer) {
            res.status(404).json({ error: 'No customers in queue' });
            return;
        }
        res.json(customer);
    }
    catch (error) {
        console.error('Error calling next customer:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Call specific customer
router.post('/call-customer', auth_1.authenticateToken, auth_1.requireCashierOrAdmin, (0, auth_1.logActivity)('call_specific_customer'), async (req, res) => {
    try {
        const { customerId, counterId } = req.body;
        if (!customerId || !counterId) {
            res.status(400).json({ error: 'Customer ID and Counter ID are required' });
            return;
        }
        const customer = await queue_1.QueueService.callSpecificCustomer(customerId, counterId);
        if (!customer) {
            res.status(404).json({ error: 'Customer not found or already served' });
            return;
        }
        res.json(customer);
    }
    catch (error) {
        console.error('Error calling specific customer:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Complete service
router.post('/complete', auth_1.authenticateToken, auth_1.requireCashierOrAdmin, (0, auth_1.logActivity)('complete_service'), async (req, res) => {
    try {
        const { customerId, counterId } = req.body;
        if (!customerId || !counterId) {
            res.status(400).json({ error: 'Customer ID and Counter ID are required' });
            return;
        }
        const customer = await queue_1.QueueService.completeService(customerId, counterId);
        res.json(customer);
    }
    catch (error) {
        console.error('Error completing service:', error);
        if (error instanceof Error && error.message === 'Customer not found') {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});
// Cancel service
router.post('/cancel', auth_1.authenticateToken, auth_1.requireCashierOrAdmin, (0, auth_1.logActivity)('cancel_service'), async (req, res) => {
    try {
        const { customerId, reason } = req.body;
        if (!customerId) {
            res.status(400).json({ error: 'Customer ID is required' });
            return;
        }
        const customer = await queue_1.QueueService.cancelService(customerId, reason);
        res.json(customer);
    }
    catch (error) {
        console.error('Error cancelling service:', error);
        if (error instanceof Error && error.message === 'Customer not found') {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});
// Get customer position
router.get('/position/:customerId', auth_1.authenticateToken, (0, auth_1.logActivity)('get_queue_position'), async (req, res) => {
    try {
        const { customerId } = req.params;
        const position = await queue_1.QueueService.getPosition(parseInt(customerId, 10));
        res.json({ position });
    }
    catch (error) {
        console.error('Error getting queue position:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get queue statistics
router.get('/stats', auth_1.authenticateToken, (0, auth_1.logActivity)('get_queue_statistics'), async (req, res) => {
    try {
        const stats = await queue_1.QueueService.getQueueStatistics();
        res.json(stats);
    }
    catch (error) {
        console.error('Error getting queue statistics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Counter management routes
router.get('/counters', auth_1.authenticateToken, (0, auth_1.logActivity)('list_counters'), async (req, res) => {
    try {
        const counters = await queue_1.CounterService.list();
        res.json(counters);
    }
    catch (error) {
        console.error('Error listing counters:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all customers for queue management (waiting + serving + completed)
router.get('/all-statuses', auth_1.authenticateToken, (0, auth_1.logActivity)('get_all_statuses'), async (req, res) => {
    try {
        const query = `
      SELECT 
        c.*,
        u.full_name as sales_agent_name,
        ROW_NUMBER() OVER (ORDER BY 
          CASE 
            WHEN c.queue_status = 'serving' THEN 0
            WHEN c.queue_status = 'waiting' THEN 1
            WHEN c.queue_status = 'completed' THEN 2
            ELSE 3
          END,
          CASE 
            WHEN c.manual_position IS NOT NULL THEN c.manual_position
            ELSE
              CASE 
                WHEN c.priority_flags::json->>'senior_citizen' = 'true' THEN 1000
                WHEN c.priority_flags::json->>'pwd' = 'true' THEN 900
                WHEN c.priority_flags::json->>'pregnant' = 'true' THEN 800
                ELSE 0
              END * 100000 + EXTRACT(EPOCH FROM c.created_at)
          END ASC
        ) as position
      FROM customers c
      LEFT JOIN users u ON c.sales_agent_id = u.id
      WHERE c.queue_status IN ('waiting', 'serving', 'processing', 'completed')
      ORDER BY 
        CASE 
          WHEN c.queue_status = 'serving' THEN 0
          WHEN c.queue_status = 'processing' THEN 0.5
          WHEN c.queue_status = 'waiting' THEN 1
          WHEN c.queue_status = 'completed' THEN 2
          ELSE 3
        END,
        CASE 
          WHEN c.manual_position IS NOT NULL THEN c.manual_position
          ELSE
            CASE 
              WHEN c.priority_flags::json->>'senior_citizen' = 'true' THEN 1000
              WHEN c.priority_flags::json->>'pwd' = 'true' THEN 900
              WHEN c.priority_flags::json->>'pregnant' = 'true' THEN 800
              ELSE 0
            END * 100000 + EXTRACT(EPOCH FROM c.created_at)
        END ASC
    `;
        const result = await database_1.pool.query(query);
        const customers = result.rows.map((row) => ({
            customer_id: row.id,
            customer: {
                ...row,
                prescription: typeof row.prescription === 'string' ? JSON.parse(row.prescription) : row.prescription,
                payment_info: typeof row.payment_info === 'string' ? JSON.parse(row.payment_info) : row.payment_info,
                priority_flags: typeof row.priority_flags === 'string' ? JSON.parse(row.priority_flags) : row.priority_flags,
            },
            position: row.position,
            priority_score: calculatePriorityScore(typeof row.priority_flags === 'string' ? JSON.parse(row.priority_flags) : row.priority_flags),
            estimated_wait_time: calculateEstimatedWaitTime(row.position)
        }));
        res.json(customers);
    }
    catch (error) {
        console.error('Error getting all queue statuses:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all customers for display monitor (waiting + serving) - excludes processing records
router.get('/display-all', auth_1.authenticateToken, (0, auth_1.logActivity)('get_display_all'), async (req, res) => {
    try {
        // Use DisplayService.getDisplayQueue() method that filters out processing records
        const customers = await displayService_1.DisplayService.getDisplayQueue();
        // Internal calculation - not exposed in response
        // Calculate service time from completed customers (served - called)
        const servedCustomersQuery = `
      WITH service_times AS (
        SELECT 
          called.customer_id,
          EXTRACT(EPOCH FROM (served.created_at - called.created_at)) / 60 AS service_duration_minutes
        FROM queue_events called
        INNER JOIN queue_events served 
          ON called.customer_id = served.customer_id 
          AND called.event_type = 'called' 
          AND served.event_type = 'served'
        WHERE DATE(called.created_at) = CURRENT_DATE
      )
      SELECT AVG(service_duration_minutes) as avg_service_time
      FROM service_times
    `;
        try {
            const servedResults = await database_1.pool.query(servedCustomersQuery);
            const averageServiceTime = servedResults.rows[0]?.avg_service_time || 0;
            console.log('Internal Average Service Time (minutes):', averageServiceTime);
        }
        catch (error) {
            console.log('Could not calculate internal service time:', error instanceof Error ? error.message : 'Unknown error');
        }
        res.json(customers);
    }
    catch (error) {
        console.error('Error getting display all data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Explanation: The average service time is calculated internally and logged, but not sent in the response.
// Public counters endpoint for Display Monitor (no admin role required)
router.get('/counters/display', auth_1.authenticateToken, (0, auth_1.logActivity)('list_display_counters'), async (req, res) => {
    try {
        const query = `
      SELECT 
        c.id,
        c.name,
        c.is_active,
        c.display_order,
        cu.id as current_customer_id,
        cu.name as current_customer_name,
        cu.token_number as current_customer_token,
        cu.priority_flags as current_customer_priority_flags
      FROM counters c
      LEFT JOIN customers cu ON c.current_customer_id = cu.id AND cu.queue_status = 'serving'
      WHERE c.is_active = true
      ORDER BY c.display_order ASC, c.name ASC
    `;
        const result = await database_1.pool.query(query);
        const counters = result.rows.map((row) => ({
            id: row.id,
            name: row.name,
            is_active: row.is_active,
            current_customer: row.current_customer_id ? {
                id: row.current_customer_id,
                name: row.current_customer_name,
                token_number: row.current_customer_token,
                queue_status: 'serving',
                priority_flags: typeof row.current_customer_priority_flags === 'string'
                    ? JSON.parse(row.current_customer_priority_flags)
                    : row.current_customer_priority_flags || { senior_citizen: false, pregnant: false, pwd: false }
            } : null
        }));
        res.json(counters);
    }
    catch (error) {
        console.error('Error listing display counters:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/counters', auth_1.authenticateToken, auth_1.requireCashierOrAdmin, (0, auth_1.logActivity)('create_counter'), async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            res.status(400).json({ error: 'Counter name is required' });
            return;
        }
        const counter = await queue_1.CounterService.create(name);
        res.status(201).json(counter);
    }
    catch (error) {
        console.error('Error creating counter:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/counters/:id', auth_1.authenticateToken, auth_1.requireCashierOrAdmin, (0, auth_1.logActivity)('update_counter'), async (req, res) => {
    try {
        const { id } = req.params;
        const counterId = Number(id);
        if (!Number.isInteger(counterId)) {
            res.status(400).json({ error: 'Invalid counter id' });
            return;
        }
        const updates = req.body;
        const counter = await queue_1.CounterService.update(counterId, updates);
        res.json(counter);
    }
    catch (error) {
        console.error('Error updating counter:', error);
        if (error instanceof Error && error.message === 'Counter not found') {
            res.status(404).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});
// Manual queue reordering
router.put('/reorder', auth_1.authenticateToken, auth_1.requireCashierOrAdmin, (0, auth_1.logActivity)('reorder_queue'), async (req, res) => {
    try {
        const { customerIds } = req.body;
        if (!customerIds || !Array.isArray(customerIds)) {
            res.status(400).json({ error: 'Customer IDs array is required' });
            return;
        }
        const updatedQueue = await queue_1.QueueService.reorderQueue(customerIds);
        res.json(updatedQueue);
    }
    catch (error) {
        console.error('Error reordering queue:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Change customer status with validation
router.post('/change-status', auth_1.authenticateToken, auth_1.requireCashierOrAdmin, (0, auth_1.logActivity)('change_queue_status'), async (req, res) => {
    try {
        const { customerId, status } = req.body;
        if (!customerId || !status) {
            res.status(400).json({ error: 'Customer ID and status are required' });
            return;
        }
        // Validate status is one of the valid enum values
        const validStatuses = ['waiting', 'serving', 'processing', 'completed', 'cancelled'];
        if (!validStatuses.includes(status.toLowerCase())) {
            res.status(400).json({
                error: 'Invalid status. Valid statuses are: waiting, serving, processing, completed, cancelled'
            });
            return;
        }
        const customer = await queue_1.QueueService.changeStatus(parseInt(customerId, 10), status.toLowerCase(), req.user?.id, req.user?.role);
        res.json(customer);
    }
    catch (error) {
        console.error('Error changing queue status:', error);
        if (error instanceof Error) {
            if (error.message.includes('Invalid status transition')) {
                res.status(400).json({ error: error.message });
            }
            else if (error.message === 'Customer not found') {
                res.status(404).json({ error: error.message });
            }
            else {
                res.status(500).json({ error: 'Internal server error' });
            }
        }
        else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});
/**
 * PATCH /api/queue/:id/status - Update queue status to 'processing'
 *
 * API v1.1 - Accepts { status: 'processing' } for marking customers as processing.
 *
 * Note: Clients should ignore unknown future statuses for forward compatibility.
 * This endpoint specifically supports the 'processing' status as part of the enhanced
 * queue workflow for customers whose orders are being prepared.
 */
router.patch('/:id/status', auth_1.authenticateToken, auth_1.requireCashierOrAdmin, (0, auth_1.logActivity)('patch_queue_status'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status) {
            res.status(400).json({ error: 'Status is required' });
            return;
        }
        // For PATCH endpoint, we primarily support 'processing' status
        // but allow other valid statuses for flexibility
        const validStatuses = ['waiting', 'serving', 'processing', 'completed', 'cancelled'];
        if (!validStatuses.includes(status.toLowerCase())) {
            res.status(400).json({
                error: 'Invalid status. Valid statuses are: waiting, serving, processing, completed, cancelled',
                note: 'Clients should ignore unknown future statuses for forward compatibility'
            });
            return;
        }
        const customerId = parseInt(id, 10);
        if (isNaN(customerId)) {
            res.status(400).json({ error: 'Invalid customer ID' });
            return;
        }
        const customer = await queue_1.QueueService.changeStatus(customerId, status.toLowerCase(), req.user?.id, req.user?.role);
        res.json(customer);
    }
    catch (error) {
        console.error('Error updating queue status via PATCH:', error);
        if (error instanceof Error) {
            if (error.message.includes('Invalid status transition')) {
                res.status(400).json({ error: error.message });
            }
            else if (error.message === 'Customer not found') {
                res.status(404).json({ error: error.message });
            }
            else {
                res.status(500).json({ error: 'Internal server error' });
            }
        }
        else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});
// Reset entire queue (Admin only)
router.post('/reset', auth_1.authenticateToken, (0, auth_1.logActivity)('reset_queue'), async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user || req.user.role !== 'admin') {
            res.status(403).json({ error: 'Only administrators can reset the queue' });
            return;
        }
        const { reason } = req.body;
        const result = await queue_1.QueueService.resetQueue(req.user.id, reason);
        res.json({
            success: true,
            ...result
        });
    }
    catch (error) {
        console.error('Error resetting queue:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=queue.js.map