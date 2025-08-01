"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const paymentSettlementService_1 = require("../services/paymentSettlementService");
const transaction_1 = require("../services/transaction");
const types_1 = require("../types");
const database_1 = require("../config/database");
const websocket_1 = require("../services/websocket");
// Mock the dependencies
jest.mock('../config/database');
jest.mock('../services/transaction');
jest.mock('../services/websocket');
const mockPool = database_1.pool;
const mockTransactionService = transaction_1.TransactionService;
const mockWebSocketService = websocket_1.WebSocketService;
describe('PaymentSettlementService', () => {
    let mockClient;
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
            await expect(paymentSettlementService_1.PaymentSettlementService.createSettlement(0, 100, types_1.PaymentMode.CASH, 1)).rejects.toThrow('Missing required fields');
        });
        it('should validate required fields - missing amount', async () => {
            await expect(paymentSettlementService_1.PaymentSettlementService.createSettlement(1, 0, types_1.PaymentMode.CASH, 1)).rejects.toThrow('Missing required fields');
        });
        it('should validate required fields - missing cashierId', async () => {
            await expect(paymentSettlementService_1.PaymentSettlementService.createSettlement(1, 100, types_1.PaymentMode.CASH, 0)).rejects.toThrow('Missing required fields');
        });
        it('should validate positive amount', async () => {
            await expect(paymentSettlementService_1.PaymentSettlementService.createSettlement(1, -100, types_1.PaymentMode.CASH, 1)).rejects.toThrow('Settlement amount must be greater than 0');
        });
        it('should validate zero amount', async () => {
            await expect(paymentSettlementService_1.PaymentSettlementService.createSettlement(1, 0, types_1.PaymentMode.CASH, 1)).rejects.toThrow('Missing required fields');
        });
        it('should validate payment mode', async () => {
            await expect(paymentSettlementService_1.PaymentSettlementService.createSettlement(1, 100, 'invalid_mode', 1)).rejects.toThrow('Invalid payment mode');
        });
        it('should accept all valid payment modes', async () => {
            const validModes = [types_1.PaymentMode.CASH, types_1.PaymentMode.GCASH, types_1.PaymentMode.MAYA, types_1.PaymentMode.CREDIT_CARD, types_1.PaymentMode.BANK_TRANSFER];
            for (const mode of validModes) {
                // Mock successful transaction lookup
                mockTransactionService.findById.mockResolvedValue({
                    id: 1,
                    amount: 1000,
                    payment_status: types_1.PaymentStatus.UNPAID,
                    paid_amount: 0
                });
                // Mock current settlements (empty)
                jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([]);
                // Mock database operations
                mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
                mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1, amount: 100, payment_mode: mode }] }); // INSERT
                mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
                mockTransactionService.updatePaymentStatus.mockResolvedValue({
                    id: 1,
                    payment_status: types_1.PaymentStatus.PARTIAL,
                    paid_amount: 100
                });
                // This should not throw
                await expect(paymentSettlementService_1.PaymentSettlementService.createSettlement(1, 100, mode, 1)).resolves.not.toThrow();
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
            await expect(paymentSettlementService_1.PaymentSettlementService.createSettlement(999, 100, types_1.PaymentMode.CASH, 1)).rejects.toThrow('Transaction not found');
        });
        it('should prevent over-payment', async () => {
            // Mock transaction with remaining balance of 50
            mockTransactionService.findById.mockResolvedValue({
                id: 1,
                amount: 1000,
                payment_status: types_1.PaymentStatus.PARTIAL,
                paid_amount: 950
            });
            // Mock current settlements totaling 950
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([
                { id: 1, amount: 950, payment_mode: types_1.PaymentMode.CASH }
            ]);
            await expect(paymentSettlementService_1.PaymentSettlementService.createSettlement(1, 100, types_1.PaymentMode.CASH, 1)).rejects.toThrow('Settlement amount (100) exceeds remaining balance (50)');
        });
        it('should allow exact remaining balance payment', async () => {
            // Mock transaction with remaining balance of 100
            mockTransactionService.findById.mockResolvedValue({
                id: 1,
                amount: 1000,
                payment_status: types_1.PaymentStatus.PARTIAL,
                paid_amount: 900
            });
            // Mock current settlements totaling 900
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([
                { id: 1, amount: 900, payment_mode: types_1.PaymentMode.CASH }
            ]);
            // Mock successful settlement creation
            const mockSettlement = { id: 2, amount: 100, payment_mode: types_1.PaymentMode.CASH };
            mockClient.query.mockResolvedValueOnce({ rows: [mockSettlement] }); // INSERT
            mockTransactionService.updatePaymentStatus.mockResolvedValue({
                id: 1,
                payment_status: types_1.PaymentStatus.PAID,
                paid_amount: 1000
            });
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([
                { id: 1, amount: 900, payment_mode: types_1.PaymentMode.CASH },
                mockSettlement
            ]);
            const result = await paymentSettlementService_1.PaymentSettlementService.createSettlement(1, 100, types_1.PaymentMode.CASH, 1);
            expect(result).toBeDefined();
            expect(result.settlements).toHaveLength(2);
            expect(result.transaction.payment_status).toBe(types_1.PaymentStatus.PAID);
        });
        it('should handle partial payment correctly', async () => {
            // Mock transaction with no previous payments
            mockTransactionService.findById.mockResolvedValue({
                id: 1,
                amount: 1000,
                payment_status: types_1.PaymentStatus.UNPAID,
                paid_amount: 0
            });
            // Mock no current settlements
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([]);
            // Mock successful settlement creation
            const mockSettlement = { id: 1, amount: 300, payment_mode: types_1.PaymentMode.CASH };
            mockClient.query.mockResolvedValueOnce({ rows: [mockSettlement] }); // INSERT
            mockTransactionService.updatePaymentStatus.mockResolvedValue({
                id: 1,
                payment_status: types_1.PaymentStatus.PARTIAL,
                paid_amount: 300
            });
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([
                mockSettlement
            ]);
            const result = await paymentSettlementService_1.PaymentSettlementService.createSettlement(1, 300, types_1.PaymentMode.CASH, 1);
            expect(result).toBeDefined();
            expect(result.settlements).toHaveLength(1);
            expect(result.transaction.payment_status).toBe(types_1.PaymentStatus.PARTIAL);
        });
        it('should handle multiple payment modes', async () => {
            // Mock transaction with partial payment already made
            mockTransactionService.findById.mockResolvedValue({
                id: 1,
                amount: 1000,
                payment_status: types_1.PaymentStatus.PARTIAL,
                paid_amount: 400
            });
            // Mock current settlements with different payment modes
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([
                { id: 1, amount: 200, payment_mode: types_1.PaymentMode.CASH },
                { id: 2, amount: 200, payment_mode: types_1.PaymentMode.GCASH }
            ]);
            // Mock successful settlement creation with Maya
            const mockSettlement = { id: 3, amount: 300, payment_mode: types_1.PaymentMode.MAYA };
            mockClient.query.mockResolvedValueOnce({ rows: [mockSettlement] }); // INSERT
            mockTransactionService.updatePaymentStatus.mockResolvedValue({
                id: 1,
                payment_status: types_1.PaymentStatus.PARTIAL,
                paid_amount: 700
            });
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([
                { id: 1, amount: 200, payment_mode: types_1.PaymentMode.CASH },
                { id: 2, amount: 200, payment_mode: types_1.PaymentMode.GCASH },
                mockSettlement
            ]);
            const result = await paymentSettlementService_1.PaymentSettlementService.createSettlement(1, 300, types_1.PaymentMode.MAYA, 1);
            expect(result).toBeDefined();
            expect(result.settlements).toHaveLength(3);
            expect(result.transaction.payment_status).toBe(types_1.PaymentStatus.PARTIAL);
        });
        it('should emit WebSocket updates', async () => {
            // Mock successful settlement
            mockTransactionService.findById.mockResolvedValue({
                id: 1,
                amount: 1000,
                payment_status: types_1.PaymentStatus.UNPAID,
                paid_amount: 0
            });
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([]);
            const mockSettlement = { id: 1, amount: 500, payment_mode: types_1.PaymentMode.CASH };
            mockClient.query.mockResolvedValueOnce({ rows: [mockSettlement] }); // INSERT
            const mockUpdatedTransaction = {
                id: 1,
                payment_status: types_1.PaymentStatus.PARTIAL,
                paid_amount: 500,
                customer_id: 123,
                or_number: 'OR-001'
            };
            mockTransactionService.updatePaymentStatus.mockResolvedValue(mockUpdatedTransaction);
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([
                mockSettlement
            ]);
            await paymentSettlementService_1.PaymentSettlementService.createSettlement(1, 500, types_1.PaymentMode.CASH, 1);
            expect(mockWebSocketService.emitPaymentStatusUpdate).toHaveBeenCalledWith({
                transactionId: 1,
                payment_status: types_1.PaymentStatus.PARTIAL,
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
                payment_status: types_1.PaymentStatus.UNPAID,
                paid_amount: 0
            });
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([]);
            // Mock database error
            mockClient.query.mockRejectedValueOnce(new Error('Database error'));
            await expect(paymentSettlementService_1.PaymentSettlementService.createSettlement(1, 500, types_1.PaymentMode.CASH, 1)).rejects.toThrow('Database error');
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
                    payment_mode: types_1.PaymentMode.CASH,
                    paid_at: new Date(),
                    cashier_id: 1,
                    cashier_name: 'John Doe'
                },
                {
                    id: 2,
                    transaction_id: 1,
                    amount: 200,
                    payment_mode: types_1.PaymentMode.GCASH,
                    paid_at: new Date(),
                    cashier_id: 2,
                    cashier_name: 'Jane Smith'
                }
            ];
            mockPool.query.mockResolvedValue({ rows: mockSettlements });
            const result = await paymentSettlementService_1.PaymentSettlementService.getSettlements(1);
            expect(result).toEqual(mockSettlements);
            expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [1]);
        });
        it('should return empty array for transaction with no settlements', async () => {
            mockPool.query.mockResolvedValue({ rows: [] });
            const result = await paymentSettlementService_1.PaymentSettlementService.getSettlements(999);
            expect(result).toEqual([]);
        });
        it('should include cashier information', async () => {
            const mockSettlement = {
                id: 1,
                transaction_id: 1,
                amount: 500,
                payment_mode: types_1.PaymentMode.CASH,
                paid_at: new Date(),
                cashier_id: 1,
                cashier_name: 'John Doe'
            };
            mockPool.query.mockResolvedValue({ rows: [mockSettlement] });
            const result = await paymentSettlementService_1.PaymentSettlementService.getSettlements(1);
            expect(result[0]).toHaveProperty('cashier_name', 'John Doe');
            expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('LEFT JOIN users u ON ps.cashier_id = u.id'), [1]);
        });
    });
    describe('Amount Calculations', () => {
        it('should calculate remaining balance correctly with decimal amounts', async () => {
            mockTransactionService.findById.mockResolvedValue({
                id: 1,
                amount: 999.99,
                payment_status: types_1.PaymentStatus.PARTIAL,
                paid_amount: 250.50
            });
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([
                { id: 1, amount: 250.50, payment_mode: types_1.PaymentMode.CASH }
            ]);
            const mockSettlement = { id: 2, amount: 249.49, payment_mode: types_1.PaymentMode.GCASH };
            mockClient.query.mockResolvedValueOnce({ rows: [mockSettlement] }); // INSERT
            mockTransactionService.updatePaymentStatus.mockResolvedValue({
                id: 1,
                payment_status: types_1.PaymentStatus.PARTIAL,
                paid_amount: 499.99
            });
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([
                { id: 1, amount: 250.50, payment_mode: types_1.PaymentMode.CASH },
                mockSettlement
            ]);
            const result = await paymentSettlementService_1.PaymentSettlementService.createSettlement(1, 249.49, types_1.PaymentMode.GCASH, 1);
            expect(result).toBeDefined();
            expect(result.settlements).toHaveLength(2);
        });
        it('should handle floating point precision issues', async () => {
            mockTransactionService.findById.mockResolvedValue({
                id: 1,
                amount: 10.03,
                payment_status: types_1.PaymentStatus.PARTIAL,
                paid_amount: 5.01
            });
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([
                { id: 1, amount: 5.01, payment_mode: types_1.PaymentMode.CASH }
            ]);
            const mockSettlement = { id: 2, amount: 5.02, payment_mode: types_1.PaymentMode.GCASH };
            mockClient.query.mockResolvedValueOnce({ rows: [mockSettlement] }); // INSERT
            mockTransactionService.updatePaymentStatus.mockResolvedValue({
                id: 1,
                payment_status: types_1.PaymentStatus.PAID,
                paid_amount: 10.03
            });
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([
                { id: 1, amount: 5.01, payment_mode: types_1.PaymentMode.CASH },
                mockSettlement
            ]);
            const result = await paymentSettlementService_1.PaymentSettlementService.createSettlement(1, 5.02, types_1.PaymentMode.GCASH, 1);
            expect(result).toBeDefined();
            expect(result.transaction.payment_status).toBe(types_1.PaymentStatus.PAID);
        });
    });
});
//# sourceMappingURL=paymentSettlements.test.js.map