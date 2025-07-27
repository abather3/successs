import request from 'supertest';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { pool } from '../../config/database';
import { PaymentSettlementService } from '../../services/paymentSettlementService';
import { TransactionService } from '../../services/transaction';
import { UserService } from '../../services/user';
import { PaymentMode, PaymentStatus } from '../../types';
import { setupWebSocketHandlers, WebSocketService } from '../../services/websocket';

// Import the Express app
import app from '../../app';

describe('Concurrent Settlement Integration Tests', () => {
  let server: any;
  let httpServer: any;
  let io: Server;
  let clientSocket: ClientSocket;
  let authToken: string;

  let testTransactionId: number;
  let testCustomerId: number;
  let testCashierId: number;
  let testSalesAgentId: number;

  beforeAll(async () => {
    // Setup HTTP server and Socket.IO
    httpServer = createServer(app);
    io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    WebSocketService.setIO(io);
    setupWebSocketHandlers(io);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, resolve);
    });

    const port = httpServer.address()?.port;

    // Setup test database data
    const client = await pool.connect();
    
    try {
      // Create test users
      const cashierResult = await client.query(`
        INSERT INTO users (email, password, full_name, role, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, ['cashier@concurrent.test', '$2b$10$hashedpassword', 'Test Cashier', 'cashier', 'active']);
      testCashierId = cashierResult.rows[0].id;

      const salesResult = await client.query(`
        INSERT INTO users (email, password, full_name, role, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, ['sales@concurrent.test', '$2b$10$hashedpassword', 'Test Sales Agent', 'sales', 'active']);
      testSalesAgentId = salesResult.rows[0].id;

      // Create test customer
      const customerResult = await client.query(`
        INSERT INTO customers (name, contact_number, email, age, address, or_number, 
                              distribution_info, sales_agent_id, prescription, grade_type, 
                              lens_type, estimated_time, payment_info, priority_flags, 
                              queue_status, token_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id
      `, [
        'Test Customer Concurrent', '1234567890', 'test@concurrent.example.com', 30, 'Test Address', 'CONC-OR-001',
        'pickup', testSalesAgentId, '{}', 'single', 'regular', '{"days": 1, "hours": 0, "minutes": 0}',
        '{"mode": "cash", "amount": 1000}', '{"senior_citizen": false, "pregnant": false, "pwd": false}',
        'waiting', 1
      ]);
      testCustomerId = customerResult.rows[0].id;

      // Generate auth token for API requests
      const jwt = require('jsonwebtoken');
      const config = require('../../config/config').config;
      authToken = jwt.sign(
        { userId: testCashierId, role: 'cashier' },
        config.JWT_SECRET,
        { expiresIn: '1h' }
      );

    } finally {
      client.release();
    }

    // Setup WebSocket client
    clientSocket = ioClient(`http://localhost:${port}`, {
      auth: {
        token: authToken
      }
    });

    await new Promise<void>((resolve) => {
      clientSocket.on('connected', resolve);
    });
  });

  afterAll(async () => {
    // Cleanup
    if (clientSocket) {
      clientSocket.disconnect();
    }
    
    if (httpServer) {
      await new Promise((resolve) => {
        httpServer.close(resolve);
      });
    }

    // Clean up test data
    const client = await pool.connect();
    try {
      if (testTransactionId) {
        await client.query('DELETE FROM payment_settlements WHERE transaction_id = $1', [testTransactionId]);
        await client.query('DELETE FROM transactions WHERE id = $1', [testTransactionId]);
      }
      await client.query('DELETE FROM customers WHERE id = $1', [testCustomerId]);
      await client.query('DELETE FROM users WHERE id IN ($1, $2)', [testCashierId, testSalesAgentId]);
    } finally {
      client.release();
    }
  });

  beforeEach(async () => {
    // Create a fresh transaction for each test
    const transaction = await TransactionService.create({
      customer_id: testCustomerId,
      or_number: `CONC-OR-${Date.now()}`,
      amount: 1000,
      payment_mode: PaymentMode.CASH,
      sales_agent_id: testSalesAgentId,
      cashier_id: testCashierId
    });
    testTransactionId = transaction.id;

    // Reset transaction to unpaid state for testing
    await pool.query(
      'UPDATE transactions SET paid_amount = 0, payment_status = $1 WHERE id = $2',
      ['unpaid', testTransactionId]
    );
  });

  afterEach(async () => {
    // Clean up transaction and its settlements
    if (testTransactionId) {
      const client = await pool.connect();
      try {
        await client.query('DELETE FROM payment_settlements WHERE transaction_id = $1', [testTransactionId]);
        await client.query('DELETE FROM transactions WHERE id = $1', [testTransactionId]);
      } finally {
        client.release();
      }
      testTransactionId = 0;
    }
  });

  describe('Concurrent Settlement Prevention', () => {
    it('should handle two concurrent settlement requests and create only one successful settlement', async () => {
      const settlementPromises = [
        PaymentSettlementService.createSettlement(testTransactionId, 600, PaymentMode.CASH, testCashierId),
        PaymentSettlementService.createSettlement(testTransactionId, 500, PaymentMode.GCASH, testCashierId)
      ];

      // Execute concurrent settlements
      const results = await Promise.allSettled(settlementPromises);

      // One should succeed, one should fail
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(1);

      // Check database state - should have only one settlement
      const settlements = await PaymentSettlementService.getSettlements(testTransactionId);
      expect(settlements).toHaveLength(1);

      // Verify transaction total is correct
      const transaction = await TransactionService.findById(testTransactionId);
      expect(transaction?.paid_amount).toBeLessThanOrEqual(1000);
      
      // The successful settlement should have created the single row
      const successfulResult = successful[0] as PromiseFulfilledResult<any>;
      expect(successfulResult.value.settlements).toHaveLength(1);
    });

    it('should handle three concurrent settlements where only some can fit', async () => {
      const settlementPromises = [
        PaymentSettlementService.createSettlement(testTransactionId, 400, PaymentMode.CASH, testCashierId),
        PaymentSettlementService.createSettlement(testTransactionId, 400, PaymentMode.GCASH, testCashierId),
        PaymentSettlementService.createSettlement(testTransactionId, 400, PaymentMode.MAYA, testCashierId)
      ];

      // Execute concurrent settlements
      const results = await Promise.allSettled(settlementPromises);

      // Two should succeed (total 800), one should fail (would exceed 1000)
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful).toHaveLength(2);
      expect(failed).toHaveLength(1);

      // Check database state - should have exactly two settlements
      const settlements = await PaymentSettlementService.getSettlements(testTransactionId);
      expect(settlements).toHaveLength(2);

      // Verify total amount is exactly the sum of two payments
      const totalPaid = settlements.reduce((sum, settlement) => sum + parseFloat(settlement.amount.toString()), 0);
      expect(totalPaid).toBe(800);

      // Verify transaction reflects correct payment status
      const transaction = await TransactionService.findById(testTransactionId);
      expect(transaction?.paid_amount).toBe(800);
      expect(transaction?.payment_status).toBe('partial');
    });

    it('should handle concurrent exact-balance settlements', async () => {
      // First, make a partial payment to leave exactly 500 remaining
      await PaymentSettlementService.createSettlement(testTransactionId, 500, PaymentMode.CASH, testCashierId);

      // Now try two concurrent settlements for the exact remaining balance
      const settlementPromises = [
        PaymentSettlementService.createSettlement(testTransactionId, 500, PaymentMode.GCASH, testCashierId),
        PaymentSettlementService.createSettlement(testTransactionId, 500, PaymentMode.MAYA, testCashierId)
      ];

      const results = await Promise.allSettled(settlementPromises);

      // Only one should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(1);

      // Check final state - should have exactly two settlements totaling 1000
      const settlements = await PaymentSettlementService.getSettlements(testTransactionId);
      expect(settlements).toHaveLength(2);

      const totalPaid = settlements.reduce((sum, settlement) => sum + parseFloat(settlement.amount.toString()), 0);
      expect(totalPaid).toBe(1000);

      // Transaction should be marked as paid
      const transaction = await TransactionService.findById(testTransactionId);
      expect(transaction?.payment_status).toBe('paid');
      expect(transaction?.paid_amount).toBe(1000);
    });

    it('should handle mixed amount concurrent settlements', async () => {
      const settlementPromises = [
        PaymentSettlementService.createSettlement(testTransactionId, 300, PaymentMode.CASH, testCashierId),
        PaymentSettlementService.createSettlement(testTransactionId, 250, PaymentMode.GCASH, testCashierId),
        PaymentSettlementService.createSettlement(testTransactionId, 200, PaymentMode.MAYA, testCashierId),
        PaymentSettlementService.createSettlement(testTransactionId, 400, PaymentMode.CREDIT_CARD, testCashierId)
      ];

      const results = await Promise.allSettled(settlementPromises);

      // Calculate successful and failed
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      // At least one should succeed, and total should not exceed 1000
      expect(successful.length).toBeGreaterThan(0);
      expect(successful.length).toBeLessThanOrEqual(4);

      // Verify database integrity
      const settlements = await PaymentSettlementService.getSettlements(testTransactionId);
      const totalPaid = settlements.reduce((sum, settlement) => sum + parseFloat(settlement.amount.toString()), 0);
      expect(totalPaid).toBeLessThanOrEqual(1000);

      // Verify transaction consistency
      const transaction = await TransactionService.findById(testTransactionId);
      expect(transaction?.paid_amount).toBe(totalPaid);
      expect(transaction?.paid_amount).toBeLessThanOrEqual(1000);

      // Verify settlement count matches successful operations
      expect(settlements).toHaveLength(successful.length);
    });
  });

  describe('WebSocket Integration with Concurrent Settlements', () => {
    it('should emit WebSocket events only for successful concurrent settlements', async () => {
      const receivedEvents: any[] = [];

      // Listen for settlement events
      clientSocket.on('settlementCreated', (data) => {
        receivedEvents.push({ type: 'settlementCreated', data });
      });

      clientSocket.on('transactionUpdated', (data) => {
        receivedEvents.push({ type: 'transactionUpdated', data });
      });

      // Subscribe to relevant channels
      clientSocket.emit('subscribe:transactions');
      clientSocket.emit('subscribe:payment_status');

      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for subscriptions

      // Execute concurrent settlements
      const settlementPromises = [
        PaymentSettlementService.createSettlement(testTransactionId, 700, PaymentMode.CASH, testCashierId),
        PaymentSettlementService.createSettlement(testTransactionId, 600, PaymentMode.GCASH, testCashierId)
      ];

      const results = await Promise.allSettled(settlementPromises);

      // Wait for WebSocket events to arrive
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify only successful settlements generated WebSocket events
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful).toHaveLength(1);

      // Should have received events only for the successful settlement
      const settlementCreatedEvents = receivedEvents.filter(e => e.type === 'settlementCreated');
      const transactionUpdatedEvents = receivedEvents.filter(e => e.type === 'transactionUpdated');

      expect(settlementCreatedEvents).toHaveLength(1);
      expect(transactionUpdatedEvents).toHaveLength(1);

      // Verify event data integrity
      const settlementEvent = settlementCreatedEvents[0];
      expect(settlementEvent.data.transaction_id).toBe(testTransactionId);
      expect(settlementEvent.data.settlement).toBeDefined();
    });

    it('should emit correct payment status for concurrent partial payments', async () => {
      const receivedStatusUpdates: any[] = [];

      clientSocket.on('payment_status_updated', (data) => {
        receivedStatusUpdates.push(data);
      });

      // Subscribe to payment status updates
      clientSocket.emit('subscribe:payment_status');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Execute concurrent partial settlements
      const settlementPromises = [
        PaymentSettlementService.createSettlement(testTransactionId, 300, PaymentMode.CASH, testCashierId),
        PaymentSettlementService.createSettlement(testTransactionId, 250, PaymentMode.GCASH, testCashierId),
        PaymentSettlementService.createSettlement(testTransactionId, 200, PaymentMode.MAYA, testCashierId)
      ];

      await Promise.allSettled(settlementPromises);

      // Wait for WebSocket events
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should have received payment status updates only for successful settlements
      expect(receivedStatusUpdates.length).toBeGreaterThan(0);

      // Verify final payment status reflects actual database state
      const finalTransaction = await TransactionService.findById(testTransactionId);
      const lastStatusUpdate = receivedStatusUpdates[receivedStatusUpdates.length - 1];

      expect(lastStatusUpdate.transactionId).toBe(testTransactionId);
      expect(lastStatusUpdate.paid_amount).toBe(finalTransaction?.paid_amount);
      expect(lastStatusUpdate.payment_status).toBe(finalTransaction?.payment_status);
    });
  });

  describe('API Integration with Concurrent Settlements', () => {
    it('should handle concurrent API settlement requests', async () => {
      // Create concurrent API requests
      const apiPromises = [
        request(app)
          .post(`/api/transactions/${testTransactionId}/settlements`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            amount: 400,
            payment_mode: PaymentMode.CASH
          }),
        request(app)
          .post(`/api/transactions/${testTransactionId}/settlements`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            amount: 350,
            payment_mode: PaymentMode.GCASH
          }),
        request(app)
          .post(`/api/transactions/${testTransactionId}/settlements`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            amount: 400,
            payment_mode: PaymentMode.MAYA
          })
      ];

      const apiResults = await Promise.allSettled(
        apiPromises.map(p => p.then(res => ({ status: res.status, body: res.body })))
      );

      // Count successful API responses (status 200/201)
      const successfulApiCalls = apiResults.filter(
        result => result.status === 'fulfilled' && 
        [200, 201].includes((result.value as any).status)
      );

      // Verify database consistency regardless of API response timing
      const settlements = await PaymentSettlementService.getSettlements(testTransactionId);
      const totalPaid = settlements.reduce((sum, settlement) => sum + parseFloat(settlement.amount.toString()), 0);
      
      expect(totalPaid).toBeLessThanOrEqual(1000);
      expect(settlements.length).toBe(successfulApiCalls.length);

      // Verify transaction integrity
      const transaction = await TransactionService.findById(testTransactionId);
      expect(transaction?.paid_amount).toBe(totalPaid);
    });

    it('should return appropriate error responses for failed concurrent settlements', async () => {
      // Make first payment to create specific remaining balance
      await PaymentSettlementService.createSettlement(testTransactionId, 800, PaymentMode.CASH, testCashierId);

      // Try concurrent API requests that would exceed remaining balance
      const apiPromises = [
        request(app)
          .post(`/api/transactions/${testTransactionId}/settlements`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            amount: 200, // This should succeed (exactly remaining balance)
            payment_mode: PaymentMode.GCASH
          }),
        request(app)
          .post(`/api/transactions/${testTransactionId}/settlements`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            amount: 150, // This should fail (would exceed balance)
            payment_mode: PaymentMode.MAYA
          })
      ];

      const apiResults = await Promise.all(apiPromises);

      // One should succeed, one should fail
      const successful = apiResults.filter(res => [200, 201].includes(res.status));
      const failed = apiResults.filter(res => [400, 409, 422].includes(res.status));

      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(1);

      // Verify error message is appropriate
      const failedResponse = failed[0];
      expect(failedResponse.body.error).toMatch(/exceeds remaining balance|insufficient balance/i);

      // Verify final transaction state
      const transaction = await TransactionService.findById(testTransactionId);
      expect(transaction?.paid_amount).toBe(1000); // 800 + 200
      expect(transaction?.payment_status).toBe('paid');
    });
  });

  describe('Database Consistency Under Concurrent Load', () => {
    it('should maintain database consistency with high concurrency', async () => {
      // Create many concurrent settlement attempts
      const concurrentCount = 10;
      const amountPerSettlement = 150; // Total would be 1500, but only some should succeed
      
      const settlementPromises = Array.from({ length: concurrentCount }, (_, index) => 
        PaymentSettlementService.createSettlement(
          testTransactionId, 
          amountPerSettlement, 
          Object.values(PaymentMode)[index % Object.values(PaymentMode).length],
          testCashierId
        )
      );

      const results = await Promise.allSettled(settlementPromises);

      // Calculate expected results
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      // Should have some successes and some failures
      expect(successful.length).toBeGreaterThan(0);
      expect(failed.length).toBeGreaterThan(0);
      expect(successful.length + failed.length).toBe(concurrentCount);

      // Verify database consistency
      const settlements = await PaymentSettlementService.getSettlements(testTransactionId);
      expect(settlements).toHaveLength(successful.length);

      // Total paid should not exceed transaction amount
      const totalPaid = settlements.reduce((sum, settlement) => sum + parseFloat(settlement.amount.toString()), 0);
      expect(totalPaid).toBeLessThanOrEqual(1000);

      // Transaction should reflect correct totals
      const transaction = await TransactionService.findById(testTransactionId);
      expect(transaction?.paid_amount).toBe(totalPaid);
      
      // Payment status should be appropriate
      if (totalPaid === 1000) {
        expect(transaction?.payment_status).toBe('paid');
      } else {
        expect(transaction?.payment_status).toBe('partial');
      }
    });

    it('should handle concurrent settlements with different cashiers', async () => {
      // Create another cashier
      const client = await pool.connect();
      let secondCashierId: number;
      
      try {
        const cashier2Result = await client.query(`
          INSERT INTO users (email, password, full_name, role, status)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, ['cashier2@concurrent.test', '$2b$10$hashedpassword', 'Test Cashier 2', 'cashier', 'active']);
        secondCashierId = cashier2Result.rows[0].id;
      } finally {
        client.release();
      }

      // Execute concurrent settlements from different cashiers
      const settlementPromises = [
        PaymentSettlementService.createSettlement(testTransactionId, 400, PaymentMode.CASH, testCashierId),
        PaymentSettlementService.createSettlement(testTransactionId, 350, PaymentMode.GCASH, secondCashierId),
        PaymentSettlementService.createSettlement(testTransactionId, 300, PaymentMode.MAYA, testCashierId),
        PaymentSettlementService.createSettlement(testTransactionId, 200, PaymentMode.CREDIT_CARD, secondCashierId)
      ];

      const results = await Promise.allSettled(settlementPromises);
      
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);

      // Verify settlements record correct cashier IDs
      const settlements = await PaymentSettlementService.getSettlements(testTransactionId);
      const cashierIds = settlements.map(s => s.cashier_id);
      
      // Should contain settlements from both cashiers
      const uniqueCashierIds = [...new Set(cashierIds)];
      expect(uniqueCashierIds.length).toBeGreaterThan(1);
      expect(uniqueCashierIds).toContain(testCashierId);
      expect(uniqueCashierIds).toContain(secondCashierId);

      // Cleanup
      await pool.query('DELETE FROM users WHERE id = $1', [secondCashierId]);
    });
  });
});
