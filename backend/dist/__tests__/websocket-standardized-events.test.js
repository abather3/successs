"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const websocket_1 = require("../services/websocket");
// Mock socket.io Server
jest.mock('socket.io', () => ({
    Server: jest.fn().mockImplementation(() => ({
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        use: jest.fn(),
        on: jest.fn()
    }))
}));
describe('WebSocket Standardized Events', () => {
    let mockIO;
    let mockToFunction;
    beforeEach(() => {
        mockToFunction = jest.fn().mockReturnThis();
        mockIO = {
            to: mockToFunction,
            emit: jest.fn(),
            use: jest.fn(),
            on: jest.fn()
        };
        websocket_1.WebSocketService.setIO(mockIO);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('emitTransactionUpdate', () => {
        it('should emit transactionUpdated event with correct structure', () => {
            const testData = {
                type: 'transaction_created',
                transaction: {
                    id: 123,
                    customer_id: 456,
                    or_number: 'OR-2024-001',
                    amount: 1500.00,
                    payment_status: 'unpaid'
                },
                timestamp: new Date()
            };
            websocket_1.WebSocketService.emitTransactionUpdate(testData);
            // Verify it emits to transactions:updates room
            expect(mockToFunction).toHaveBeenCalledWith('transactions:updates');
            // Verify emit was called with standardized event name and data structure
            expect(mockIO.emit).toHaveBeenCalledWith('transactionUpdated', expect.objectContaining({
                type: testData.type,
                transaction: testData.transaction,
                timestamp: expect.any(Date)
            }));
        });
        it('should handle payment_status_updated type', () => {
            const testData = {
                type: 'payment_status_updated',
                transaction: {
                    id: 123,
                    payment_status: 'partial',
                    paid_amount: 500.00,
                    balance_amount: 1000.00
                },
                timestamp: new Date()
            };
            websocket_1.WebSocketService.emitTransactionUpdate(testData);
            expect(mockIO.emit).toHaveBeenCalledWith('transactionUpdated', expect.objectContaining({
                type: 'payment_status_updated',
                transaction: testData.transaction
            }));
        });
        it('should handle transaction_deleted type', () => {
            const testData = {
                type: 'transaction_deleted',
                transactionId: 123,
                timestamp: new Date()
            };
            websocket_1.WebSocketService.emitTransactionUpdate(testData);
            expect(mockIO.emit).toHaveBeenCalledWith('transactionUpdated', expect.objectContaining({
                type: 'transaction_deleted',
                transactionId: 123
            }));
        });
        it('should not emit if WebSocket IO is not set', () => {
            websocket_1.WebSocketService.setIO(null);
            const testData = {
                type: 'transaction_created',
                transaction: { id: 123 },
                timestamp: new Date()
            };
            // Should not throw error
            expect(() => {
                websocket_1.WebSocketService.emitTransactionUpdate(testData);
            }).not.toThrow();
            // Should not have called emit
            expect(mockIO.emit).not.toHaveBeenCalled();
        });
    });
    describe('emitSettlementCreated', () => {
        it('should emit settlementCreated event with correct structure', () => {
            const testData = {
                transaction_id: 123,
                settlement: {
                    id: 45,
                    transaction_id: 123,
                    amount: 500.00,
                    payment_mode: 'cash',
                    cashier_id: 789,
                    paid_at: new Date()
                },
                transaction: {
                    id: 123,
                    customer_id: 456,
                    or_number: 'OR-2024-001',
                    amount: 1500.00,
                    payment_status: 'partial',
                    paid_amount: 500.00,
                    balance_amount: 1000.00
                }
            };
            websocket_1.WebSocketService.emitSettlementCreated(testData);
            // Verify emit was called with standardized event name and data structure
            expect(mockIO.emit).toHaveBeenCalledWith('settlementCreated', expect.objectContaining({
                transaction_id: testData.transaction_id,
                settlement: testData.settlement,
                transaction: testData.transaction
            }));
        });
        it('should handle minimal settlement data', () => {
            const testData = {
                transaction_id: 123,
                settlement: { id: 45, amount: 500.00 },
                transaction: { id: 123, payment_status: 'partial' }
            };
            websocket_1.WebSocketService.emitSettlementCreated(testData);
            expect(mockIO.emit).toHaveBeenCalledWith('settlementCreated', testData);
        });
        it('should not emit if WebSocket IO is not set', () => {
            websocket_1.WebSocketService.setIO(null);
            const testData = {
                transaction_id: 123,
                settlement: { id: 45 },
                transaction: { id: 123 }
            };
            // Should not throw error
            expect(() => {
                websocket_1.WebSocketService.emitSettlementCreated(testData);
            }).not.toThrow();
            // Should not have called emit
            expect(mockIO.emit).not.toHaveBeenCalled();
        });
    });
    describe('Event Broadcasting', () => {
        it('should broadcast settlementCreated to all clients', () => {
            const testData = {
                transaction_id: 123,
                settlement: { id: 45 },
                transaction: { id: 123 }
            };
            websocket_1.WebSocketService.emitSettlementCreated(testData);
            // settlementCreated should be broadcasted globally, not to a specific room
            expect(mockToFunction).not.toHaveBeenCalled();
            expect(mockIO.emit).toHaveBeenCalledWith('settlementCreated', testData);
        });
        it('should emit transactionUpdated to transactions:updates room only', () => {
            const testData = {
                type: 'transaction_created',
                transaction: { id: 123 },
                timestamp: new Date()
            };
            websocket_1.WebSocketService.emitTransactionUpdate(testData);
            // transactionUpdated should be sent to specific room
            expect(mockToFunction).toHaveBeenCalledWith('transactions:updates');
            expect(mockIO.emit).toHaveBeenCalledWith('transactionUpdated', testData);
        });
    });
});
//# sourceMappingURL=websocket-standardized-events.test.js.map