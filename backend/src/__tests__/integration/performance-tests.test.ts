import { EnhancedTestSetup } from './enhanced-setup';
import ioClient from 'socket.io-client';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { pool } from '../../config/database';
import { QueueStatus, PaymentMode, PaymentStatus } from '../../types';

const performanceTests = () => {
  let testSetup: EnhancedTestSetup;
  let testSchema: string;
  let ioServer: Server;
  let httpServer: any;

  beforeAll(async () => {
    testSetup = EnhancedTestSetup.getInstance();
    testSchema = await testSetup.setupTestEnvironment();

    // Setup WebSocket server for performance testing
    httpServer = createServer();
    ioServer = new Server(httpServer);

    ioServer.on('connection', socket => {
      socket.on('payment_update', data => {
        ioServer.emit(`payment_status_update:${data.transactionId}`, data);
      });
    });

    await new Promise(resolve => httpServer.listen(3003, resolve));
  });

  afterAll(async () => {
    await testSetup.cleanupTestSchema(testSchema);
    ioServer.close();
    httpServer.close();
  });

  describe('Performance Benchmarks', () => {
    it('should handle high volume of concurrent payment updates', async () => {
      const client = await pool.connect();

      try {
        // Create load test data
        const userIds = await testSetup.createTestUsers(testSchema);
        const customerIds = await testSetup.createTestCustomers(testSchema, userIds.salesAgent1Id, 100);
        const transactionIds = await testSetup.createTestTransactions(testSchema, customerIds, userIds.salesAgent1Id, userIds.cashier1Id);

        // Setup WebSocket clients for simulating concurrent payments
        const clients = transactionIds.map(transactionId => {
          const client = ioClient('http://localhost:3003');
          client.emit('payment_update', {
            transactionId,
            amount: 500,
            paymentMode: PaymentMode.CASH,
            status: PaymentStatus.PARTIAL
          });
          return client;
        });

        await Promise.all(clients.map(client => {
          return new Promise(resolve => {
            client.on('payment_status_update', data => {
              if (data.status === PaymentStatus.PARTIAL) {
                resolve();
              }
            });
          });
        }));
      } finally {
        client.release();
      }
    }, 30000);

    it('should measure transaction throughput under load', async () => {
      const start = Date.now();
      const client = await pool.connect();

      try {
        // Create multiple transactions
        const transactions = await testSetup.generateConcurrentOperations(1000, async () => {
          const newTransaction = await client.query(`
            INSERT INTO ${testSchema}.transactions (
              customer_id, or_number, amount, payment_mode, sales_agent_id, cashier_id, payment_status, balance_amount
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
          `, [1, `TXN-${Date.now()}`, 100, PaymentMode.CASH, 1, 1, PaymentStatus.UNPAID, 100]);
          return newTransaction.rows[0].id;
        });

        // Verify transactions were created
        expect(transactions).toHaveLength(1000);
      } finally {
        client.release();
      }

      const end = Date.now();
      const duration = (end - start) / 1000;

      console.log(`Transaction throughput: ${(1000 / duration).toFixed(2)} transactions per second`);
    }, 60000);
  });
};

export default performanceTests;
