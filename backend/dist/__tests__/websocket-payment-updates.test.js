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
describe('WebSocket Payment Status Updates', () => {
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
    describe('emitPaymentStatusUpdate', () => {
        it('should emit payment_status_updated event with correct structure', () => {
            const testData = {
                transactionId: 123,
                payment_status: 'partial',
                balance_amount: 500.00,
                paid_amount: 1000.00,
                customer_id: 456,
                or_number: 'OR-2024-001',
                updatedBy: 'Cashier ID: 789'
            };
            websocket_1.WebSocketService.emitPaymentStatusUpdate(testData);
            // Verify it emits to payment_status:updates room
            expect(mockToFunction).toHaveBeenCalledWith('payment_status:updates');
            expect(mockToFunction).toHaveBeenCalledWith('transactions:updates');
            // Verify emit was called with correct event name and data structure
            expect(mockIO.emit).toHaveBeenCalledWith('payment_status_updated', expect.objectContaining({
                transactionId: testData.transactionId,
                payment_status: testData.payment_status,
                balance_amount: testData.balance_amount,
                paid_amount: testData.paid_amount,
                customer_id: testData.customer_id,
                or_number: testData.or_number,
                updatedBy: testData.updatedBy,
                timestamp: expect.any(Date)
            }));
        });
        it('should handle missing optional fields', () => {
            const testData = {
                transactionId: 123,
                payment_status: 'paid',
                balance_amount: 0,
                paid_amount: 1500.00
            };
            websocket_1.WebSocketService.emitPaymentStatusUpdate(testData);
            expect(mockIO.emit).toHaveBeenCalledWith('payment_status_updated', expect.objectContaining({
                transactionId: testData.transactionId,
                payment_status: testData.payment_status,
                balance_amount: testData.balance_amount,
                paid_amount: testData.paid_amount,
                customer_id: undefined,
                or_number: undefined,
                updatedBy: undefined,
                timestamp: expect.any(Date)
            }));
        });
        it('should not emit if WebSocket IO is not set', () => {
            websocket_1.WebSocketService.setIO(null);
            const testData = {
                transactionId: 123,
                payment_status: 'paid',
                balance_amount: 0,
                paid_amount: 1500.00
            };
            // Should not throw error
            expect(() => {
                websocket_1.WebSocketService.emitPaymentStatusUpdate(testData);
            }).not.toThrow();
            // Should not have called emit
            expect(mockIO.emit).not.toHaveBeenCalled();
        });
        it('should emit to both payment_status:updates and transactions:updates rooms', () => {
            const testData = {
                transactionId: 123,
                payment_status: 'partial',
                balance_amount: 500.00,
                paid_amount: 1000.00
            };
            websocket_1.WebSocketService.emitPaymentStatusUpdate(testData);
            // Verify it emits to both rooms
            expect(mockToFunction).toHaveBeenCalledWith('payment_status:updates');
            expect(mockToFunction).toHaveBeenCalledWith('transactions:updates');
            expect(mockToFunction).toHaveBeenCalledTimes(2);
        });
    });
    describe('Payment Status Values', () => {
        it('should handle unpaid status', () => {
            const testData = {
                transactionId: 123,
                payment_status: 'unpaid',
                balance_amount: 1500.00,
                paid_amount: 0
            };
            websocket_1.WebSocketService.emitPaymentStatusUpdate(testData);
            expect(mockIO.emit).toHaveBeenCalledWith('payment_status_updated', expect.objectContaining({
                payment_status: 'unpaid',
                balance_amount: 1500.00,
                paid_amount: 0
            }));
        });
        it('should handle partial payment status', () => {
            const testData = {
                transactionId: 123,
                payment_status: 'partial',
                balance_amount: 500.00,
                paid_amount: 1000.00
            };
            websocket_1.WebSocketService.emitPaymentStatusUpdate(testData);
            expect(mockIO.emit).toHaveBeenCalledWith('payment_status_updated', expect.objectContaining({
                payment_status: 'partial',
                balance_amount: 500.00,
                paid_amount: 1000.00
            }));
        });
        it('should handle paid status', () => {
            const testData = {
                transactionId: 123,
                payment_status: 'paid',
                balance_amount: 0,
                paid_amount: 1500.00
            };
            websocket_1.WebSocketService.emitPaymentStatusUpdate(testData);
            expect(mockIO.emit).toHaveBeenCalledWith('payment_status_updated', expect.objectContaining({
                payment_status: 'paid',
                balance_amount: 0,
                paid_amount: 1500.00
            }));
        });
    });
    describe('Timestamp Generation', () => {
        it('should include a timestamp in the payload', () => {
            const testData = {
                transactionId: 123,
                payment_status: 'paid',
                balance_amount: 0,
                paid_amount: 1500.00
            };
            const beforeTime = new Date();
            websocket_1.WebSocketService.emitPaymentStatusUpdate(testData);
            const afterTime = new Date();
            expect(mockIO.emit).toHaveBeenCalledWith('payment_status_updated', expect.objectContaining({
                timestamp: expect.any(Date)
            }));
            // Verify timestamp is recent
            const call = mockIO.emit.mock.calls[0];
            const payload = call[1];
            const timestamp = new Date(payload.timestamp);
            expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
            expect(timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
        });
    });
});
//# sourceMappingURL=websocket-payment-updates.test.js.map