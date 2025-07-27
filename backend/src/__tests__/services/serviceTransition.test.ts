import { pool } from '../../config/database';
import { QueueService } from '../../services/queue';
import { QueueStatus, UserRole } from '../../types';

describe('Service Transition Rule Tests', () => {
  let testCustomerId: number;
  let testUserId: number;

  beforeAll(async () => {
    // Create test user
    const userResult = await pool.query(`
      INSERT INTO users (email, password, full_name, role, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, ['transition-test@example.com', 'hashedpassword', 'Transition Test User', 'admin', 'active']);
    testUserId = userResult.rows[0].id;

    // Create test customer
    const customerResult = await pool.query(`
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
    await pool.query('DELETE FROM customers WHERE id = $1', [testCustomerId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  describe('Valid Status Transitions', () => {
    it('should allow waiting → serving transition', async () => {
      // Reset customer to waiting status
      await pool.query('UPDATE customers SET queue_status = $1 WHERE id = $2', 
        [QueueStatus.WAITING, testCustomerId]);
      
      const customer = await QueueService.changeStatus(
        testCustomerId, 
        QueueStatus.SERVING, 
        testUserId, 
        UserRole.ADMIN
      );
      
      expect(customer.queue_status).toBe(QueueStatus.SERVING);
    });

    it('should allow serving → processing transition', async () => {
      // Set customer to serving status first
      await pool.query('UPDATE customers SET queue_status = $1 WHERE id = $2', 
        [QueueStatus.SERVING, testCustomerId]);
      
      const customer = await QueueService.changeStatus(
        testCustomerId, 
        QueueStatus.PROCESSING, 
        testUserId, 
        UserRole.ADMIN
      );
      
      expect(customer.queue_status).toBe(QueueStatus.PROCESSING);
    });

    it('should allow processing → completed transition', async () => {
      // Set customer to processing status first
      await pool.query('UPDATE customers SET queue_status = $1 WHERE id = $2', 
        [QueueStatus.PROCESSING, testCustomerId]);
      
      const customer = await QueueService.changeStatus(
        testCustomerId, 
        QueueStatus.COMPLETED, 
        testUserId, 
        UserRole.ADMIN
      );
      
      expect(customer.queue_status).toBe(QueueStatus.COMPLETED);
    });
  });

  describe('Invalid Status Transitions', () => {
    it('should reject completed → processing transition', async () => {
      // Set customer to completed status first
      await pool.query('UPDATE customers SET queue_status = $1 WHERE id = $2', 
        [QueueStatus.COMPLETED, testCustomerId]);
      
      await expect(QueueService.changeStatus(
        testCustomerId, 
        QueueStatus.PROCESSING, 
        testUserId, 
        UserRole.ADMIN
      )).rejects.toThrow('Invalid status transition');
    });

    it('should reject cancelled → waiting transition', async () => {
      // Set customer to cancelled status first
      await pool.query('UPDATE customers SET queue_status = $1 WHERE id = $2', 
        [QueueStatus.CANCELLED, testCustomerId]);
      
      await expect(QueueService.changeStatus(
        testCustomerId, 
        QueueStatus.WAITING, 
        testUserId, 
        UserRole.ADMIN
      )).rejects.toThrow('Invalid status transition');
    });
  });

  describe('RBAC Transition Permissions', () => {
    it('should allow cashier to perform serving → processing transition', async () => {
      // Set customer to serving status first
      await pool.query('UPDATE customers SET queue_status = $1 WHERE id = $2', 
        [QueueStatus.SERVING, testCustomerId]);
      
      const customer = await QueueService.changeStatus(
        testCustomerId, 
        QueueStatus.PROCESSING, 
        testUserId, 
        UserRole.CASHIER
      );
      
      expect(customer.queue_status).toBe(QueueStatus.PROCESSING);
    });

    it('should deny sales role from performing any transition', async () => {
      // Set customer to waiting status first
      await pool.query('UPDATE customers SET queue_status = $1 WHERE id = $2', 
        [QueueStatus.WAITING, testCustomerId]);
      
      await expect(QueueService.changeStatus(
        testCustomerId, 
        QueueStatus.SERVING, 
        testUserId, 
        UserRole.SALES
      )).rejects.toThrow('Access denied');
    });

    it('should allow admin to perform any valid transition', async () => {
      // Set customer to waiting status first
      await pool.query('UPDATE customers SET queue_status = $1 WHERE id = $2', 
        [QueueStatus.WAITING, testCustomerId]);
      
      const customer = await QueueService.changeStatus(
        testCustomerId, 
        QueueStatus.SERVING, 
        testUserId, 
        UserRole.ADMIN
      );
      
      expect(customer.queue_status).toBe(QueueStatus.SERVING);
    });
  });

  describe('Processing Timestamp Management', () => {
    it('should record processing start timestamp when entering processing status', async () => {
      // Set customer to serving status first
      await pool.query('UPDATE customers SET queue_status = $1 WHERE id = $2', 
        [QueueStatus.SERVING, testCustomerId]);
      
      await QueueService.changeStatus(
        testCustomerId, 
        QueueStatus.PROCESSING, 
        testUserId, 
        UserRole.ADMIN
      );
      
      // Check that a queue event with processing_start_at was recorded
      const result = await pool.query(`
        SELECT * FROM queue_events 
        WHERE customer_id = $1 AND event_type = 'processing_started'
        ORDER BY created_at DESC LIMIT 1
      `, [testCustomerId]);
      
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].processing_start_at).not.toBeNull();
    });

    it('should record processing end timestamp when leaving processing status', async () => {
      // Set customer to processing status first
      await pool.query('UPDATE customers SET queue_status = $1 WHERE id = $2', 
        [QueueStatus.PROCESSING, testCustomerId]);
      
      await QueueService.changeStatus(
        testCustomerId, 
        QueueStatus.COMPLETED, 
        testUserId, 
        UserRole.ADMIN
      );
      
      // Check that a queue event with processing_end_at was recorded
      const result = await pool.query(`
        SELECT * FROM queue_events 
        WHERE customer_id = $1 AND event_type = 'served'
        ORDER BY created_at DESC LIMIT 1
      `, [testCustomerId]);
      
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].processing_end_at).not.toBeNull();
    });
  });
});
