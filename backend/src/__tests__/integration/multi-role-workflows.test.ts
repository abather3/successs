import request from 'supertest';
import { Server } from 'socket.io';
import { createServer } from 'http';
import ioClient from 'socket.io-client';
import { pool } from '../../config/database';
import { EnhancedTestSetup } from './enhanced-setup';
import { UserRole, QueueStatus, PaymentMode, PaymentStatus } from '../../types';
import { CustomerService } from '../../services/customer';
import { TransactionService } from '../../services/transaction';
import { PaymentSettlementService } from '../../services/paymentSettlementService';
import { ActivityService } from '../../services/activity';
import express from 'express';

describe('Multi-Role Workflow Integration Tests', () => {
  let testSetup: EnhancedTestSetup;
  let testSchema: string;
  let app: express.Application;
  let server: any;
  let ioServer: Server;
  let userTokens: { [key: string]: string } = {};
  let userIds: any;
  let customerIds: number[];
  let transactionIds: number[];

  beforeAll(async () => {
    testSetup = EnhancedTestSetup.getInstance();
    testSchema = await testSetup.setupTestEnvironment();
    
    // Setup Express app for testing
    app = express();
    app.use(express.json());
    server = createServer(app);
    ioServer = new Server(server, {
      cors: { origin: "*" }
    });

    await new Promise((resolve) => server.listen(3002, resolve));

    // Create test users and data
    userIds = await testSetup.createTestUsers(testSchema);
    customerIds = await testSetup.createTestCustomers(testSchema, userIds.salesAgent1Id, 10);
    transactionIds = await testSetup.createTestTransactions(testSchema, customerIds, userIds.salesAgent1Id, userIds.cashier1Id);

    // Mock authentication tokens (in real tests, you'd generate actual JWT tokens)
    userTokens = {
      superAdmin: 'super-admin-token',
      admin: 'admin-token',
      salesAgent1: 'sales-agent-1-token',
      salesAgent2: 'sales-agent-2-token',
      cashier1: 'cashier-1-token',
      cashier2: 'cashier-2-token'
    };
  });

  afterAll(async () => {
    await testSetup.cleanupTestSchema(testSchema);
    ioServer.close();
    server.close();
  });

  describe('Admin → Sales Agent → Cashier → Customer Journey', () => {
    it('should handle complete workflow from admin setup to customer completion', async () => {
      const workflowEvents: any[] = [];
      
      // Setup WebSocket listeners to track workflow events
      const adminClient = ioClient('http://localhost:3002');
      const salesClient = ioClient('http://localhost:3002');
      const cashierClient = ioClient('http://localhost:3002');
      const customerClient = ioClient('http://localhost:3002');

      const eventTracker = (source: string) => (data: any) => {
        workflowEvents.push({ source, data, timestamp: new Date() });
      };

      adminClient.on('queue_updated', eventTracker('admin'));
      salesClient.on('queue_updated', eventTracker('sales'));
      cashierClient.on('payment_updated', eventTracker('cashier'));
      customerClient.on('status_change', eventTracker('customer'));

      try {
        // Step 1: Admin creates system configuration
        const client = await pool.connect();
        try {
          await client.query(`
            INSERT INTO ${testSchema}.activity_logs (user_id, action, details)
            VALUES ($1, $2, $3)
          `, [userIds.adminId, 'SYSTEM_CONFIG_UPDATE', JSON.stringify({ config: 'queue_settings' })]);
        } finally {
          client.release();
        }

        // Step 2: Sales agent creates customer and adds to queue
        const newCustomer = {
          or_number: `WORKFLOW-${Date.now()}`,
          name: 'Workflow Test Customer',
          contact_number: '9876543210',
          email: 'workflow@test.com',
          age: 35,
          address: 'Workflow Test Address',
          distribution_info: 'pickup',
          sales_agent_id: userIds.salesAgent1Id,
          prescription: { od: '-3.00', os: '-2.75' },
          grade_type: 'progressive',
          lens_type: 'anti-reflective',
          estimated_time: { days: 2, hours: 0, minutes: 0 },
          payment_info: { mode: PaymentMode.CASH, amount: 2500 },
          priority_flags: { senior_citizen: false, pregnant: false, pwd: false },
          queue_status: QueueStatus.WAITING,
          token_number: 99
        };

        const customerResult = await pool.query(`
          INSERT INTO ${testSchema}.customers (
            or_number, name, contact_number, email, age, address,
            distribution_info, sales_agent_id, prescription, grade_type,
            lens_type, estimated_time, payment_info, priority_flags,
            queue_status, token_number
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING id
        `, [
          newCustomer.or_number, newCustomer.name, newCustomer.contact_number,
          newCustomer.email, newCustomer.age, newCustomer.address,
          newCustomer.distribution_info, newCustomer.sales_agent_id,
          JSON.stringify(newCustomer.prescription), newCustomer.grade_type,
          newCustomer.lens_type, JSON.stringify(newCustomer.estimated_time),
          JSON.stringify(newCustomer.payment_info), JSON.stringify(newCustomer.priority_flags),
          newCustomer.queue_status, newCustomer.token_number
        ]);

        const newCustomerId = customerResult.rows[0].id;

        // Emit queue update event
        ioServer.emit('queue_updated', {
          customerId: newCustomerId,
          status: QueueStatus.WAITING,
          tokenNumber: newCustomer.token_number,
          addedBy: userIds.salesAgent1Id
        });

        // Step 3: Admin monitors queue and assigns priority
        await pool.query(`
          UPDATE ${testSchema}.customers 
          SET priority_flags = $1 
          WHERE id = $2
        `, [JSON.stringify({ senior_citizen: true, pregnant: false, pwd: false }), newCustomerId]);

        // Log admin action
        await pool.query(`
          INSERT INTO ${testSchema}.activity_logs (user_id, action, details)
          VALUES ($1, $2, $3)
        `, [userIds.adminId, 'PRIORITY_UPDATE', JSON.stringify({ customerId: newCustomerId, priority: 'senior_citizen' })]);

        // Step 4: Cashier calls customer and updates status to serving
        await pool.query(`
          UPDATE ${testSchema}.customers 
          SET queue_status = $1 
          WHERE id = $2
        `, [QueueStatus.SERVING, newCustomerId]);

        ioServer.emit('status_change', {
          customerId: newCustomerId,
          status: QueueStatus.SERVING,
          updatedBy: userIds.cashier1Id
        });

        // Step 5: Create transaction
        const transactionResult = await pool.query(`
          INSERT INTO ${testSchema}.transactions (
            customer_id, or_number, amount, payment_mode,
            sales_agent_id, cashier_id, payment_status, balance_amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `, [
          newCustomerId, `TXN-${newCustomer.or_number}`, 2500,
          PaymentMode.CASH, userIds.salesAgent1Id, userIds.cashier1Id,
          PaymentStatus.UNPAID, 2500
        ]);

        const newTransactionId = transactionResult.rows[0].id;

        // Step 6: Process multiple partial payments
        // First payment - 1000 cash
        await pool.query(`
          INSERT INTO ${testSchema}.payment_settlements (
            transaction_id, amount, payment_mode, cashier_id
          ) VALUES ($1, $2, $3, $4)
        `, [newTransactionId, 1000, PaymentMode.CASH, userIds.cashier1Id]);

        await pool.query(`
          UPDATE ${testSchema}.transactions 
          SET paid_amount = 1000, balance_amount = 1500, payment_status = $1
          WHERE id = $2
        `, [PaymentStatus.PARTIAL, newTransactionId]);

        ioServer.emit('payment_updated', {
          transactionId: newTransactionId,
          amount: 1000,
          paymentMode: PaymentMode.CASH,
          status: PaymentStatus.PARTIAL,
          processedBy: userIds.cashier1Id
        });

        // Second payment - 800 GCash
        await pool.query(`
          INSERT INTO ${testSchema}.payment_settlements (
            transaction_id, amount, payment_mode, cashier_id
          ) VALUES ($1, $2, $3, $4)
        `, [newTransactionId, 800, PaymentMode.GCASH, userIds.cashier1Id]);

        await pool.query(`
          UPDATE ${testSchema}.transactions 
          SET paid_amount = 1800, balance_amount = 700, payment_status = $1
          WHERE id = $2
        `, [PaymentStatus.PARTIAL, newTransactionId]);

        // Final payment - 700 credit card
        await pool.query(`
          INSERT INTO ${testSchema}.payment_settlements (
            transaction_id, amount, payment_mode, cashier_id
          ) VALUES ($1, $2, $3, $4)
        `, [newTransactionId, 700, PaymentMode.CREDIT_CARD, userIds.cashier1Id]);

        await pool.query(`
          UPDATE ${testSchema}.transactions 
          SET paid_amount = 2500, balance_amount = 0, payment_status = $1
          WHERE id = $2
        `, [PaymentStatus.PAID, newTransactionId]);

        ioServer.emit('payment_updated', {
          transactionId: newTransactionId,
          status: PaymentStatus.PAID,
          totalAmount: 2500,
          processedBy: userIds.cashier1Id
        });

        // Step 7: Update customer status to processing
        await pool.query(`
          UPDATE ${testSchema}.customers 
          SET queue_status = $1 
          WHERE id = $2
        `, [QueueStatus.PROCESSING, newCustomerId]);

        // Step 8: Admin monitors completion and updates to completed
        await pool.query(`
          UPDATE ${testSchema}.customers 
          SET queue_status = $1 
          WHERE id = $2
        `, [QueueStatus.COMPLETED, newCustomerId]);

        ioServer.emit('status_change', {
          customerId: newCustomerId,
          status: QueueStatus.COMPLETED,
          completedBy: userIds.adminId
        });

        // Wait for all events to propagate
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify final state
        const finalCustomer = await pool.query(`
          SELECT * FROM ${testSchema}.customers WHERE id = $1
        `, [newCustomerId]);

        const finalTransaction = await pool.query(`
          SELECT * FROM ${testSchema}.transactions WHERE id = $1
        `, [newTransactionId]);

        const settlements = await pool.query(`
          SELECT * FROM ${testSchema}.payment_settlements WHERE transaction_id = $1
        `, [newTransactionId]);

        const activityLogs = await pool.query(`
          SELECT * FROM ${testSchema}.activity_logs WHERE details->>{customerId} = $1
        `, [newCustomerId.toString()]);

        // Assertions
        expect(finalCustomer.rows[0].queue_status).toBe(QueueStatus.COMPLETED);
        expect(finalTransaction.rows[0].payment_status).toBe(PaymentStatus.PAID);
        expect(finalTransaction.rows[0].paid_amount).toBe('2500.00');
        expect(settlements.rows).toHaveLength(3);
        expect(workflowEvents.length).toBeGreaterThan(0);

        // Verify all payment modes were used
        const paymentModes = settlements.rows.map(s => s.payment_mode);
        expect(paymentModes).toContain(PaymentMode.CASH);
        expect(paymentModes).toContain(PaymentMode.GCASH);
        expect(paymentModes).toContain(PaymentMode.CREDIT_CARD);

      } finally {
        adminClient.disconnect();
        salesClient.disconnect();
        cashierClient.disconnect();
        customerClient.disconnect();
      }
    });

    it('should handle multi-cashier handoff scenario', async () => {
      // Create a customer with initial cashier
      const customerId = customerIds[0];
      const transactionId = transactionIds[0];

      // Cashier 1 starts serving
      await pool.query(`
        UPDATE ${testSchema}.customers 
        SET queue_status = $1 
        WHERE id = $2
      `, [QueueStatus.SERVING, customerId]);

      await pool.query(`
        INSERT INTO ${testSchema}.activity_logs (user_id, action, details)
        VALUES ($1, $2, $3)
      `, [userIds.cashier1Id, 'CUSTOMER_SERVE_START', JSON.stringify({ customerId })]);

      // Cashier 1 processes partial payment
      await pool.query(`
        INSERT INTO ${testSchema}.payment_settlements (
          transaction_id, amount, payment_mode, cashier_id
        ) VALUES ($1, $2, $3, $4)
      `, [transactionId, 500, PaymentMode.CASH, userIds.cashier1Id]);

      // Cashier 1 goes on break, Cashier 2 takes over
      await pool.query(`
        UPDATE ${testSchema}.transactions 
        SET cashier_id = $1
        WHERE id = $2
      `, [userIds.cashier2Id, transactionId]);

      await pool.query(`
        INSERT INTO ${testSchema}.activity_logs (user_id, action, details)
        VALUES ($1, $2, $3)
      `, [userIds.cashier2Id, 'CASHIER_HANDOFF', JSON.stringify({ 
        customerId, 
        transactionId, 
        previousCashier: userIds.cashier1Id 
      })]);

      // Cashier 2 completes payment
      await pool.query(`
        INSERT INTO ${testSchema}.payment_settlements (
          transaction_id, amount, payment_mode, cashier_id
        ) VALUES ($1, $2, $3, $4)
      `, [transactionId, 500, PaymentMode.GCASH, userIds.cashier2Id]);

      await pool.query(`
        UPDATE ${testSchema}.transactions 
        SET paid_amount = 1000, balance_amount = 0, payment_status = $1
        WHERE id = $2
      `, [PaymentStatus.PAID, transactionId]);

      // Verify handoff was properly recorded
      const settlements = await pool.query(`
        SELECT s.*, u.full_name as cashier_name 
        FROM ${testSchema}.payment_settlements s
        JOIN ${testSchema}.users u ON s.cashier_id = u.id
        WHERE s.transaction_id = $1
        ORDER BY s.created_at
      `, [transactionId]);

      expect(settlements.rows).toHaveLength(2);
      expect(settlements.rows[0].cashier_name).toBe('Cashier 1');
      expect(settlements.rows[1].cashier_name).toBe('Cashier 2');

      const handoffLog = await pool.query(`
        SELECT * FROM ${testSchema}.activity_logs 
        WHERE action = 'CASHIER_HANDOFF' AND user_id = $1
      `, [userIds.cashier2Id]);

      expect(handoffLog.rows).toHaveLength(1);
    });

    it('should handle admin intervention in queue management', async () => {
      const customerId = customerIds[1];
      
      // Sales agent adds customer to normal queue
      await pool.query(`
        UPDATE ${testSchema}.customers 
        SET queue_status = $1, token_number = $2
        WHERE id = $3
      `, [QueueStatus.WAITING, 100, customerId]);

      // Admin identifies priority customer and moves to front
      await pool.query(`
        UPDATE ${testSchema}.customers 
        SET priority_flags = $1, token_number = $2
        WHERE id = $3
      `, [JSON.stringify({ senior_citizen: true, pregnant: false, pwd: true }), 1, customerId]);

      await pool.query(`
        INSERT INTO ${testSchema}.activity_logs (user_id, action, details)
        VALUES ($1, $2, $3)
      `, [userIds.adminId, 'PRIORITY_QUEUE_MOVE', JSON.stringify({ 
        customerId, 
        originalToken: 100, 
        newToken: 1,
        reason: 'senior_citizen_and_pwd'
      })]);

      // Verify priority was set and customer moved
      const updatedCustomer = await pool.query(`
        SELECT * FROM ${testSchema}.customers WHERE id = $1
      `, [customerId]);

      const priorityFlags = JSON.parse(updatedCustomer.rows[0].priority_flags);
      expect(priorityFlags.senior_citizen).toBe(true);
      expect(priorityFlags.pwd).toBe(true);
      expect(updatedCustomer.rows[0].token_number).toBe(1);

      const adminAction = await pool.query(`
        SELECT * FROM ${testSchema}.activity_logs 
        WHERE action = 'PRIORITY_QUEUE_MOVE' AND user_id = $1
      `, [userIds.adminId]);

      expect(adminAction.rows).toHaveLength(1);
    });
  });

  describe('Role-Based Access Control in Workflows', () => {
    it('should enforce proper role permissions throughout workflow', async () => {
      const customerId = customerIds[2];
      const transactionId = transactionIds[2];

      // Test 1: Sales agent can create customers but not process payments
      await pool.query(`
        INSERT INTO ${testSchema}.activity_logs (user_id, action, details)
        VALUES ($1, $2, $3)
      `, [userIds.salesAgent1Id, 'CUSTOMER_CREATE', JSON.stringify({ customerId })]);

      // Attempt by sales agent to process payment should be tracked as unauthorized
      await pool.query(`
        INSERT INTO ${testSchema}.activity_logs (user_id, action, details)
        VALUES ($1, $2, $3)
      `, [userIds.salesAgent1Id, 'UNAUTHORIZED_PAYMENT_ATTEMPT', JSON.stringify({ 
        transactionId, 
        reason: 'insufficient_permissions' 
      })]);

      // Test 2: Cashier can process payments but not modify system settings
      await pool.query(`
        INSERT INTO ${testSchema}.payment_settlements (
          transaction_id, amount, payment_mode, cashier_id
        ) VALUES ($1, $2, $3, $4)
      `, [transactionId, 1000, PaymentMode.CASH, userIds.cashier1Id]);

      // Attempt by cashier to modify system settings should be tracked
      await pool.query(`
        INSERT INTO ${testSchema}.activity_logs (user_id, action, details)
        VALUES ($1, $2, $3)
      `, [userIds.cashier1Id, 'UNAUTHORIZED_SYSTEM_ACCESS', JSON.stringify({ 
        attemptedAction: 'system_config_update',
        reason: 'insufficient_permissions' 
      })]);

      // Test 3: Admin can override all actions
      await pool.query(`
        UPDATE ${testSchema}.customers 
        SET queue_status = $1 
        WHERE id = $2
      `, [QueueStatus.COMPLETED, customerId]);

      await pool.query(`
        INSERT INTO ${testSchema}.activity_logs (user_id, action, details)
        VALUES ($1, $2, $3)
      `, [userIds.adminId, 'ADMIN_OVERRIDE', JSON.stringify({ 
        customerId, 
        action: 'force_complete',
        reason: 'administrative_decision'
      })]);

      // Verify permissions were enforced
      const unauthorizedAttempts = await pool.query(`
        SELECT * FROM ${testSchema}.activity_logs 
        WHERE action LIKE 'UNAUTHORIZED%'
      `);

      expect(unauthorizedAttempts.rows.length).toBeGreaterThan(0);

      const adminOverrides = await pool.query(`
        SELECT * FROM ${testSchema}.activity_logs 
        WHERE action = 'ADMIN_OVERRIDE' AND user_id = $1
      `, [userIds.adminId]);

      expect(adminOverrides.rows).toHaveLength(1);
    });
  });

  describe('Error Handling in Multi-Role Workflows', () => {
    it('should handle workflow interruptions gracefully', async () => {
      const customerId = customerIds[3];
      const transactionId = transactionIds[3];

      // Start workflow normally
      await pool.query(`
        UPDATE ${testSchema}.customers 
        SET queue_status = $1 
        WHERE id = $2
      `, [QueueStatus.SERVING, customerId]);

      // Simulate system interruption during payment
      await pool.query(`
        INSERT INTO ${testSchema}.activity_logs (user_id, action, details)
        VALUES ($1, $2, $3)
      `, [userIds.cashier1Id, 'PAYMENT_INTERRUPTION', JSON.stringify({ 
        transactionId, 
        customerId,
        error: 'payment_gateway_timeout',
        recovery_action: 'manual_retry'
      })]);

      // Admin intervenes to resolve
      await pool.query(`
        INSERT INTO ${testSchema}.activity_logs (user_id, action, details)
        VALUES ($1, $2, $3)
      `, [userIds.adminId, 'ERROR_RESOLUTION', JSON.stringify({ 
        transactionId, 
        originalError: 'payment_gateway_timeout',
        resolution: 'manual_payment_entry',
        resolvedBy: 'admin'
      })]);

      // Complete transaction manually
      await pool.query(`
        INSERT INTO ${testSchema}.payment_settlements (
          transaction_id, amount, payment_mode, cashier_id, notes
        ) VALUES ($1, $2, $3, $4, $5)
      `, [transactionId, 1000, PaymentMode.CASH, userIds.adminId, 'Manual entry due to gateway timeout']);

      await pool.query(`
        UPDATE ${testSchema}.transactions 
        SET paid_amount = 1000, balance_amount = 0, payment_status = $1
        WHERE id = $2
      `, [PaymentStatus.PAID, transactionId]);

      // Verify error handling workflow
      const errorLogs = await pool.query(`
        SELECT * FROM ${testSchema}.activity_logs 
        WHERE action IN ('PAYMENT_INTERRUPTION', 'ERROR_RESOLUTION')
        ORDER BY created_at
      `);

      expect(errorLogs.rows).toHaveLength(2);
      expect(errorLogs.rows[0].action).toBe('PAYMENT_INTERRUPTION');
      expect(errorLogs.rows[1].action).toBe('ERROR_RESOLUTION');

      const manualSettlement = await pool.query(`
        SELECT * FROM ${testSchema}.payment_settlements 
        WHERE transaction_id = $1 AND notes LIKE '%Manual entry%'
      `, [transactionId]);

      expect(manualSettlement.rows).toHaveLength(1);
    });
  });
});
