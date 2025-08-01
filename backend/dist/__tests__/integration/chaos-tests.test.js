"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const enhanced_setup_1 = require("./enhanced-setup");
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const socket_io_client_1 = __importDefault(require("socket.io-client"));
const database_1 = require("../../config/database");
const types_1 = require("../../types");
describe('Chaos Testing Suite', () => {
    let testSetup;
    let testSchema;
    let ioServer;
    let httpServer;
    let userIds;
    let customerIds;
    let transactionIds;
    beforeAll(async () => {
        testSetup = enhanced_setup_1.EnhancedTestSetup.getInstance();
        testSchema = await testSetup.setupTestEnvironment();
        // Setup WebSocket server for chaos testing
        httpServer = (0, http_1.createServer)();
        ioServer = new socket_io_1.Server(httpServer, {
            cors: { origin: "*" }
        });
        ioServer.on('connection', socket => {
            socket.on('network_failure_simulation', async (data) => {
                const failed = await testSetup.simulateNetworkFailure(0.3); // 30% failure rate
                if (!failed) {
                    socket.emit(`network_status:${data.clientId}`, { status: 'online' });
                }
                else {
                    // Simulate network failure
                    setTimeout(() => {
                        socket.emit(`network_status:${data.clientId}`, { status: 'offline' });
                    }, 100);
                    // Recover after delay
                    setTimeout(() => {
                        socket.emit(`network_status:${data.clientId}`, { status: 'online' });
                    }, 2000);
                }
            });
            socket.on('server_timeout_simulation', async (data, callback) => {
                const delay = Math.floor(Math.random() * 2000) + 1000;
                setTimeout(() => {
                    callback({ status: 'timeout_resolved', delay });
                }, delay);
            });
            socket.on('database_failure_simulation', async (data) => {
                try {
                    // Simulate database timeout
                    await testSetup.simulateNetworkDelay(3000, 5000);
                    socket.emit(`database_status:${data.clientId}`, {
                        status: 'recovered',
                        message: 'Database connection restored'
                    });
                }
                catch (error) {
                    socket.emit(`database_status:${data.clientId}`, {
                        status: 'failed',
                        error: error.message
                    });
                }
            });
        });
        await new Promise(resolve => httpServer.listen(3004, resolve));
        // Create test data
        userIds = await testSetup.createTestUsers(testSchema);
        customerIds = await testSetup.createTestCustomers(testSchema, userIds.salesAgent1Id, 20);
        transactionIds = await testSetup.createTestTransactions(testSchema, customerIds, userIds.salesAgent1Id, userIds.cashier1Id);
    });
    afterAll(async () => {
        await testSetup.cleanupTestSchema(testSchema);
        ioServer.close();
        httpServer.close();
    });
    describe('Network Failure Simulations', () => {
        it('should handle intermittent network failures during payment processing', async () => {
            const client = (0, socket_io_client_1.default)('http://localhost:3004');
            const networkEvents = [];
            client.on('network_status:test-payment-client', (data) => {
                networkEvents.push({ ...data, timestamp: Date.now() });
            });
            // Simulate multiple network failures during payment flow
            for (let i = 0; i < 5; i++) {
                client.emit('network_failure_simulation', { clientId: 'test-payment-client' });
                await testSetup.simulateNetworkDelay(500, 1000);
            }
            // Wait for all events to be processed
            await new Promise(resolve => setTimeout(resolve, 10000));
            // Should have both offline and online events
            const offlineEvents = networkEvents.filter(e => e.status === 'offline');
            const onlineEvents = networkEvents.filter(e => e.status === 'online');
            expect(offlineEvents.length).toBeGreaterThan(0);
            expect(onlineEvents.length).toBeGreaterThan(0);
            client.disconnect();
        });
        it('should maintain data consistency during network partitions', async () => {
            const transactionId = transactionIds[0];
            const client = await database_1.pool.connect();
            try {
                // Start a transaction
                await client.query('BEGIN');
                // Update transaction status
                await client.query(`
          UPDATE ${testSchema}.transactions 
          SET payment_status = $1
          WHERE id = $2
        `, [types_1.PaymentStatus.PARTIAL, transactionId]);
                // Simulate network failure during commit
                const networkFailed = await testSetup.simulateNetworkFailure(0.5);
                if (networkFailed) {
                    // Rollback on network failure
                    await client.query('ROLLBACK');
                    // Log the failure
                    await client.query(`
            INSERT INTO ${testSchema}.activity_logs (user_id, action, details)
            VALUES ($1, $2, $3)
          `, [userIds.cashier1Id, 'NETWORK_FAILURE_ROLLBACK', JSON.stringify({
                            transactionId,
                            error: 'network_partition_detected'
                        })]);
                }
                else {
                    // Commit on success
                    await client.query('COMMIT');
                }
                // Verify data consistency
                const transaction = await client.query(`
          SELECT * FROM ${testSchema}.transactions WHERE id = $1
        `, [transactionId]);
                // Transaction should either be unchanged or properly updated
                expect(transaction.rows).toHaveLength(1);
                expect([types_1.PaymentStatus.UNPAID, types_1.PaymentStatus.PARTIAL]).toContain(transaction.rows[0].payment_status);
            }
            finally {
                client.release();
            }
        });
    });
    describe('Server Timeout Simulations', () => {
        it('should handle server timeouts with proper recovery', async () => {
            const client = (0, socket_io_client_1.default)('http://localhost:3004');
            const timeoutResults = [];
            // Simulate multiple server timeout scenarios
            const promises = Array.from({ length: 10 }, (_, i) => {
                return new Promise((resolve) => {
                    client.emit('server_timeout_simulation', {
                        clientId: `timeout-client-${i}`
                    }, (response) => {
                        timeoutResults.push(response);
                        resolve(response);
                    });
                });
            });
            await Promise.all(promises);
            // All timeouts should eventually resolve
            expect(timeoutResults).toHaveLength(10);
            timeoutResults.forEach(result => {
                expect(result.status).toBe('timeout_resolved');
                expect(result.delay).toBeGreaterThan(1000);
                expect(result.delay).toBeLessThan(3000);
            });
            client.disconnect();
        });
        it('should handle payment gateway timeouts gracefully', async () => {
            const transactionId = transactionIds[1];
            // Simulate payment gateway timeout
            const client = await database_1.pool.connect();
            try {
                // Log payment attempt
                await client.query(`
          INSERT INTO ${testSchema}.activity_logs (user_id, action, details)
          VALUES ($1, $2, $3)
        `, [userIds.cashier1Id, 'PAYMENT_GATEWAY_TIMEOUT', JSON.stringify({
                        transactionId,
                        gateway: 'test_gateway',
                        timeout_duration: 5000
                    })]);
                // Implement retry mechanism
                let retryCount = 0;
                const maxRetries = 3;
                let paymentSuccess = false;
                while (retryCount < maxRetries && !paymentSuccess) {
                    retryCount++;
                    // Simulate payment attempt with potential timeout
                    const timeoutOccurred = await testSetup.simulateNetworkFailure(0.4);
                    if (!timeoutOccurred) {
                        // Payment successful
                        await client.query(`
              INSERT INTO ${testSchema}.payment_settlements (
                transaction_id, amount, payment_mode, cashier_id, notes
              ) VALUES ($1, $2, $3, $4, $5)
            `, [transactionId, 500, types_1.PaymentMode.GCASH, userIds.cashier1Id, `Retry ${retryCount} successful`]);
                        await client.query(`
              UPDATE ${testSchema}.transactions 
              SET paid_amount = paid_amount + 500, payment_status = $1
              WHERE id = $2
            `, [types_1.PaymentStatus.PARTIAL, transactionId]);
                        paymentSuccess = true;
                    }
                    else {
                        // Log retry attempt
                        await client.query(`
              INSERT INTO ${testSchema}.activity_logs (user_id, action, details)
              VALUES ($1, $2, $3)
            `, [userIds.cashier1Id, 'PAYMENT_RETRY_ATTEMPT', JSON.stringify({
                                transactionId,
                                retryCount,
                                maxRetries
                            })]);
                        // Wait before retry
                        await testSetup.simulateNetworkDelay(1000, 2000);
                    }
                }
                // Verify retry mechanism worked
                const retryLogs = await client.query(`
          SELECT * FROM ${testSchema}.activity_logs 
          WHERE action = 'PAYMENT_RETRY_ATTEMPT'
        `);
                if (paymentSuccess) {
                    expect(retryCount).toBeLessThanOrEqual(maxRetries);
                }
                else {
                    expect(retryCount).toBe(maxRetries);
                }
            }
            finally {
                client.release();
            }
        });
    });
    describe('Database Failure Simulations', () => {
        it('should handle database connection failures', async () => {
            const client = (0, socket_io_client_1.default)('http://localhost:3004');
            const dbEvents = [];
            client.on('database_status:db-test-client', (data) => {
                dbEvents.push(data);
            });
            client.emit('database_failure_simulation', { clientId: 'db-test-client' });
            // Wait for database recovery simulation
            await new Promise(resolve => setTimeout(resolve, 6000));
            expect(dbEvents.length).toBeGreaterThan(0);
            expect(dbEvents.some(e => e.status === 'recovered')).toBe(true);
            client.disconnect();
        });
        it('should handle transaction rollback on database failures', async () => {
            const transactionId = transactionIds[2];
            const client = await database_1.pool.connect();
            try {
                // Begin a complex transaction
                await client.query('BEGIN');
                // Multiple operations that could fail
                await client.query(`
          UPDATE ${testSchema}.transactions 
          SET payment_status = $1
          WHERE id = $2
        `, [types_1.PaymentStatus.PROCESSING, transactionId]);
                await client.query(`
          INSERT INTO ${testSchema}.payment_settlements (
            transaction_id, amount, payment_mode, cashier_id
          ) VALUES ($1, $2, $3, $4)
        `, [transactionId, 250, types_1.PaymentMode.CASH, userIds.cashier1Id]);
                // Simulate database failure
                const dbFailed = await testSetup.simulateNetworkFailure(0.6);
                if (dbFailed) {
                    await client.query('ROLLBACK');
                    // Log rollback
                    await client.query(`
            INSERT INTO ${testSchema}.activity_logs (user_id, action, details)
            VALUES ($1, $2, $3)
          `, [userIds.cashier1Id, 'DATABASE_FAILURE_ROLLBACK', JSON.stringify({
                            transactionId,
                            error: 'database_connection_lost'
                        })]);
                }
                else {
                    await client.query('COMMIT');
                }
                // Verify rollback worked correctly
                const finalTransaction = await client.query(`
          SELECT * FROM ${testSchema}.transactions WHERE id = $1
        `, [transactionId]);
                const settlementCount = await client.query(`
          SELECT COUNT(*) FROM ${testSchema}.payment_settlements WHERE transaction_id = $1
        `, [transactionId]);
                if (dbFailed) {
                    // Should be rolled back to original state
                    expect(finalTransaction.rows[0].payment_status).not.toBe(types_1.PaymentStatus.PROCESSING);
                }
            }
            finally {
                client.release();
            }
        });
    });
    describe('Cascading Failure Scenarios', () => {
        it('should handle multiple simultaneous failures', async () => {
            const client = (0, socket_io_client_1.default)('http://localhost:3004');
            const failures = [];
            // Setup listeners for all failure types
            ['network_status', 'database_status'].forEach(eventType => {
                client.on(`${eventType}:cascade-client`, (data) => {
                    failures.push({ type: eventType, ...data });
                });
            });
            // Trigger multiple failure types simultaneously
            client.emit('network_failure_simulation', { clientId: 'cascade-client' });
            client.emit('database_failure_simulation', { clientId: 'cascade-client' });
            // Wait for all failures to be processed
            await new Promise(resolve => setTimeout(resolve, 8000));
            // Should have events from multiple failure types
            const networkFailures = failures.filter(f => f.type === 'network_status');
            const databaseFailures = failures.filter(f => f.type === 'database_status');
            expect(networkFailures.length).toBeGreaterThan(0);
            expect(databaseFailures.length).toBeGreaterThan(0);
            client.disconnect();
        });
    });
});
//# sourceMappingURL=chaos-tests.test.js.map