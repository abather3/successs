"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const paymentSettlementService_1 = require("../../services/paymentSettlementService");
const transaction_1 = require("../../services/transaction");
const websocket_1 = require("../../services/websocket");
const types_1 = require("../../types");
const database_1 = require("../../config/database");
// Mock dependencies
jest.mock('../../config/database');
jest.mock('../../services/transaction');
jest.mock('../../services/websocket');
const mockPool = database_1.pool;
const mockTransactionService = transaction_1.TransactionService;
const mockWebSocketService = websocket_1.WebSocketService;
describe('PaymentSettlement WebSocket Emission Tests', () => {
    let mockClient;
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock database client
        mockClient = {
            query: jest.fn(),
            release: jest.fn(),
        };
        mockPool.connect = jest.fn().mockResolvedValue(mockClient);
        // Mock WebSocket service methods
        mockWebSocketService.emitTransactionUpdate = jest.fn();
        mockWebSocketService.emitSettlementCreated = jest.fn();
        mockWebSocketService.emitPaymentStatusUpdate = jest.fn();
    });
    describe('Single WebSocket Emission Verification', () => {
        it('should trigger exactly one WebSocket emission for transactionUpdated event', async () => {
            // Setup successful settlement scenario
            mockTransactionService.findById.mockResolvedValue({
                id: 1,
                amount: 1000,
                payment_status: types_1.PaymentStatus.UNPAID,
                paid_amount: 0
            });
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([]);
            // Mock successful database operations
            mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
            const mockSettlement = { id: 1, amount: 500, payment_mode: types_1.PaymentMode.CASH };
            mockClient.query.mockResolvedValueOnce({ rows: [mockSettlement] }); // INSERT
            mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
            const mockUpdatedTransaction = {
                id: 1,
                payment_status: types_1.PaymentStatus.PARTIAL,
                paid_amount: 500
            };
            mockTransactionService.updatePaymentStatus.mockResolvedValue(mockUpdatedTransaction);
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValueOnce([mockSettlement]);
            // Execute settlement creation
            await paymentSettlementService_1.PaymentSettlementService.createSettlement(1, 500, types_1.PaymentMode.CASH, 1);
            // Verify exactly one WebSocket emission for transactionUpdated
            expect(mockWebSocketService.emitTransactionUpdate).toHaveBeenCalledTimes(1);
            expect(mockWebSocketService.emitTransactionUpdate).toHaveBeenCalledWith(expect.objectContaining({
                type: 'payment_settlement_created',
                transaction: mockUpdatedTransaction,
                settlement: mockSettlement,
                timestamp: expect.any(Date)
            }), expect.any(String) // settlementRequestId
            );
        });
        it('should trigger exactly one WebSocket emission for settlementCreated event', async () => {
            // Setup successful settlement scenario
            mockTransactionService.findById.mockResolvedValue({
                id: 1,
                amount: 1000,
                payment_status: types_1.PaymentStatus.UNPAID,
                paid_amount: 0
            });
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([]);
            // Mock successful database operations
            mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
            const mockSettlement = { id: 1, amount: 500, payment_mode: types_1.PaymentMode.CASH };
            mockClient.query.mockResolvedValueOnce({ rows: [mockSettlement] }); // INSERT
            mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
            const mockUpdatedTransaction = {
                id: 1,
                payment_status: types_1.PaymentStatus.PARTIAL,
                paid_amount: 500
            };
            mockTransactionService.updatePaymentStatus.mockResolvedValue(mockUpdatedTransaction);
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValueOnce([mockSettlement]);
            // Execute settlement creation
            await paymentSettlementService_1.PaymentSettlementService.createSettlement(1, 500, types_1.PaymentMode.CASH, 1);
            // Verify exactly one WebSocket emission for settlementCreated
            expect(mockWebSocketService.emitSettlementCreated).toHaveBeenCalledTimes(1);
            expect(mockWebSocketService.emitSettlementCreated).toHaveBeenCalledWith({
                transaction_id: 1,
                settlement: mockSettlement,
                transaction: mockUpdatedTransaction
            });
        });
        it('should not emit WebSocket events if database transaction fails', async () => {
            // Setup failing settlement scenario
            mockTransactionService.findById.mockResolvedValue({
                id: 1,
                amount: 1000,
                payment_status: types_1.PaymentStatus.UNPAID,
                paid_amount: 0
            });
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([]);
            // Mock database failure after BEGIN
            mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
            mockClient.query.mockRejectedValueOnce(new Error('Database error')); // INSERT fails
            mockClient.query.mockResolvedValueOnce({ rows: [] }); // ROLLBACK
            // Execute settlement creation and expect failure
            await expect(paymentSettlementService_1.PaymentSettlementService.createSettlement(1, 500, types_1.PaymentMode.CASH, 1)).rejects.toThrow('Database error');
            // Verify no WebSocket emissions occurred
            expect(mockWebSocketService.emitTransactionUpdate).not.toHaveBeenCalled();
            expect(mockWebSocketService.emitSettlementCreated).not.toHaveBeenCalled();
        });
        it('should emit WebSocket events exactly once for multiple payment modes', async () => {
            // Test to ensure each settlement creates exactly one emission regardless of payment mode
            const testCases = [
                types_1.PaymentMode.CASH,
                types_1.PaymentMode.GCASH,
                types_1.PaymentMode.MAYA,
                types_1.PaymentMode.CREDIT_CARD,
                types_1.PaymentMode.BANK_TRANSFER
            ];
            for (const paymentMode of testCases) {
                jest.clearAllMocks();
                mockTransactionService.findById.mockResolvedValue({
                    id: 1,
                    amount: 1000,
                    payment_status: types_1.PaymentStatus.UNPAID,
                    paid_amount: 0
                });
                jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([]);
                // Mock successful database operations
                mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
                const mockSettlement = { id: 1, amount: 200, payment_mode: paymentMode };
                mockClient.query.mockResolvedValueOnce({ rows: [mockSettlement] }); // INSERT
                mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
                const mockUpdatedTransaction = {
                    id: 1,
                    payment_status: types_1.PaymentStatus.PARTIAL,
                    paid_amount: 200
                };
                mockTransactionService.updatePaymentStatus.mockResolvedValue(mockUpdatedTransaction);
                jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValueOnce([mockSettlement]);
                // Execute settlement creation
                await paymentSettlementService_1.PaymentSettlementService.createSettlement(1, 200, paymentMode, 1);
                // Verify exactly one emission for each WebSocket method
                expect(mockWebSocketService.emitTransactionUpdate).toHaveBeenCalledTimes(1);
                expect(mockWebSocketService.emitSettlementCreated).toHaveBeenCalledTimes(1);
            }
        });
        it('should emit WebSocket events exactly once for partial and full payments', async () => {
            const testCases = [
                { amount: 500, expectedStatus: types_1.PaymentStatus.PARTIAL, description: 'partial payment' },
                { amount: 1000, expectedStatus: types_1.PaymentStatus.PAID, description: 'full payment' }
            ];
            for (const testCase of testCases) {
                jest.clearAllMocks();
                mockTransactionService.findById.mockResolvedValue({
                    id: 1,
                    amount: 1000,
                    payment_status: types_1.PaymentStatus.UNPAID,
                    paid_amount: 0
                });
                jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([]);
                // Mock successful database operations
                mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
                const mockSettlement = { id: 1, amount: testCase.amount, payment_mode: types_1.PaymentMode.CASH };
                mockClient.query.mockResolvedValueOnce({ rows: [mockSettlement] }); // INSERT
                mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
                const mockUpdatedTransaction = {
                    id: 1,
                    payment_status: testCase.expectedStatus,
                    paid_amount: testCase.amount
                };
                mockTransactionService.updatePaymentStatus.mockResolvedValue(mockUpdatedTransaction);
                jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValueOnce([mockSettlement]);
                // Execute settlement creation
                await paymentSettlementService_1.PaymentSettlementService.createSettlement(1, testCase.amount, types_1.PaymentMode.CASH, 1);
                // Verify exactly one emission for each WebSocket method
                expect(mockWebSocketService.emitTransactionUpdate).toHaveBeenCalledTimes(1);
                expect(mockWebSocketService.emitSettlementCreated).toHaveBeenCalledTimes(1);
                // Verify emission content is correct for the test case
                expect(mockWebSocketService.emitTransactionUpdate).toHaveBeenCalledWith(expect.objectContaining({
                    type: 'payment_settlement_created',
                    transaction: expect.objectContaining({
                        payment_status: testCase.expectedStatus,
                        paid_amount: testCase.amount
                    }),
                    settlement: mockSettlement
                }), expect.any(String));
            }
        });
        it('should emit WebSocket events with correct tracing IDs', async () => {
            // Verify that the WebSocket emissions include proper tracing IDs for debugging
            mockTransactionService.findById.mockResolvedValue({
                id: 1,
                amount: 1000,
                payment_status: types_1.PaymentStatus.UNPAID,
                paid_amount: 0
            });
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([]);
            // Mock successful database operations
            mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
            const mockSettlement = { id: 1, amount: 500, payment_mode: types_1.PaymentMode.CASH };
            mockClient.query.mockResolvedValueOnce({ rows: [mockSettlement] }); // INSERT
            mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
            const mockUpdatedTransaction = {
                id: 1,
                payment_status: types_1.PaymentStatus.PARTIAL,
                paid_amount: 500
            };
            mockTransactionService.updatePaymentStatus.mockResolvedValue(mockUpdatedTransaction);
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValueOnce([mockSettlement]);
            // Execute settlement creation
            await paymentSettlementService_1.PaymentSettlementService.createSettlement(1, 500, types_1.PaymentMode.CASH, 1);
            // Verify that emitTransactionUpdate was called with a tracing ID
            expect(mockWebSocketService.emitTransactionUpdate).toHaveBeenCalledWith(expect.any(Object), expect.stringMatching(/^[0-9a-f-]{36}$/) // UUID format
            );
        });
    });
    describe('Edge Cases for WebSocket Emissions', () => {
        it('should handle WebSocket emission when settlement ID is generated', async () => {
            // Verify WebSocket emissions work correctly even with generated settlement IDs
            mockTransactionService.findById.mockResolvedValue({
                id: 999,
                amount: 750.50,
                payment_status: types_1.PaymentStatus.UNPAID,
                paid_amount: 0
            });
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([]);
            // Mock successful database operations
            mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
            const mockSettlement = { id: 42, amount: 750.50, payment_mode: types_1.PaymentMode.GCASH };
            mockClient.query.mockResolvedValueOnce({ rows: [mockSettlement] }); // INSERT
            mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
            const mockUpdatedTransaction = {
                id: 999,
                payment_status: types_1.PaymentStatus.PAID,
                paid_amount: 750.50
            };
            mockTransactionService.updatePaymentStatus.mockResolvedValue(mockUpdatedTransaction);
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValueOnce([mockSettlement]);
            // Execute settlement creation
            await paymentSettlementService_1.PaymentSettlementService.createSettlement(999, 750.50, types_1.PaymentMode.GCASH, 5);
            // Verify exactly one emission with correct settlement data
            expect(mockWebSocketService.emitTransactionUpdate).toHaveBeenCalledTimes(1);
            expect(mockWebSocketService.emitSettlementCreated).toHaveBeenCalledTimes(1);
            expect(mockWebSocketService.emitSettlementCreated).toHaveBeenCalledWith({
                transaction_id: 999,
                settlement: expect.objectContaining({
                    id: 42,
                    amount: 750.50,
                    payment_mode: types_1.PaymentMode.GCASH
                }),
                transaction: mockUpdatedTransaction
            });
        });
        it('should not double-emit WebSocket events on successful completion', async () => {
            // This test ensures that successful completion doesn't accidentally trigger duplicate emissions
            mockTransactionService.findById.mockResolvedValue({
                id: 1,
                amount: 100,
                payment_status: types_1.PaymentStatus.UNPAID,
                paid_amount: 0
            });
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValue([]);
            // Mock successful database operations
            mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
            const mockSettlement = { id: 1, amount: 100, payment_mode: types_1.PaymentMode.CASH };
            mockClient.query.mockResolvedValueOnce({ rows: [mockSettlement] }); // INSERT
            mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT
            const mockUpdatedTransaction = {
                id: 1,
                payment_status: types_1.PaymentStatus.PAID,
                paid_amount: 100
            };
            mockTransactionService.updatePaymentStatus.mockResolvedValue(mockUpdatedTransaction);
            jest.spyOn(paymentSettlementService_1.PaymentSettlementService, 'getSettlements').mockResolvedValueOnce([mockSettlement]);
            // Execute settlement creation
            const result = await paymentSettlementService_1.PaymentSettlementService.createSettlement(1, 100, types_1.PaymentMode.CASH, 1);
            // Verify the settlement was successful
            expect(result.transaction.payment_status).toBe(types_1.PaymentStatus.PAID);
            // Verify exactly one emission (no duplicates)
            expect(mockWebSocketService.emitTransactionUpdate).toHaveBeenCalledTimes(1);
            expect(mockWebSocketService.emitSettlementCreated).toHaveBeenCalledTimes(1);
        });
    });
});
//# sourceMappingURL=websocket-emission.test.js.map