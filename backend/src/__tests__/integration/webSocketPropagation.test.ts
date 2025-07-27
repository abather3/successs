import { Server } from 'socket.io';
import { createServer } from 'http';
import ioClient from 'socket.io-client';
import { pool } from '../../config/database';

let ioServer: Server;
let httpServer;
let testCustomerId: number;

beforeAll(async () => {
  httpServer = createServer();
  ioServer = new Server(httpServer);

  ioServer.on('connection', socket => {
    socket.on('status_change', ({ customerId, newStatus }) => {
      ioServer.emit(`status_updated:${customerId}`, { newStatus });
    });
  });

  await new Promise(resolve => httpServer.listen(3001, resolve));

  // Create test customer
  const customerResult = await pool.query(`
    INSERT INTO customers (name, contact_number, queue_status)
    VALUES ($1, $2, $3)
    RETURNING id
  `, ['WebSocket Test Customer', '1234567890', 'waiting']);
  testCustomerId = customerResult.rows[0].id;
});

afterAll(async () => {
  ioServer.close();
  httpServer.close();
  await pool.query('DELETE FROM customers WHERE id = $1', [testCustomerId]);
});

describe('WebSocket Event Propagation Tests', () => {
  it('should propagate status change event', done => {
    const client = ioClient('http://localhost:3001');

    client.on(`status_updated:${testCustomerId}`, ({ newStatus }) => {
      expect(newStatus).toBe('serving');
      client.disconnect();
      done();
    });

    ioServer.emit('status_change', { customerId: testCustomerId, newStatus: 'serving' });
  });
});
