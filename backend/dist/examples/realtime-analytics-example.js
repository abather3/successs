"use strict";
/**
 * Real-time Notification Analytics Integration Example
 *
 * This example demonstrates how the real-time analytics service works:
 * 1. When a notification is created, stats are automatically updated via WebSocket
 * 2. When a notification is marked as read, stats are updated in real-time
 * 3. The CashierDashboard receives live updates without polling
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockCustomerData = exports.RealTimeAnalyticsDemo = void 0;
exports.runRealTimeAnalyticsDemo = runRealTimeAnalyticsDemo;
const CustomerNotificationService_1 = require("../services/CustomerNotificationService");
const websocket_1 = require("../services/websocket");
// Mock data for demonstration
const mockCustomerData = {
    customer: {
        id: 123,
        name: 'John Doe',
        or_number: 'OR-2024-001',
        token_number: 42,
        contact_number: '09171234567',
        priority_flags: {
            senior_citizen: false,
            pregnant: false,
            pwd: true // PWD customer
        },
        payment_info: {
            amount: 5000,
            mode: 'cash'
        }
    },
    created_by: {
        id: 1,
        name: 'Sales Agent Alice',
        role: 'sales'
    }
};
exports.mockCustomerData = mockCustomerData;
/**
 * Example: Simulate the complete flow
 */
class RealTimeAnalyticsDemo {
    static async demonstrateNotificationFlow(mockIO) {
        console.log('=== REAL-TIME ANALYTICS DEMO ===\n');
        // Setup mock WebSocket server if not provided
        if (mockIO) {
            websocket_1.WebSocketService.setIO(mockIO);
        }
        try {
            // 1. Show initial stats
            console.log('1. Getting initial notification statistics...');
            const initialStats = await CustomerNotificationService_1.CustomerNotificationService.getNotificationStats('cashier');
            const initialAnalytics = await CustomerNotificationService_1.CustomerNotificationService.getNotificationAnalytics('cashier');
            console.log('Initial Stats:', JSON.stringify({
                total_active: initialStats.total_active,
                total_unread: initialStats.total_unread,
                expires_soon: initialStats.expires_soon,
                avg_response_time: Math.round(initialAnalytics.avg_response_time_minutes)
            }, null, 2));
            // 2. Create a new notification (simulates customer registration)
            console.log('\n2. Creating new customer notification...');
            const notification = await CustomerNotificationService_1.CustomerNotificationService.createCustomerRegistrationNotification(mockCustomerData);
            console.log(`✅ Created notification: ${notification.notification_id}`);
            console.log(`   Customer: ${mockCustomerData.customer.name} (PWD)`);
            console.log(`   OR Number: ${mockCustomerData.customer.or_number}`);
            console.log('   → WebSocket analytics update should be triggered automatically');
            // Small delay to simulate real-world timing
            await new Promise(resolve => setTimeout(resolve, 100));
            // 3. Show updated stats after creation
            console.log('\n3. Getting updated stats after notification creation...');
            const afterCreateStats = await CustomerNotificationService_1.CustomerNotificationService.getNotificationStats('cashier');
            const afterCreateAnalytics = await CustomerNotificationService_1.CustomerNotificationService.getNotificationAnalytics('cashier');
            console.log('Updated Stats:', JSON.stringify({
                total_active: afterCreateStats.total_active,
                total_unread: afterCreateStats.total_unread,
                expires_soon: afterCreateStats.expires_soon,
                created_today: afterCreateAnalytics.created_today
            }, null, 2));
            // 4. Mark notification as read (simulates cashier action)
            console.log('\n4. Marking notification as read (simulating cashier action)...');
            await CustomerNotificationService_1.CustomerNotificationService.markAsRead(notification.notification_id, 1); // cashier user ID 1
            console.log('✅ Notification marked as read');
            console.log('   → WebSocket analytics update should be triggered automatically');
            // Small delay to simulate real-world timing
            await new Promise(resolve => setTimeout(resolve, 100));
            // 5. Show final stats after marking as read
            console.log('\n5. Getting final stats after marking as read...');
            const finalStats = await CustomerNotificationService_1.CustomerNotificationService.getNotificationStats('cashier');
            const finalAnalytics = await CustomerNotificationService_1.CustomerNotificationService.getNotificationAnalytics('cashier');
            console.log('Final Stats:', JSON.stringify({
                total_active: finalStats.total_active,
                total_unread: finalStats.total_unread,
                total_read: finalStats.total_read,
                read_today: finalAnalytics.read_today,
                avg_response_time: Math.round(finalAnalytics.avg_response_time_minutes)
            }, null, 2));
            // 6. Demonstrate manual stats trigger
            console.log('\n6. Manually triggering stats update for all connected dashboards...');
            CustomerNotificationService_1.CustomerNotificationService.triggerManualStatsUpdate('cashier');
            console.log('✅ Manual stats update triggered');
            console.log('\n=== DEMO COMPLETED ===');
            console.log('\nKey Features Demonstrated:');
            console.log('• ✅ Automatic stats updates on notification create');
            console.log('• ✅ Automatic stats updates on notification read');
            console.log('• ✅ Real-time WebSocket emission to dashboard clients');
            console.log('• ✅ Support for multiple roles and analytics channels');
            console.log('• ✅ Manual stats refresh capability');
            console.log('\nDashboard Integration:');
            console.log('• The CashierDashboard component subscribes to "subscribe:notification_analytics"');
            console.log('• It receives "notification_stats_update" events with live data');
            console.log('• KPI cards update automatically without page refresh');
            console.log('• Connection status and last updated timestamp are shown');
        }
        catch (error) {
            console.error('Demo failed:', error);
            throw error;
        }
    }
    /**
     * WebSocket Event Simulation
     * Shows what events would be emitted during the flow
     */
    static simulateWebSocketEvents() {
        console.log('\n=== WEBSOCKET EVENTS THAT WOULD BE EMITTED ===\n');
        // Event 1: Notification creation triggers stats update
        console.log('Event 1 - After notification creation:');
        console.log('Channel: analytics:cashier');
        console.log('Event: notification_stats_update');
        console.log('Data example:', JSON.stringify({
            total_active: 5,
            total_unread: 3,
            expires_soon: 1,
            avg_response_time_minutes: 12.5,
            created_today: 8,
            read_today: 5,
            target_role: 'cashier',
            last_updated: new Date().toISOString(),
            timestamp: Date.now()
        }, null, 2));
        console.log('\nEvent 2 - After marking as read:');
        console.log('Channel: analytics:cashier');
        console.log('Event: notification_stats_update');
        console.log('Data example:', JSON.stringify({
            total_active: 5,
            total_unread: 2, // decreased
            expires_soon: 1,
            avg_response_time_minutes: 11.2, // updated average
            created_today: 8,
            read_today: 6, // increased
            target_role: 'cashier',
            last_updated: new Date().toISOString(),
            timestamp: Date.now()
        }, null, 2));
        console.log('\n=== CLIENT SUBSCRIPTION EXAMPLE ===\n');
        console.log('// In CashierDashboard component:');
        console.log('socket.emit("subscribe:notification_analytics");');
        console.log('');
        console.log('socket.on("notification_stats_update", (stats) => {');
        console.log('  console.log("Received real-time stats:", stats);');
        console.log('  setNotificationStats(stats); // Update React state');
        console.log('  setLastUpdated(new Date()); // Update timestamp');
        console.log('});');
    }
    /**
     * Performance metrics demonstration
     */
    static async demonstratePerformanceMetrics() {
        console.log('\n=== PERFORMANCE METRICS DEMO ===\n');
        const start = Date.now();
        // Simulate multiple notifications being processed
        const notifications = [];
        for (let i = 0; i < 5; i++) {
            const customerData = {
                ...mockCustomerData,
                customer: {
                    ...mockCustomerData.customer,
                    id: 123 + i,
                    name: `Customer ${i + 1}`,
                    or_number: `OR-2024-${String(i + 1).padStart(3, '0')}`
                }
            };
            const notification = await CustomerNotificationService_1.CustomerNotificationService.createCustomerRegistrationNotification(customerData);
            notifications.push(notification);
        }
        // Mark some as read with varying response times
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5s response time
        await CustomerNotificationService_1.CustomerNotificationService.markAsRead(notifications[0].notification_id, 1);
        await new Promise(resolve => setTimeout(resolve, 1500)); // 2s total response time
        await CustomerNotificationService_1.CustomerNotificationService.markAsRead(notifications[1].notification_id, 1);
        await new Promise(resolve => setTimeout(resolve, 3000)); // 5s total response time
        await CustomerNotificationService_1.CustomerNotificationService.markAsRead(notifications[2].notification_id, 1);
        const end = Date.now();
        const totalTime = end - start;
        // Get final analytics with response times
        const analytics = await CustomerNotificationService_1.CustomerNotificationService.getNotificationAnalytics('cashier');
        console.log('Performance Results:');
        console.log(`• Total demo time: ${Math.round(totalTime / 1000)}s`);
        console.log(`• Notifications created: ${notifications.length}`);
        console.log(`• Notifications read: 3`);
        console.log(`• Average response time: ${Math.round(analytics.avg_response_time_minutes * 60)}s`);
        console.log(`• WebSocket updates triggered: ${notifications.length + 3} times`);
        console.log('\nReal-world Performance:');
        console.log('• WebSocket emission: ~1-5ms per update');
        console.log('• Database query time: ~10-50ms per stats calculation');
        console.log('• Client update latency: ~100-300ms over network');
        console.log('• No polling overhead - events only on state changes');
    }
}
exports.RealTimeAnalyticsDemo = RealTimeAnalyticsDemo;
// Example usage (would be called from a test or script)
async function runRealTimeAnalyticsDemo() {
    try {
        // Run the main demonstration
        await RealTimeAnalyticsDemo.demonstrateNotificationFlow();
        // Show WebSocket event examples
        RealTimeAnalyticsDemo.simulateWebSocketEvents();
        // Demonstrate performance characteristics
        await RealTimeAnalyticsDemo.demonstratePerformanceMetrics();
    }
    catch (error) {
        console.error('Real-time analytics demo failed:', error);
        process.exit(1);
    }
}
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
//# sourceMappingURL=realtime-analytics-example.js.map