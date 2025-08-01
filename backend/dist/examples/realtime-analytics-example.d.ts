/**
 * Real-time Notification Analytics Integration Example
 *
 * This example demonstrates how the real-time analytics service works:
 * 1. When a notification is created, stats are automatically updated via WebSocket
 * 2. When a notification is marked as read, stats are updated in real-time
 * 3. The CashierDashboard receives live updates without polling
 */
import { Server } from 'socket.io';
declare const mockCustomerData: {
    customer: {
        id: number;
        name: string;
        or_number: string;
        token_number: number;
        contact_number: string;
        priority_flags: {
            senior_citizen: boolean;
            pregnant: boolean;
            pwd: boolean;
        };
        payment_info: {
            amount: number;
            mode: string;
        };
    };
    created_by: {
        id: number;
        name: string;
        role: string;
    };
};
/**
 * Example: Simulate the complete flow
 */
export declare class RealTimeAnalyticsDemo {
    static demonstrateNotificationFlow(mockIO?: Server): Promise<void>;
    /**
     * WebSocket Event Simulation
     * Shows what events would be emitted during the flow
     */
    static simulateWebSocketEvents(): void;
    /**
     * Performance metrics demonstration
     */
    static demonstratePerformanceMetrics(): Promise<void>;
}
export declare function runRealTimeAnalyticsDemo(): Promise<void>;
export { mockCustomerData };
/**
 * Usage Instructions:
 *
 * 1. Backend Setup:
 *    - Import WebSocketService in your main server file
 *    - Call WebSocketService.setIO(io) after creating Socket.IO server
 *    - Ensure CustomerNotificationService database tables exist
 *
 * 2. Frontend Setup:
 *    - Import the CashierDashboard component
 *    - Ensure Socket.IO client is configured with proper auth token
 *    - Set REACT_APP_WEBSOCKET_URL environment variable
 *
 * 3. Testing:
 *    - Run this demo script to see the full flow
 *    - Create test notifications via API or admin panel
 *    - Watch real-time updates in the CashierDashboard
 *
 * 4. Production Considerations:
 *    - Add proper error handling and reconnection logic
 *    - Implement rate limiting for WebSocket events
 *    - Add monitoring for WebSocket connection health
 *    - Consider using Redis for multi-server deployments
 */
//# sourceMappingURL=realtime-analytics-example.d.ts.map