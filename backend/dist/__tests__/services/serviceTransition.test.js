"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../../config/database");
const queue_1 = require("../../services/queue");
const types_1 = require("../../types");
describe('Service Transition Rule Tests', () => {
    let testCustomerId;
    let testUserId;
    beforeAll(async () => {
        // Create test user
        const userResult = await database_1.pool.query(`
      INSERT INTO users (email, password, full_name, role, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, ['transition-test@example.com', 'hashedpassword', 'Transition Test User', 'admin', 'active']);
        testUserId = userResult.rows[0].id;
        // Create test customer
        const customerResult = await database_1.pool.query(`
      INSERT INTO customers (name, contact_number, email, age, address, or_number, 
                            distribution_info, sales_agent_id, prescription, grade_type, 
                            lens_type, estimated_time, payment_info, priority_flags, 
                            queue_status, token_number)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id
    `, [
            'Transition Test Customer', '1234567890', 'transition-test-customer@example.com', 25, 'Test Address', 'TRANS-TEST-001',
            'pickup', testUserId, '{}', 'single', 'regular', '{"days": 1, "hours": 0, "minutes": 0}',
            '{"mode": "cash", "amount": 1000}', '{"senior_citizen": false, "pregnant": false, "pwd": false}',
            'waiting', 1
        ]);
        testCustomerId = customerResult.rows[0].id;
    });
    afterAll(async () => {
        // Clean up test data
        await database_1.pool.query('DELETE FROM customers WHERE id = $1', [testCustomerId]);
        await database_1.pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    });
    describe('Valid Status Transitions', () => {
        it('should allow waiting → serving transition', async () => {
            // Reset customer to waiting status
            await database_1.pool.query('UPDATE customers SET queue_status = $1 WHERE id = $2', [types_1.QueueStatus.WAITING, testCustomerId]);
            const customer = await queue_1.QueueService.changeStatus(testCustomerId, types_1.QueueStatus.SERVING, testUserId, types_1.UserRole.ADMIN);
            expect(customer.queue_status).toBe(types_1.QueueStatus.SERVING);
        });
        it('should allow serving → processing transition', async () => {
            // Set customer to serving status first
            await database_1.pool.query('UPDATE customers SET queue_status = $1 WHERE id = $2', [types_1.QueueStatus.SERVING, testCustomerId]);
            const customer = await queue_1.QueueService.changeStatus(testCustomerId, types_1.QueueStatus.PROCESSING, testUserId, types_1.UserRole.ADMIN);
            expect(customer.queue_status).toBe(types_1.QueueStatus.PROCESSING);
        });
        it('should allow processing → completed transition', async () => {
            // Set customer to processing status first
            await database_1.pool.query('UPDATE customers SET queue_status = $1 WHERE id = $2', [types_1.QueueStatus.PROCESSING, testCustomerId]);
            const customer = await queue_1.QueueService.changeStatus(testCustomerId, types_1.QueueStatus.COMPLETED, testUserId, types_1.UserRole.ADMIN);
            expect(customer.queue_status).toBe(types_1.QueueStatus.COMPLETED);
        });
    });
    describe('Invalid Status Transitions', () => {
        it('should reject completed → processing transition', async () => {
            // Set customer to completed status first
            await database_1.pool.query('UPDATE customers SET queue_status = $1 WHERE id = $2', [types_1.QueueStatus.COMPLETED, testCustomerId]);
            await expect(queue_1.QueueService.changeStatus(testCustomerId, types_1.QueueStatus.PROCESSING, testUserId, types_1.UserRole.ADMIN)).rejects.toThrow('Invalid status transition');
        });
        it('should reject cancelled → waiting transition', async () => {
            // Set customer to cancelled status first
            await database_1.pool.query('UPDATE customers SET queue_status = $1 WHERE id = $2', [types_1.QueueStatus.CANCELLED, testCustomerId]);
            await expect(queue_1.QueueService.changeStatus(testCustomerId, types_1.QueueStatus.WAITING, testUserId, types_1.UserRole.ADMIN)).rejects.toThrow('Invalid status transition');
        });
    });
    describe('RBAC Transition Permissions', () => {
        it('should allow cashier to perform serving → processing transition', async () => {
            // Set customer to serving status first
            await database_1.pool.query('UPDATE customers SET queue_status = $1 WHERE id = $2', [types_1.QueueStatus.SERVING, testCustomerId]);
            const customer = await queue_1.QueueService.changeStatus(testCustomerId, types_1.QueueStatus.PROCESSING, testUserId, types_1.UserRole.CASHIER);
            expect(customer.queue_status).toBe(types_1.QueueStatus.PROCESSING);
        });
        it('should deny sales role from performing any transition', async () => {
            // Set customer to waiting status first
            await database_1.pool.query('UPDATE customers SET queue_status = $1 WHERE id = $2', [types_1.QueueStatus.WAITING, testCustomerId]);
            await expect(queue_1.QueueService.changeStatus(testCustomerId, types_1.QueueStatus.SERVING, testUserId, types_1.UserRole.SALES)).rejects.toThrow('Access denied');
        });
        it('should allow admin to perform any valid transition', async () => {
            // Set customer to waiting status first
            await database_1.pool.query('UPDATE customers SET queue_status = $1 WHERE id = $2', [types_1.QueueStatus.WAITING, testCustomerId]);
            const customer = await queue_1.QueueService.changeStatus(testCustomerId, types_1.QueueStatus.SERVING, testUserId, types_1.UserRole.ADMIN);
            expect(customer.queue_status).toBe(types_1.QueueStatus.SERVING);
        });
    });
    describe('Processing Timestamp Management', () => {
        it('should record processing start timestamp when entering processing status', async () => {
            // Set customer to serving status first
            await database_1.pool.query('UPDATE customers SET queue_status = $1 WHERE id = $2', [types_1.QueueStatus.SERVING, testCustomerId]);
            await queue_1.QueueService.changeStatus(testCustomerId, types_1.QueueStatus.PROCESSING, testUserId, types_1.UserRole.ADMIN);
            // Check that a queue event with processing_start_at was recorded
            const result = await database_1.pool.query(`
        SELECT * FROM queue_events 
        WHERE customer_id = $1 AND event_type = 'processing_started'
        ORDER BY created_at DESC LIMIT 1
      `, [testCustomerId]);
            expect(result.rows.length).toBe(1);
            expect(result.rows[0].processing_start_at).not.toBeNull();
        });
        it('should record processing end timestamp when leaving processing status', async () => {
            // Set customer to processing status first
            await database_1.pool.query('UPDATE customers SET queue_status = $1 WHERE id = $2', [types_1.QueueStatus.PROCESSING, testCustomerId]);
            await queue_1.QueueService.changeStatus(testCustomerId, types_1.QueueStatus.COMPLETED, testUserId, types_1.UserRole.ADMIN);
            // Check that a queue event with processing_end_at was recorded
            const result = await database_1.pool.query(`
        SELECT * FROM queue_events 
        WHERE customer_id = $1 AND event_type = 'served'
        ORDER BY created_at DESC LIMIT 1
      `, [testCustomerId]);
            expect(result.rows.length).toBe(1);
            expect(result.rows[0].processing_end_at).not.toBeNull();
        });
    });
});
//# sourceMappingURL=serviceTransition.test.js.map