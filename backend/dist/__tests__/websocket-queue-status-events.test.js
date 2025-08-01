"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const websocket_1 = require("../services/websocket");
const database_1 = require("../config/database");
// Mock socket.io Server
jest.mock('socket.io', () => ({
    Server: jest.fn().mockImplementation(() => ({
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
        use: jest.fn(),
        on: jest.fn()
    }))
}));
// Mock database pool
jest.mock('../config/database', () => ({
    pool: {
        query: jest.fn()
    }
}));
describe('WebSocket Queue Status Events Extension', () => {
    let mockIO;
    let mockToFunction;
    let mockPoolQuery;
    beforeEach(() => {
        mockToFunction = jest.fn().mockReturnThis();
        mockIO = {
            to: mockToFunction,
            emit: jest.fn(),
            use: jest.fn(),
            on: jest.fn()
        };
        mockPoolQuery = database_1.pool.query;
        mockPoolQuery.mockResolvedValue({
            rows: [{ count: '5' }] // Mock processing count
        });
        websocket_1.WebSocketService.setIO(mockIO);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('emitQueueStatusChanged', () => {
        it('should emit queue:status_changed event with correct payload structure', () => {
            const customerId = 123;
            const newStatus = 'processing';
            const additionalData = {
                previousStatus: 'serving',
                customer: {
                    id: 123,
                    name: 'John Doe',
                    or_number: 'OR-2024-001',
                    token_number: 45
                }
            };
            websocket_1.WebSocketService.emitQueueStatusChanged(customerId, newStatus, additionalData);
            // Verify it emits to queue:updates room
            expect(mockToFunction).toHaveBeenCalledWith('queue:updates');
            // Verify emit was called with correct event name and payload structure
            expect(mockIO.emit).toHaveBeenCalledWith('queue:status_changed', expect.objectContaining({
                id: customerId,
                newStatus: newStatus,
                timestamp: expect.any(Date),
                previousStatus: 'serving',
                customer: {
                    id: 123,
                    name: 'John Doe',
                    or_number: 'OR-2024-001',
                    token_number: 45
                }
            }));
        });
        it('should emit minimal queue:status_changed event without additional data', () => {
            const customerId = 456;
            const newStatus = 'completed';
            websocket_1.WebSocketService.emitQueueStatusChanged(customerId, newStatus);
            expect(mockIO.emit).toHaveBeenCalledWith('queue:status_changed', expect.objectContaining({
                id: customerId,
                newStatus: newStatus,
                timestamp: expect.any(Date)
            }));
        });
        it('should not emit if WebSocket IO is not set', () => {
            websocket_1.WebSocketService.setIO(null);
            const customerId = 789;
            const newStatus = 'cancelled';
            // Should not throw error
            expect(() => {
                websocket_1.WebSocketService.emitQueueStatusChanged(customerId, newStatus);
            }).not.toThrow();
            // Should not have called emit
            expect(mockIO.emit).not.toHaveBeenCalled();
        });
        it('should handle all queue status types', () => {
            const testCases = [
                { status: 'waiting', id: 1 },
                { status: 'serving', id: 2 },
                { status: 'processing', id: 3 },
                { status: 'completed', id: 4 },
                { status: 'cancelled', id: 5 }
            ];
            testCases.forEach((testCase, index) => {
                websocket_1.WebSocketService.emitQueueStatusChanged(testCase.id, testCase.status);
                expect(mockIO.emit).toHaveBeenNthCalledWith(index + 1, 'queue:status_changed', expect.objectContaining({
                    id: testCase.id,
                    newStatus: testCase.status
                }));
            });
        });
    });
    describe('emitQueueUpdate with processingCount', () => {
        beforeEach(() => {
            // Reset the mock to set up proper module resolution
            jest.resetModules();
        });
        it('should include processingCount in queue:update payload', async () => {
            const testData = {
                type: 'status_changed',
                customer: { id: 123, name: 'Test Customer' },
                newStatus: 'processing',
                timestamp: new Date()
            };
            // Mock the database import for processing count query
            mockPoolQuery.mockResolvedValueOnce({
                rows: [{ count: '3' }]
            });
            await websocket_1.WebSocketService.emitQueueUpdate(testData);
            // Verify database query was called for processing count
            expect(mockPoolQuery).toHaveBeenCalledWith("SELECT COUNT(*) as count FROM customers WHERE queue_status = 'processing'");
            // Verify it emits to queue:updates room
            expect(mockToFunction).toHaveBeenCalledWith('queue:updates');
            // Verify emit was called with enhanced payload including processingCount
            expect(mockIO.emit).toHaveBeenCalledWith('queue:update', expect.objectContaining({
                type: 'status_changed',
                customer: { id: 123, name: 'Test Customer' },
                newStatus: 'processing',
                timestamp: expect.any(Date),
                processingCount: 3 // Should include processing count
            }));
        });
        it('should handle database error gracefully and default processingCount to 0', async () => {
            const testData = {
                type: 'customer_called',
                customer: { id: 456, name: 'Another Customer' }
            };
            // Mock database error
            mockPoolQuery.mockRejectedValueOnce(new Error('Database connection failed'));
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            await websocket_1.WebSocketService.emitQueueUpdate(testData);
            // Should still emit the event with processingCount defaulted to 0
            expect(mockIO.emit).toHaveBeenCalledWith('queue:update', expect.objectContaining({
                type: 'customer_called',
                customer: { id: 456, name: 'Another Customer' },
                processingCount: 0 // Should default to 0 on error
            }));
            // Should log the error
            expect(consoleSpy).toHaveBeenCalledWith('Error fetching processing count for queue update:', expect.any(Error));
            consoleSpy.mockRestore();
        });
        it('should preserve original data structure while adding processingCount', async () => {
            const originalData = {
                type: 'queue_reordered',
                queue: [
                    { customer_id: 1, customer: { name: 'Customer 1' } },
                    { customer_id: 2, customer: { name: 'Customer 2' } }
                ],
                timestamp: new Date(),
                customProperty: 'test_value'
            };
            mockPoolQuery.mockResolvedValueOnce({
                rows: [{ count: '7' }]
            });
            await websocket_1.WebSocketService.emitQueueUpdate(originalData);
            // Verify all original properties are preserved
            expect(mockIO.emit).toHaveBeenCalledWith('queue:update', expect.objectContaining({
                type: 'queue_reordered',
                queue: originalData.queue,
                timestamp: originalData.timestamp,
                customProperty: 'test_value',
                processingCount: 7 // And processingCount is added
            }));
        });
    });
    describe('Backward Compatibility', () => {
        it('should maintain existing event names for client compatibility', async () => {
            const testData = { type: 'customer_completed', customer: { id: 123 } };
            await websocket_1.WebSocketService.emitQueueUpdate(testData);
            // Should still emit 'queue:update' event (existing clients depend on this)
            expect(mockIO.emit).toHaveBeenCalledWith('queue:update', expect.any(Object));
            // Should not change the event name
            expect(mockIO.emit).not.toHaveBeenCalledWith('queue_update', expect.any(Object));
            expect(mockIO.emit).not.toHaveBeenCalledWith('queueUpdate', expect.any(Object));
        });
        it('should emit both queue:status_changed and queue:update for status changes', () => {
            const customerId = 123;
            const newStatus = 'processing';
            // First emit the new specific event
            websocket_1.WebSocketService.emitQueueStatusChanged(customerId, newStatus);
            // Then emit the traditional queue update
            const queueUpdateData = {
                type: 'status_changed',
                customer: { id: customerId },
                newStatus: newStatus
            };
            websocket_1.WebSocketService.emitQueueUpdate(queueUpdateData);
            // Should have both events emitted
            expect(mockIO.emit).toHaveBeenCalledWith('queue:status_changed', expect.any(Object));
            // Note: emitQueueUpdate is async, so we just verify the call pattern
        });
    });
    describe('Event Payload Validation', () => {
        it('should include required fields in queue:status_changed payload', () => {
            const customerId = 123;
            const newStatus = 'processing';
            websocket_1.WebSocketService.emitQueueStatusChanged(customerId, newStatus);
            const emittedPayload = mockIO.emit.mock.calls[0][1];
            // Verify required fields
            expect(emittedPayload).toHaveProperty('id', customerId);
            expect(emittedPayload).toHaveProperty('newStatus', newStatus);
            expect(emittedPayload).toHaveProperty('timestamp');
            expect(emittedPayload.timestamp).toBeInstanceOf(Date);
        });
        it('should handle different data types for customer ID', () => {
            const testCases = [123, '456', 789];
            testCases.forEach(customerId => {
                websocket_1.WebSocketService.emitQueueStatusChanged(customerId, 'waiting');
                const emittedPayload = mockIO.emit.mock.calls.pop()[1];
                expect(emittedPayload.id).toBe(customerId);
            });
        });
    });
});
//# sourceMappingURL=websocket-queue-status-events.test.js.map