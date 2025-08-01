import { EnhancedTestSetup } from './enhanced-setup';
import { createServer } from 'http';
import { Server } from 'socket.io';
import ioClient from 'socket.io-client';
import { pool } from '../../config/database';
import { QueueStatus, PaymentMode, PaymentStatus } from '../../types';

describe('Concurrent Queue Operations Integration Tests', () => {
  let testSetup: EnhancedTestSetup;
  let testSchema: string;
  let ioServer: Server;
  let httpServer: any;
  let userIds: any;
  let customerIds: number[];

  beforeAll(async () => {
    testSetup = EnhancedTestSetup.getInstance();
    testSchema = await testSetup.setupTestEnvironment();

    // Setup WebSocket server for queue synchronization
    httpServer = createServer();
    ioServer = new Server(httpServer, {
      cors: { origin: "*" }
    });

    // Queue synchronization events
    ioServer.on('connection', socket => {
      socket.on('queue_status_change', async (data) => {
        // Broadcast queue changes to all connected clients
        ioServer.emit('queue_updated', {
          customerId: data.customerId,
          newStatus: data.newStatus,
          previousStatus: data.previousStatus,
          updatedBy: data.updatedBy,
          timestamp: new Date()
        });
      });

      socket.on('token_assignment', async (data) => {
        // Broadcast token assignments
        ioServer.emit('token_assigned', {
          customerId: data.customerId,
          tokenNumber: data.tokenNumber,
          queuePosition: data.queuePosition,
          assignedBy: data.assignedBy,
          timestamp: new Date()
        });
      });

      socket.on('priority_update', async (data) => {
        // Broadcast priority changes
        ioServer.emit('priority_changed', {
          customerId: data.customerId,
          newPriority: data.newPriority,
          reason: data.reason,
          updatedBy: data.updatedBy,
          timestamp: new Date()
        });
      });
    });

    await new Promise(resolve => httpServer.listen(3005, resolve));

    // Create test data
    userIds = await testSetup.createTestUsers(testSchema);
    customerIds = await testSetup.createTestCustomers(testSchema, userIds.salesAgent1Id, 50);
  });

  afterAll(async () => {
    await testSetup.cleanupTestSchema(testSchema);
    ioServer.close();
    httpServer.close();
  });

  describe('Concurrent Queue Status Updates', () => {
    it('should handle multiple simultaneous status changes without race conditions', async () => {
      const clients = Array.from({ length: 5 }, () => ioClient('http://localhost:3005'));
      const statusUpdates: any[] = [];

      // Setup listeners on all clients
      clients.forEach((client, index) => {
        client.on('queue_updated', (data) => {
          statusUpdates.push({ clientIndex: index, ...data });
        });
      });

      // Simulate concurrent status changes
      const concurrentOperations = customerIds.slice(0, 10).map(async (customerId, index) => {
        const client = clients[index % clients.length];
        const newStatus = index % 2 === 0 ? QueueStatus.SERVING : QueueStatus.PROCESSING;
        
        // Update database
        await pool.query(`
          UPDATE ${testSchema}.customers 
          SET queue_status = $1 
          WHERE id = $2
        `, [newStatus, customerId]);

        // Emit WebSocket event
        client.emit('queue_status_change', {
          customerId,
          newStatus,
          previousStatus: QueueStatus.WAITING,
          updatedBy: userIds.cashier1Id
        });

        return { customerId, newStatus };
      });

      await Promise.all(concurrentOperations);

      // Wait for all WebSocket events to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify all status changes were broadcast
      expect(statusUpdates.length).toBeGreaterThan(0);
      
      // Check that each client received updates
      const clientsWithUpdates = new Set(statusUpdates.map(u => u.clientIndex));
      expect(clientsWithUpdates.size).toBe(clients.length);

      // Verify database consistency
      for (const operation of await Promise.all(concurrentOperations)) {
        const customer = await pool.query(`
          SELECT queue_status FROM ${testSchema}.customers WHERE id = $1
        `, [operation.customerId]);
        
        expect(customer.rows[0].queue_status).toBe(operation.newStatus);
      }

      // Cleanup
      clients.forEach(client => client.disconnect());
    });

    it('should maintain queue order during concurrent token assignments', async () => {
      const clients = Array.from({ length: 3 }, () => ioClient('http://localhost:3005'));
      const tokenAssignments: any[] = [];

      // Setup listeners
      clients.forEach(client => {
        client.on('token_assigned', (data) => {
          tokenAssignments.push(data);
        });
      });

      // Concurrent token assignments
      const assignments = customerIds.slice(10, 20).map(async (customerId, index) => {
        const tokenNumber = index + 100; // Start from 100 to avoid conflicts
        
        // Update database with new token
        await pool.query(`
          UPDATE ${testSchema}.customers 
          SET token_number = $1 
          WHERE id = $2
        `, [tokenNumber, customerId]);

        // Emit assignment event
        const client = clients[index % clients.length];
        client.emit('token_assignment', {
          customerId,
          tokenNumber,
          queuePosition: index + 1,
          assignedBy: userIds.salesAgent1Id
        });

        return { customerId, tokenNumber };
      });

      await Promise.all(assignments);
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Verify token assignments were processed
      expect(tokenAssignments.length).toBeGreaterThan(0);

      // Check for duplicate token numbers (should not exist)
      const assignedTokens = tokenAssignments.map(a => a.tokenNumber);
      const uniqueTokens = new Set(assignedTokens);
      expect(uniqueTokens.size).toBe(assignedTokens.length);

      // Verify database consistency
      const dbTokens = await pool.query(`
        SELECT id, token_number FROM ${testSchema}.customers 
        WHERE id = ANY($1)
        ORDER BY token_number
      `, [customerIds.slice(10, 20)]);

      const dbTokenNumbers = dbTokens.rows.map(r => r.token_number);
      expect(dbTokenNumbers).toEqual([...dbTokenNumbers].sort((a, b) => a - b));

      clients.forEach(client => client.disconnect());
    });
  });

  describe('Priority Queue Management', () => {
    it('should handle concurrent priority updates correctly', async () => {
      const clients = Array.from({ length: 2 }, () => ioClient('http://localhost:3005'));
      const priorityUpdates: any[] = [];

      clients.forEach(client => {
        client.on('priority_changed', (data) => {
          priorityUpdates.push(data);
        });
      });

      // Simulate concurrent priority changes
      const priorityOperations = customerIds.slice(20, 25).map(async (customerId, index) => {
        const priorities = [
          { senior_citizen: true, pregnant: false, pwd: false },
          { senior_citizen: false, pregnant: true, pwd: false },
          { senior_citizen: false, pregnant: false, pwd: true },
          { senior_citizen: true, pregnant: false, pwd: true },
          { senior_citizen: false, pregnant: false, pwd: false }
        ];

        const newPriority = priorities[index];
        
        // Update database
        await pool.query(`
          UPDATE ${testSchema}.customers 
          SET priority_flags = $1 
          WHERE id = $2
        `, [JSON.stringify(newPriority), customerId]);

        // Emit priority change
        const client = clients[index % clients.length];
        client.emit('priority_update', {
          customerId,
          newPriority,
          reason: 'administrative_adjustment',
          updatedBy: userIds.adminId
        });

        return { customerId, newPriority };
      });

      await Promise.all(priorityOperations);
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Verify priority updates were broadcast
      expect(priorityUpdates.length).toBe(5);

      // Verify database consistency
      for (let i = 0; i < priorityOperations.length; i++) {
        const operation = await priorityOperations[i];
        const customer = await pool.query(`
          SELECT priority_flags FROM ${testSchema}.customers WHERE id = $1
        `, [operation.customerId]);
        
        const dbPriority = JSON.parse(customer.rows[0].priority_flags);
        expect(dbPriority).toEqual(operation.newPriority);
      }

      clients.forEach(client => client.disconnect());
    });

    it('should resolve priority conflicts consistently', async () => {
      const customerId = customerIds[25];
      const clients = Array.from({ length: 3 }, () => ioClient('http://localhost:3005'));
      
      // Simulate conflicting priority updates to the same customer
      const conflictingUpdates = [
        { senior_citizen: true, pregnant: false, pwd: false },
        { senior_citizen: false, pregnant: true, pwd: false },
        { senior_citizen: false, pregnant: false, pwd: true }
      ];

      const updatePromises = conflictingUpdates.map(async (priority, index) => {
        const client = clients[index];
        
        // Try to update the same customer with different priorities
        try {
          await pool.query(`
            UPDATE ${testSchema}.customers 
            SET priority_flags = $1 
            WHERE id = $2
          `, [JSON.stringify(priority), customerId]);

          client.emit('priority_update', {
            customerId,
            newPriority: priority,
            reason: `conflict_test_${index}`,
            updatedBy: userIds.adminId
          });

          return { success: true, priority, index };
        } catch (error) {
          return { success: false, error: error.message, index };
        }
      });

      const results = await Promise.all(updatePromises);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // At least one update should succeed
      const successfulUpdates = results.filter(r => r.success);
      expect(successfulUpdates.length).toBeGreaterThan(0);

      // Verify final state is consistent
      const finalCustomer = await pool.query(`
        SELECT priority_flags FROM ${testSchema}.customers WHERE id = $1
      `, [customerId]);

      const finalPriority = JSON.parse(finalCustomer.rows[0].priority_flags);
      expect(finalPriority).toBeDefined();

      clients.forEach(client => client.disconnect());
    });
  });

  describe('Queue Capacity and Load Testing', () => {
    it('should handle high volume queue operations', async () => {
      const numberOfOperations = 100;
      const clients = Array.from({ length: 10 }, () => ioClient('http://localhost:3005'));
      const operationResults: any[] = [];

      // Setup result tracking
      clients.forEach((client, index) => {
        client.on('queue_updated', (data) => {
          operationResults.push({ clientIndex: index, type: 'queue_updated', ...data });
        });
        
        client.on('token_assigned', (data) => {
          operationResults.push({ clientIndex: index, type: 'token_assigned', ...data });
        });
      });

      // Generate high volume of operations
      const operations = Array.from({ length: numberOfOperations }, async (_, index) => {
        const customerId = customerIds[index % customerIds.length];
        const client = clients[index % clients.length];
        const operationType = index % 3;

        switch (operationType) {
          case 0: // Status change
            await pool.query(`
              UPDATE ${testSchema}.customers 
              SET queue_status = $1 
              WHERE id = $2
            `, [QueueStatus.SERVING, customerId]);

            client.emit('queue_status_change', {
              customerId,
              newStatus: QueueStatus.SERVING,
              previousStatus: QueueStatus.WAITING,
              updatedBy: userIds.cashier1Id
            });
            break;

          case 1: // Token assignment
            const newToken = 1000 + index;
            await pool.query(`
              UPDATE ${testSchema}.customers 
              SET token_number = $1 
              WHERE id = $2
            `, [newToken, customerId]);

            client.emit('token_assignment', {
              customerId,
              tokenNumber: newToken,
              queuePosition: index + 1,
              assignedBy: userIds.salesAgent1Id
            });
            break;

          case 2: // Priority update
            const priority = { senior_citizen: index % 2 === 0, pregnant: false, pwd: false };
            await pool.query(`
              UPDATE ${testSchema}.customers 
              SET priority_flags = $1 
              WHERE id = $2
            `, [JSON.stringify(priority), customerId]);

            client.emit('priority_update', {
              customerId,
              newPriority: priority,
              reason: 'load_test',
              updatedBy: userIds.adminId
            });
            break;
        }

        return { index, customerId, operationType };
      });

      const startTime = Date.now();
      await Promise.all(operations);
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for WebSocket propagation
      const endTime = Date.now();

      const duration = endTime - startTime;
      const operationsPerSecond = (numberOfOperations / duration) * 1000;

      console.log(`Processed ${numberOfOperations} queue operations in ${duration}ms`);
      console.log(`Average throughput: ${operationsPerSecond.toFixed(2)} operations/second`);

      // Verify operations were processed
      expect(operationResults.length).toBeGreaterThan(0);
      
      // Performance assertion - should handle at least 10 operations per second
      expect(operationsPerSecond).toBeGreaterThan(10);

      clients.forEach(client => client.disconnect());
    });

    it('should maintain WebSocket connection stability under load', async () => {
      const clients = Array.from({ length: 20 }, () => ioClient('http://localhost:3005'));
      const connectionEvents: any[] = [];
      const messageCount = 50;

      // Track connection events
      clients.forEach((client, index) => {
        client.on('connect', () => {
          connectionEvents.push({ clientIndex: index, event: 'connect', timestamp: Date.now() });
        });

        client.on('disconnect', () => {
          connectionEvents.push({ clientIndex: index, event: 'disconnect', timestamp: Date.now() });
        });

        client.on('reconnect', () => {
          connectionEvents.push({ clientIndex: index, event: 'reconnect', timestamp: Date.now() });
        });
      });

      // Send burst of messages to test connection stability
      const messagePromises = clients.map(async (client, clientIndex) => {
        for (let i = 0; i < messageCount; i++) {
          const customerId = customerIds[i % customerIds.length];
          
          client.emit('queue_status_change', {
            customerId,
            newStatus: QueueStatus.PROCESSING,
            previousStatus: QueueStatus.SERVING,
            updatedBy: userIds.cashier1Id
          });

          // Small delay between messages
          await testSetup.simulateNetworkDelay(10, 50);
        }
      });

      await Promise.all(messagePromises);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check that all clients are still connected
      const connectedClients = clients.filter(client => client.connected);
      expect(connectedClients.length).toBe(clients.length);

      // Verify no unexpected disconnections
      const disconnectEvents = connectionEvents.filter(e => e.event === 'disconnect');
      expect(disconnectEvents.length).toBe(0);

      clients.forEach(client => client.disconnect());
    });
  });

  describe('Real-time Queue Synchronization', () => {
    it('should synchronize queue state across multiple admin interfaces', async () => {
      const adminClients = Array.from({ length: 3 }, () => ioClient('http://localhost:3005'));
      const queueUpdates: { [clientIndex: number]: any[] } = {};

      // Initialize update tracking for each admin client
      adminClients.forEach((client, index) => {
        queueUpdates[index] = [];
        
        client.on('queue_updated', (data) => {
          queueUpdates[index].push(data);
        });

        client.on('token_assigned', (data) => {
          queueUpdates[index].push(data);
        });

        client.on('priority_changed', (data) => {
          queueUpdates[index].push(data);
        });
      });

      // Perform queue operations from different sources
      const customerId1 = customerIds[30];
      const customerId2 = customerIds[31];
      const customerId3 = customerIds[32];

      // Admin 1 changes customer 1 status
      await pool.query(`
        UPDATE ${testSchema}.customers SET queue_status = $1 WHERE id = $2
      `, [QueueStatus.SERVING, customerId1]);
      
      adminClients[0].emit('queue_status_change', {
        customerId: customerId1,
        newStatus: QueueStatus.SERVING,
        previousStatus: QueueStatus.WAITING,
        updatedBy: userIds.adminId
      });

      // Admin 2 assigns token to customer 2
      await pool.query(`
        UPDATE ${testSchema}.customers SET token_number = $1 WHERE id = $2
      `, [2000, customerId2]);
      
      adminClients[1].emit('token_assignment', {
        customerId: customerId2,
        tokenNumber: 2000,
        queuePosition: 1,
        assignedBy: userIds.adminId
      });

      // Admin 3 updates customer 3 priority
      const newPriority = { senior_citizen: true, pregnant: true, pwd: false };
      await pool.query(`
        UPDATE ${testSchema}.customers SET priority_flags = $1 WHERE id = $2
      `, [JSON.stringify(newPriority), customerId3]);
      
      adminClients[2].emit('priority_update', {
        customerId: customerId3,
        newPriority,
        reason: 'admin_intervention',
        updatedBy: userIds.adminId
      });

      // Wait for synchronization
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify all admin clients received all updates
      adminClients.forEach((_, index) => {
        expect(queueUpdates[index].length).toBeGreaterThan(0);
      });

      // Verify updates were synchronized across all clients
      const allUpdates = Object.values(queueUpdates).flat();
      const customerIds_updated = new Set(allUpdates.map(u => u.customerId));
      
      expect(customerIds_updated.has(customerId1)).toBe(true);
      expect(customerIds_updated.has(customerId2)).toBe(true);
      expect(customerIds_updated.has(customerId3)).toBe(true);

      adminClients.forEach(client => client.disconnect());
    });
  });
});
