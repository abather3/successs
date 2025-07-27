import { pool } from '../../config/database';
import { TransactionService } from '../../services/transaction';
import { PaymentSettlementService } from '../../services/paymentSettlementService';
import { PaymentMode, PaymentStatus } from '../../types';

// Mock WebSocket service for integration tests
jest.mock('../../services/websocket', () => ({
  WebSocketService: {
    emitPaymentStatusUpdate: jest.fn(),
    emitTransactionUpdate: jest.fn(),
  }
}));

describe('Payment Flows Integration Tests', () => {
  let testTransactionId: number;
  let testCustomerId: number;
  let testCashierId: number;
  let testSalesAgentId: number;

  beforeAll(async () => {
    // Setup test data
    const client = await pool.connect();
    
    try {
      // Create test customer
      const customerResult = await client.query(`
        INSERT INTO customers (name, contact_number, email, age, address, or_number, 
                              distribution_info, sales_agent_id, prescription, grade_type, 
                              lens_type, estimated_time, payment_info, priority_flags, 
                              queue_status, token_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id
      `, [
        'Test Customer', '1234567890', 'test@example.com', 30, 'Test Address', 'TEST-OR-001',
        'pickup', 1, '{}', 'single', 'regular', '{"days": 1, "hours": 0, "minutes": 0}',
        '{"mode": "cash", "amount": 1000}', '{"senior_citizen": false, "pregnant": false, "pwd": false}',
        'waiting', 1
      ]);
      testCustomerId = customerResult.rows[0].id;

      // Create test users
      const cashierResult = await client.query(`
        INSERT INTO users (email, password, full_name, role, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, ['cashier@test.com', 'hashedpassword', 'Test Cashier', 'cashier', 'active']);
      testCashierId = cashierResult.rows[0].id;

      const salesResult = await client.query(`
        INSERT INTO users (email, password, full_name, role, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, ['sales@test.com', 'hashedpassword', 'Test Sales Agent', 'sales', 'active']);
      testSalesAgentId = salesResult.rows[0].id;

    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    // Clean up test data
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM payment_settlements WHERE transaction_id = $1', [testTransactionId]);
      await client.query('DELETE FROM transactions WHERE id = $1', [testTransactionId]);
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
      or_number: `TEST-OR-${Date.now()}`,
      amount: 1000,
      payment_mode: PaymentMode.CASH,
      sales_agent_id: testSalesAgentId,
      cashier_id: testCashierId
    });
    testTransactionId = transaction.id;
  });

  afterEach(async () => {
    // Clean up transaction and its settlements
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM payment_settlements WHERE transaction_id = $1', [testTransactionId]);
      await client.query('DELETE FROM transactions WHERE id = $1', [testTransactionId]);
    } finally {
      client.release();
    }
  });

  describe('Full Payment Flow', () => {
    it('should handle single full payment', async () => {
      // Create a full payment settlement
      const result = await PaymentSettlementService.createSettlement(
        testTransactionId, 
        1000, 
        PaymentMode.CASH, 
        testCashierId
      );

      // Verify transaction is marked as paid
      expect(result.transaction.payment_status).toBe(PaymentStatus.PAID);
      expect(result.transaction.paid_amount).toBe(1000);
      expect(result.settlements).toHaveLength(1);
      expect(result.settlements[0].amount).toBe(1000);
      expect(result.settlements[0].payment_mode).toBe(PaymentMode.CASH);

      // Verify database state
      const dbTransaction = await TransactionService.findById(testTransactionId);
      expect(dbTransaction?.payment_status).toBe('paid');
      expect(dbTransaction?.paid_amount).toBe(1000);
    });

    it('should handle full payment with different payment mode', async () => {
      const result = await PaymentSettlementService.createSettlement(
        testTransactionId, 
        1000, 
        PaymentMode.GCASH, 
        testCashierId
      );

      expect(result.transaction.payment_status).toBe(PaymentStatus.PAID);
      expect(result.settlements[0].payment_mode).toBe(PaymentMode.GCASH);
    });
  });

  describe('Partial Payment Flow', () => {
    it('should handle single partial payment', async () => {
      // Create a partial payment settlement
      const result = await PaymentSettlementService.createSettlement(
        testTransactionId, 
        400, 
        PaymentMode.CASH, 
        testCashierId
      );

      // Verify transaction is marked as partial
      expect(result.transaction.payment_status).toBe(PaymentStatus.PARTIAL);
      expect(result.transaction.paid_amount).toBe(400);
      expect(result.settlements).toHaveLength(1);
      expect(result.settlements[0].amount).toBe(400);

      // Verify database state
      const dbTransaction = await TransactionService.findById(testTransactionId);
      expect(dbTransaction?.payment_status).toBe('partial');
      expect(dbTransaction?.paid_amount).toBe(400);
    });

    it('should handle multiple partial payments to completion', async () => {
      // First partial payment
      const result1 = await PaymentSettlementService.createSettlement(
        testTransactionId, 
        300, 
        PaymentMode.CASH, 
        testCashierId
      );

      expect(result1.transaction.payment_status).toBe(PaymentStatus.PARTIAL);
      expect(result1.transaction.paid_amount).toBe(300);
      expect(result1.settlements).toHaveLength(1);

      // Second partial payment
      const result2 = await PaymentSettlementService.createSettlement(
        testTransactionId, 
        250, 
        PaymentMode.GCASH, 
        testCashierId
      );

      expect(result2.transaction.payment_status).toBe(PaymentStatus.PARTIAL);
      expect(result2.transaction.paid_amount).toBe(550);
      expect(result2.settlements).toHaveLength(2);

      // Final payment to complete
      const result3 = await PaymentSettlementService.createSettlement(
        testTransactionId, 
        450, 
        PaymentMode.MAYA, 
        testCashierId
      );

      expect(result3.transaction.payment_status).toBe(PaymentStatus.PAID);
      expect(result3.transaction.paid_amount).toBe(1000);
      expect(result3.settlements).toHaveLength(3);

      // Verify all payment modes are recorded
      const settlements = result3.settlements;
      const paymentModes = settlements.map(s => s.payment_mode);
      expect(paymentModes).toContain(PaymentMode.CASH);
      expect(paymentModes).toContain(PaymentMode.GCASH);
      expect(paymentModes).toContain(PaymentMode.MAYA);
    });
  });

  describe('Multiple Payment Modes', () => {
    it('should handle payments with different modes', async () => {
      // Cash payment
      await PaymentSettlementService.createSettlement(
        testTransactionId, 
        200, 
        PaymentMode.CASH, 
        testCashierId
      );

      // GCash payment
      await PaymentSettlementService.createSettlement(
        testTransactionId, 
        300, 
        PaymentMode.GCASH, 
        testCashierId
      );

      // Maya payment
      await PaymentSettlementService.createSettlement(
        testTransactionId, 
        150, 
        PaymentMode.MAYA, 
        testCashierId
      );

      // Credit card payment
      await PaymentSettlementService.createSettlement(
        testTransactionId, 
        250, 
        PaymentMode.CREDIT_CARD, 
        testCashierId
      );

      // Bank transfer payment to complete
      const result = await PaymentSettlementService.createSettlement(
        testTransactionId, 
        100, 
        PaymentMode.BANK_TRANSFER, 
        testCashierId
      );

      expect(result.transaction.payment_status).toBe(PaymentStatus.PAID);
      expect(result.transaction.paid_amount).toBe(1000);
      expect(result.settlements).toHaveLength(5);

      // Verify all payment modes are present
      const paymentModes = result.settlements.map(s => s.payment_mode);
      expect(paymentModes).toContain(PaymentMode.CASH);
      expect(paymentModes).toContain(PaymentMode.GCASH);
      expect(paymentModes).toContain(PaymentMode.MAYA);
      expect(paymentModes).toContain(PaymentMode.CREDIT_CARD);
      expect(paymentModes).toContain(PaymentMode.BANK_TRANSFER);
    });
  });

  describe('Over-payment Protection', () => {
    it('should prevent over-payment in single settlement', async () => {
      await expect(
        PaymentSettlementService.createSettlement(
          testTransactionId, 
          1100, // More than transaction amount
          PaymentMode.CASH, 
          testCashierId
        )
      ).rejects.toThrow('Settlement amount (1100) exceeds remaining balance (1000)');
    });

    it('should prevent over-payment in multiple settlements', async () => {
      // First payment
      await PaymentSettlementService.createSettlement(
        testTransactionId, 
        600, 
        PaymentMode.CASH, 
        testCashierId
      );

      // Second payment
      await PaymentSettlementService.createSettlement(
        testTransactionId, 
        200, 
        PaymentMode.GCASH, 
        testCashierId
      );

      // Attempt over-payment - should fail
      await expect(
        PaymentSettlementService.createSettlement(
          testTransactionId, 
          300, // Would total 1100, exceeding 1000
          PaymentMode.MAYA, 
          testCashierId
        )
      ).rejects.toThrow('Settlement amount (300) exceeds remaining balance (200)');
    });

    it('should allow exact remaining balance payment', async () => {
      // First payment
      await PaymentSettlementService.createSettlement(
        testTransactionId, 
        750, 
        PaymentMode.CASH, 
        testCashierId
      );

      // Exact remaining balance payment - should succeed
      const result = await PaymentSettlementService.createSettlement(
        testTransactionId, 
        250, 
        PaymentMode.GCASH, 
        testCashierId
      );

      expect(result.transaction.payment_status).toBe(PaymentStatus.PAID);
      expect(result.transaction.paid_amount).toBe(1000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle decimal amounts correctly', async () => {
      // Update transaction amount to decimal
      await TransactionService.update(testTransactionId, { amount: 999.99 });

      // First payment
      const result1 = await PaymentSettlementService.createSettlement(
        testTransactionId, 
        333.33, 
        PaymentMode.CASH, 
        testCashierId
      );

      expect(result1.transaction.payment_status).toBe(PaymentStatus.PARTIAL);

      // Second payment
      const result2 = await PaymentSettlementService.createSettlement(
        testTransactionId, 
        333.33, 
        PaymentMode.GCASH, 
        testCashierId
      );

      expect(result2.transaction.payment_status).toBe(PaymentStatus.PARTIAL);

      // Final payment
      const result3 = await PaymentSettlementService.createSettlement(
        testTransactionId, 
        333.33, 
        PaymentMode.MAYA, 
        testCashierId
      );

      expect(result3.transaction.payment_status).toBe(PaymentStatus.PAID);
      expect(result3.transaction.paid_amount).toBe(999.99);
    });

    it('should handle small amount payments', async () => {
      // Update transaction amount to small value
      await TransactionService.update(testTransactionId, { amount: 5.00 });

      // Small payments
      await PaymentSettlementService.createSettlement(
        testTransactionId, 
        2.50, 
        PaymentMode.CASH, 
        testCashierId
      );

      const result = await PaymentSettlementService.createSettlement(
        testTransactionId, 
        2.50, 
        PaymentMode.GCASH, 
        testCashierId
      );

      expect(result.transaction.payment_status).toBe(PaymentStatus.PAID);
      expect(result.transaction.paid_amount).toBe(5.00);
    });

    it('should handle concurrent payment attempts', async () => {
      // This test simulates race conditions that might occur in production
      const promises = [
        PaymentSettlementService.createSettlement(testTransactionId, 400, PaymentMode.CASH, testCashierId),
        PaymentSettlementService.createSettlement(testTransactionId, 300, PaymentMode.GCASH, testCashierId),
        PaymentSettlementService.createSettlement(testTransactionId, 300, PaymentMode.MAYA, testCashierId)
      ];

      // Only two should succeed, one should fail due to over-payment
      const results = await Promise.allSettled(promises);
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful).toBe(2);
      expect(failed).toBe(1);

      // Verify total paid amount doesn't exceed transaction amount
      const finalTransaction = await TransactionService.findById(testTransactionId);
      expect(finalTransaction?.paid_amount).toBeLessThanOrEqual(1000);
    });
  });

  describe('Transaction Status Updates', () => {
    it('should update payment status correctly through payment lifecycle', async () => {
      // Initially unpaid
      let transaction = await TransactionService.findById(testTransactionId);
      expect(transaction?.payment_status).toBe('paid'); // New transactions are created as paid by default

      // Reset to unpaid for testing
      await pool.query('UPDATE transactions SET paid_amount = 0, payment_status = \'unpaid\' WHERE id = $1', [testTransactionId]);

      // After partial payment
      await PaymentSettlementService.createSettlement(testTransactionId, 400, PaymentMode.CASH, testCashierId);
      transaction = await TransactionService.findById(testTransactionId);
      expect(transaction?.payment_status).toBe('partial');
      expect(transaction?.paid_amount).toBe(400);

      // After another partial payment
      await PaymentSettlementService.createSettlement(testTransactionId, 300, PaymentMode.GCASH, testCashierId);
      transaction = await TransactionService.findById(testTransactionId);
      expect(transaction?.payment_status).toBe('partial');
      expect(transaction?.paid_amount).toBe(700);

      // After final payment
      await PaymentSettlementService.createSettlement(testTransactionId, 300, PaymentMode.MAYA, testCashierId);
      transaction = await TransactionService.findById(testTransactionId);
      expect(transaction?.payment_status).toBe('paid');
      expect(transaction?.paid_amount).toBe(1000);
    });
  });

  describe('Settlement History', () => {
    it('should maintain correct settlement history', async () => {
      // Create multiple settlements
      await PaymentSettlementService.createSettlement(testTransactionId, 250, PaymentMode.CASH, testCashierId);
      await PaymentSettlementService.createSettlement(testTransactionId, 350, PaymentMode.GCASH, testCashierId);
      await PaymentSettlementService.createSettlement(testTransactionId, 400, PaymentMode.MAYA, testCashierId);

      // Get settlement history
      const settlements = await PaymentSettlementService.getSettlements(testTransactionId);

      expect(settlements).toHaveLength(3);
      expect(settlements[0].amount).toBe(400); // Most recent first
      expect(settlements[1].amount).toBe(350);
      expect(settlements[2].amount).toBe(250);

      // Verify cashier information is included
      settlements.forEach(settlement => {
        expect(settlement).toHaveProperty('cashier_name');
        expect(settlement.cashier_name).toBe('Test Cashier');
      });
    });
  });
});
