import { PaymentSettlementService } from '../services/paymentSettlementService';
import { TransactionService } from '../services/transaction';
import { PaymentMode, PaymentStatus } from '../types';
import { pool } from '../config/database';
import { WebSocketService } from '../services/websocket';

// Mock the dependencies
jest.mock('../config/database');
jest.mock('../services/transaction');
jest.mock('../services/websocket');

const mockPool = pool as jest.Mocked<typeof pool>;
const mockTransactionService = TransactionService as jest.Mocked<typeof TransactionService>;
const mockWebSocketService = WebSocketService as jest.Mocked<typeof WebSocketService>;

describe('PaymentSettlementService', () => {
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock database client
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    
    mockPool.connect = jest.fn().mockResolvedValue(mockClient);
    mockPool.query = jest.fn();
    
    // Mock WebSocket service
    mockWebSocketService.emitPaymentStatusUpdate = jest.fn();
    mockWebSocketService.emitTransactionUpdate = jest.fn();
  });

  describe('createSettlement - Input Validation', () => {
    it('should validate required fields - missing transactionId', async () => {
      await expect(
        PaymentSettlementService.createSettlement(0, 100, PaymentMode.CASH, 1)
      ).rejects.toThrow('Missing required fields');
    });

    it('should validate required fields - missing amount', async () => {
      await expect(
        PaymentSettlementService.createSettlement(1, 0, PaymentMode.CASH, 1)
      ).rejects.toThrow('Missing required fields');
    });

    it('should validate required fields - missing cashierId', async () => {
      await expect(
        PaymentSettlementService.createSettlement(1, 100, PaymentMode.CASH, 0)
      ).rejects.toThrow('Missing required fields');
    });

    it('should validate positive amount', async () => {
      await expect(
        PaymentSettlementService.createSettlement(1, -100, PaymentMode.CASH, 1)
      ).rejects.toThrow('Settlement amount must be greater than 0');
    });

    it('should validate zero amount', async () => {
      await expect(
        PaymentSettlementService.createSettlement(1, 0, PaymentMode.CASH, 1)
      ).rejects.toThrow('Missing required fields');
    });

    it('should validate payment mode', async () => {
      await expect(
        PaymentSettlementService.createSettlement(1, 100, 'invalid_mode' as PaymentMode, 1)
      ).rejects.toThrow('Invalid payment mode');
    });

    it('should accept all valid payment modes', async () => {
      const validModes = [PaymentMode.CASH, PaymentMode.GCASH, PaymentMode.MAYA, PaymentMode.CREDIT_CARD, PaymentMode.BANK_TRANSFER];
      
      for (const mode of validModes) {
        // Mock successful transaction lookup
        mockTransactionService.findById.mockResolvedValue({
          id: 1,
          amount: 1000,
          payment_status: PaymentStatus.UNPAID,
          paid_amount: 0
        } as any);
        
        // Mock current settlements (empty)
        jest.spyOn(PaymentSettlementService, 'getSettlements').mockResolvedValue([]);
        
        // Mock database operations
        mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
        mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1, amount: 100, payment_mode: mode }] }); // INSERT
        mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
        
        mockTransactionService.updatePaymentStatus.mockResolvedValue({
          id: 1,
          payment_status: PaymentStatus.PARTIAL,
          paid_amount: 100
        } as any);
        
        // This should not throw
        await expect(
          PaymentSettlementService.createSettlement(1, 100, mode, 1)
        ).resolves.not.toThrow();
      }
    });
  });

  describe('createSettlement - Business Logic', () => {
    beforeEach(() => {
      // Setup common mocks
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
    });

    it('should handle transaction not found', async () => {
      mockTransactionService.findById.mockResolvedValue(null);
      
      await expect(
        PaymentSettlementService.createSettlement(999, 100, PaymentMode.CASH, 1)
      ).rejects.toThrow('Transaction not found');
    });

    it('should prevent over-payment', async () => {
      // Mock transaction with remaining balance of 50
      mockTransactionService.findById.mockResolvedValue({
        id: 1,
        amount: 1000,
        payment_status: PaymentStatus.PARTIAL,
        paid_amount: 950
      } as any);
      
      // Mock current settlements totaling 950
      jest.spyOn(PaymentSettlementService, 'getSettlements').mockResolvedValue([
        { id: 1, amount: 950, payment_mode: PaymentMode.CASH } as any
      ]);
      
      await expect(
        PaymentSettlementService.createSettlement(1, 100, PaymentMode.CASH, 1)
      ).rejects.toThrow('Settlement amount (100) exceeds remaining balance (50)');
    });

    it('should allow exact remaining balance payment', async () => {
      // Mock transaction with remaining balance of 100
      mockTransactionService.findById.mockResolvedValue({
        id: 1,
        amount: 1000,
        payment_status: PaymentStatus.PARTIAL,
        paid_amount: 900
      } as any);
      
      // Mock current settlements totaling 900
      jest.spyOn(PaymentSettlementService, 'getSettlements').mockResolvedValue([
        { id: 1, amount: 900, payment_mode: PaymentMode.CASH } as any
      ]);
      
      // Mock successful settlement creation
      const mockSettlement = { id: 2, amount: 100, payment_mode: PaymentMode.CASH };
      mockClient.query.mockResolvedValueOnce({ rows: [mockSettlement] }); // INSERT
      
      mockTransactionService.updatePaymentStatus.mockResolvedValue({
        id: 1,
        payment_status: PaymentStatus.PAID,
        paid_amount: 1000
      } as any);
      
      jest.spyOn(PaymentSettlementService, 'getSettlements').mockResolvedValue([
        { id: 1, amount: 900, payment_mode: PaymentMode.CASH } as any,
        mockSettlement as any
      ]);
      
      const result = await PaymentSettlementService.createSettlement(1, 100, PaymentMode.CASH, 1);
      
      expect(result).toBeDefined();
      expect(result.settlements).toHaveLength(2);
      expect(result.transaction.payment_status).toBe(PaymentStatus.PAID);
    });

    it('should handle partial payment correctly', async () => {
      // Mock transaction with no previous payments
      mockTransactionService.findById.mockResolvedValue({
        id: 1,
        amount: 1000,
        payment_status: PaymentStatus.UNPAID,
        paid_amount: 0
      } as any);
      
      // Mock no current settlements
      jest.spyOn(PaymentSettlementService, 'getSettlements').mockResolvedValue([]);
      
      // Mock successful settlement creation
      const mockSettlement = { id: 1, amount: 300, payment_mode: PaymentMode.CASH };
      mockClient.query.mockResolvedValueOnce({ rows: [mockSettlement] }); // INSERT
      
      mockTransactionService.updatePaymentStatus.mockResolvedValue({
        id: 1,
        payment_status: PaymentStatus.PARTIAL,
        paid_amount: 300
      } as any);
      
      jest.spyOn(PaymentSettlementService, 'getSettlements').mockResolvedValue([
        mockSettlement as any
      ]);
      
      const result = await PaymentSettlementService.createSettlement(1, 300, PaymentMode.CASH, 1);
      
      expect(result).toBeDefined();
      expect(result.settlements).toHaveLength(1);
      expect(result.transaction.payment_status).toBe(PaymentStatus.PARTIAL);
    });

    it('should handle multiple payment modes', async () => {
      // Mock transaction with partial payment already made
      mockTransactionService.findById.mockResolvedValue({
        id: 1,
        amount: 1000,
        payment_status: PaymentStatus.PARTIAL,
        paid_amount: 400
      } as any);
      
      // Mock current settlements with different payment modes
      jest.spyOn(PaymentSettlementService, 'getSettlements').mockResolvedValue([
        { id: 1, amount: 200, payment_mode: PaymentMode.CASH } as any,
        { id: 2, amount: 200, payment_mode: PaymentMode.GCASH } as any
      ]);
      
      // Mock successful settlement creation with Maya
      const mockSettlement = { id: 3, amount: 300, payment_mode: PaymentMode.MAYA };
      mockClient.query.mockResolvedValueOnce({ rows: [mockSettlement] }); // INSERT
      
      mockTransactionService.updatePaymentStatus.mockResolvedValue({
        id: 1,
        payment_status: PaymentStatus.PARTIAL,
        paid_amount: 700
      } as any);
      
      jest.spyOn(PaymentSettlementService, 'getSettlements').mockResolvedValue([
        { id: 1, amount: 200, payment_mode: PaymentMode.CASH } as any,
        { id: 2, amount: 200, payment_mode: PaymentMode.GCASH } as any,
        mockSettlement as any
      ]);
      
      const result = await PaymentSettlementService.createSettlement(1, 300, PaymentMode.MAYA, 1);
      
      expect(result).toBeDefined();
      expect(result.settlements).toHaveLength(3);
      expect(result.transaction.payment_status).toBe(PaymentStatus.PARTIAL);
    });

    it('should emit WebSocket updates', async () => {
      // Mock successful settlement
      mockTransactionService.findById.mockResolvedValue({
        id: 1,
        amount: 1000,
        payment_status: PaymentStatus.UNPAID,
        paid_amount: 0
      } as any);
      
      jest.spyOn(PaymentSettlementService, 'getSettlements').mockResolvedValue([]);
      
      const mockSettlement = { id: 1, amount: 500, payment_mode: PaymentMode.CASH };
      mockClient.query.mockResolvedValueOnce({ rows: [mockSettlement] }); // INSERT
      
      const mockUpdatedTransaction = {
        id: 1,
        payment_status: PaymentStatus.PARTIAL,
        paid_amount: 500,
        customer_id: 123,
        or_number: 'OR-001'
      };
      
      mockTransactionService.updatePaymentStatus.mockResolvedValue(mockUpdatedTransaction as any);
      
      jest.spyOn(PaymentSettlementService, 'getSettlements').mockResolvedValue([
        mockSettlement as any
      ]);
      
      await PaymentSettlementService.createSettlement(1, 500, PaymentMode.CASH, 1);
      
      expect(mockWebSocketService.emitPaymentStatusUpdate).toHaveBeenCalledWith({
        transactionId: 1,
        payment_status: PaymentStatus.PARTIAL,
        balance_amount: 500, // 1000 - 500
        paid_amount: 500,
        customer_id: 123,
        or_number: 'OR-001',
        updatedBy: 'Cashier ID: 1'
      });
      
      expect(mockWebSocketService.emitTransactionUpdate).toHaveBeenCalledWith({
        type: 'payment_settlement_created',
        transaction: mockUpdatedTransaction,
        settlement: mockSettlement,
        timestamp: expect.any(Date)
      });
    });

    it('should rollback on error', async () => {
      mockTransactionService.findById.mockResolvedValue({
        id: 1,
        amount: 1000,
        payment_status: PaymentStatus.UNPAID,
        paid_amount: 0
      } as any);
      
      jest.spyOn(PaymentSettlementService, 'getSettlements').mockResolvedValue([]);
      
      // Mock database error
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));
      
      await expect(
        PaymentSettlementService.createSettlement(1, 500, PaymentMode.CASH, 1)
      ).rejects.toThrow('Database error');
      
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('getSettlements', () => {
    it('should return settlements for a transaction', async () => {
      const mockSettlements = [
        {
          id: 1,
          transaction_id: 1,
          amount: 300,
          payment_mode: PaymentMode.CASH,
          paid_at: new Date(),
          cashier_id: 1,
          cashier_name: 'John Doe'
        },
        {
          id: 2,
          transaction_id: 1,
          amount: 200,
          payment_mode: PaymentMode.GCASH,
          paid_at: new Date(),
          cashier_id: 2,
          cashier_name: 'Jane Smith'
        }
      ];
      
      mockPool.query.mockResolvedValue({ rows: mockSettlements } as any);
      
      const result = await PaymentSettlementService.getSettlements(1);
      
      expect(result).toEqual(mockSettlements);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [1]
      );
    });

    it('should return empty array for transaction with no settlements', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as any);
      
      const result = await PaymentSettlementService.getSettlements(999);
      
      expect(result).toEqual([]);
    });

    it('should include cashier information', async () => {
      const mockSettlement = {
        id: 1,
        transaction_id: 1,
        amount: 500,
        payment_mode: PaymentMode.CASH,
        paid_at: new Date(),
        cashier_id: 1,
        cashier_name: 'John Doe'
      };
      
      mockPool.query.mockResolvedValue({ rows: [mockSettlement] } as any);
      
      const result = await PaymentSettlementService.getSettlements(1);
      
      expect(result[0]).toHaveProperty('cashier_name', 'John Doe');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LEFT JOIN users u ON ps.cashier_id = u.id'),
        [1]
      );
    });
  });

  describe('Amount Calculations', () => {
    it('should calculate remaining balance correctly with decimal amounts', async () => {
      mockTransactionService.findById.mockResolvedValue({
        id: 1,
        amount: 999.99,
        payment_status: PaymentStatus.PARTIAL,
        paid_amount: 250.50
      } as any);
      
      jest.spyOn(PaymentSettlementService, 'getSettlements').mockResolvedValue([
        { id: 1, amount: 250.50, payment_mode: PaymentMode.CASH } as any
      ]);
      
      const mockSettlement = { id: 2, amount: 249.49, payment_mode: PaymentMode.GCASH };
      mockClient.query.mockResolvedValueOnce({ rows: [mockSettlement] }); // INSERT
      
      mockTransactionService.updatePaymentStatus.mockResolvedValue({
        id: 1,
        payment_status: PaymentStatus.PARTIAL,
        paid_amount: 499.99
      } as any);
      
      jest.spyOn(PaymentSettlementService, 'getSettlements').mockResolvedValue([
        { id: 1, amount: 250.50, payment_mode: PaymentMode.CASH } as any,
        mockSettlement as any
      ]);
      
      const result = await PaymentSettlementService.createSettlement(1, 249.49, PaymentMode.GCASH, 1);
      
      expect(result).toBeDefined();
      expect(result.settlements).toHaveLength(2);
    });

    it('should handle floating point precision issues', async () => {
      mockTransactionService.findById.mockResolvedValue({
        id: 1,
        amount: 10.03,
        payment_status: PaymentStatus.PARTIAL,
        paid_amount: 5.01
      } as any);
      
      jest.spyOn(PaymentSettlementService, 'getSettlements').mockResolvedValue([
        { id: 1, amount: 5.01, payment_mode: PaymentMode.CASH } as any
      ]);
      
      const mockSettlement = { id: 2, amount: 5.02, payment_mode: PaymentMode.GCASH };
      mockClient.query.mockResolvedValueOnce({ rows: [mockSettlement] }); // INSERT
      
      mockTransactionService.updatePaymentStatus.mockResolvedValue({
        id: 1,
        payment_status: PaymentStatus.PAID,
        paid_amount: 10.03
      } as any);
      
      jest.spyOn(PaymentSettlementService, 'getSettlements').mockResolvedValue([
        { id: 1, amount: 5.01, payment_mode: PaymentMode.CASH } as any,
        mockSettlement as any
      ]);
      
      const result = await PaymentSettlementService.createSettlement(1, 5.02, PaymentMode.GCASH, 1);
      
      expect(result).toBeDefined();
      expect(result.transaction.payment_status).toBe(PaymentStatus.PAID);
    });
  });
});
