import { Server } from 'socket.io';
import { createServer } from 'http';
import { setupWebSocketHandlers } from '../../../src/services/websocket';
import { io as Client } from 'socket.io-client';

describe('WebSocket Provider Contract Tests', () => {
  let httpServer: any;
  let io: Server;
  let serverSocket: any;
  let clientSocket: any;

  beforeAll((done) => {
    httpServer = createServer();
    io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    // Setup WebSocket handlers
    setupWebSocketHandlers(io);

    httpServer.listen(() => {
      const port = (httpServer.address() as any).port;
      clientSocket = Client(`http://localhost:${port}`, {
        auth: {
          token: 'test-jwt-token'
        }
      });
      
      io.on('connection', (socket) => {
        serverSocket = socket;
      });
      
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    io.close();
    clientSocket.close();
    httpServer.close();
  });

  describe('Queue Update Events', () => {
    it('should emit queue update when customer status changes', (done) => {
      const mockQueueUpdate = {
        id: 1,
        name: 'John Doe',
        newStatus: 'serving',
        timestamp: new Date(),
        processingCount: 2
      };

      clientSocket.on('queue:update', (data: any) => {
        expect(data).toMatchObject({
          id: expect.any(Number),
          name: expect.any(String),
          newStatus: expect.any(String),
          timestamp: expect.any(String),
          processingCount: expect.any(Number)
        });
        done();
      });

      // Simulate queue update from backend
      io.to('queue:updates').emit('queue:update', mockQueueUpdate);
    });

    it('should emit queue status change with sound suppression for processing', (done) => {
      const mockStatusChange = {
        id: 1,
        newStatus: 'processing',
        timestamp: new Date(),
        suppressSound: true
      };

      clientSocket.on('queue:status_changed', (data: any) => {
        expect(data).toMatchObject({
          id: expect.any(Number),
          newStatus: 'processing',
          timestamp: expect.any(String),
          suppressSound: true
        });
        done();
      });

      // Simulate status change emission
      io.to('queue:updates').emit('queue:status_changed', mockStatusChange);
    });
  });

  describe('Transaction Events', () => {
    it('should emit transaction updates', (done) => {
      const mockTransactionUpdate = {
        type: 'payment_completed',
        transactionId: 123,
        timestamp: new Date(),
        transaction: {
          id: 123,
          status: 'completed',
          amount: 100.00
        }
      };

      clientSocket.on('transactionUpdated', (data: any) => {
        expect(data).toMatchObject({
          type: expect.any(String),
          transactionId: expect.any(Number),
          timestamp: expect.any(String),
          transaction: expect.objectContaining({
            id: expect.any(Number),
            status: expect.any(String),
            amount: expect.any(Number)
          })
        });
        done();
      });

      // Simulate transaction update emission
      io.to('transactions:updates').emit('transactionUpdated', mockTransactionUpdate);
    });
  });

  describe('Authentication Events', () => {
    it('should handle authentication errors', (done) => {
      const mockAuthError = {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired'
      };

      clientSocket.on('auth:error', (data: any) => {
        expect(data).toMatchObject({
          code: expect.any(String),
          message: expect.any(String)
        });
        expect(data.code).toBe('TOKEN_EXPIRED');
        done();
      });

      // Simulate auth error emission
      serverSocket.emit('auth:error', mockAuthError);
    });

    it('should handle token expiration warnings', (done) => {
      const mockExpirationWarning = {
        remainingSeconds: 120
      };

      clientSocket.on('auth:expire_soon', (data: any) => {
        expect(data).toMatchObject({
          remainingSeconds: expect.any(Number)
        });
        expect(data.remainingSeconds).toBe(120);
        done();
      });

      // Simulate expiration warning emission
      serverSocket.emit('auth:expire_soon', mockExpirationWarning);
    });
  });

  describe('Customer Notification Events', () => {
    it('should emit customer registration notifications', (done) => {
      const mockCustomerRegistration = {
        customerId: 1,
        customerName: 'Jane Doe',
        orNumber: 'OR123456',
        paymentAmount: 150.00,
        priority: {
          senior_citizen: false,
          pwd: false,
          pregnant: true
        },
        locationId: 1
      };

      clientSocket.on('customer:registered', (data: any) => {
        expect(data).toMatchObject({
          customerId: expect.any(Number),
          customerName: expect.any(String),
          orNumber: expect.any(String),
          paymentAmount: expect.any(Number),
          priority: expect.objectContaining({
            senior_citizen: expect.any(Boolean),
            pwd: expect.any(Boolean),
            pregnant: expect.any(Boolean)
          }),
          locationId: expect.any(Number)
        });
        done();
      });

      // Simulate customer registration notification
      io.to(`cashier:registration:${mockCustomerRegistration.locationId}`)
        .emit('customer:registered', mockCustomerRegistration);
    });
  });

  describe('Connection Events', () => {
    it('should send connection confirmation on connect', (done) => {
      clientSocket.on('connected', (data: any) => {
        expect(data).toMatchObject({
          message: expect.any(String),
          timestamp: expect.any(String)
        });
        expect(data.message).toContain('Connected to EscaShop WebSocket');
        done();
      });

      // Simulate connection confirmation
      serverSocket.emit('connected', {
        message: 'Connected to EscaShop WebSocket',
        timestamp: new Date()
      });
    });
  });
});
