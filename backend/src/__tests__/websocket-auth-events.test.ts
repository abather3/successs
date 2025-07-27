import { Server } from 'socket.io';
import { createServer } from 'http';
import { io as ioClient, Socket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { setupWebSocketHandlers, WebSocketService } from '../services/websocket';
import { config } from '../config/config';
import { UserService } from '../services/user';

const mockUserService = UserService as jest.Mocked<typeof UserService>;

describe('WebSocket Authentication Events', () => {
  let httpServer: any;
  let io: Server;
  let clientSocket: Socket;
  let serverPort: number;

  beforeAll((done) => {
    httpServer = createServer();
    io = new Server(httpServer);
    setupWebSocketHandlers(io);
    httpServer.listen(() => {
      serverPort = (httpServer.address() as any)?.port;
      done();
    });
  });

  afterAll(() => {
    io.close();
    if (httpServer) {
      httpServer.close();
    }
  });

  beforeEach((done) => {
    // Clear any existing socket connections
    if (clientSocket) {
      clientSocket.disconnect();
    }
    jest.clearAllMocks();
    done();
  });

  afterEach(() => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
  });

  describe('auth:error events', () => {
    it('should emit auth:error when no token is provided', (done) => {
      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: {} // No token provided
      });

      clientSocket.on('auth:error', (error) => {
        try {
          expect(error.code).toBe('TOKEN_MISSING');
          expect(error.message).toBe('Authentication token required');
          done();
        } catch (e) {
          done(e);
        }
      });

      // Fallback for connect_error
      clientSocket.on('connect_error', (error) => {
        // If auth:error wasn't received, this test should fail
        if (!done.toString().includes('called')) {
          done(new Error('Expected auth:error event but got connect_error'));
        }
      });
    });

    it('should emit auth:error when token is expired', (done) => {
      const expiredToken = jwt.sign(
        { userId: 1, email: 'test@example.com', role: 'admin' },
        config.JWT_SECRET,
        { expiresIn: '-1h' }
      );

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: expiredToken }
      });

      clientSocket.on('auth:error', (error) => {
        try {
          expect(error.code).toBe('TOKEN_EXPIRED');
          expect(error.message).toContain('expired');
          done();
        } catch (e) {
          done(e);
        }
      });

      clientSocket.on('connect_error', (error) => {
        if (!done.toString().includes('called')) {
          done(new Error('Expected auth:error event but got connect_error'));
        }
      });
    });

    it('should emit auth:error when user is not found', (done) => {
      const validToken = jwt.sign(
        { userId: 999, email: 'test@example.com', role: 'admin' },
        config.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Mock UserService.findById to return null
      mockUserService.findById.mockResolvedValue(null);

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: validToken }
      });

      clientSocket.on('auth:error', (error) => {
        try {
          expect(error.code).toBe('TOKEN_INVALID');
          expect(error.message).toBe('Invalid or inactive user');
          done();
        } catch (e) {
          done(e);
        }
      });

      clientSocket.on('connect_error', (error) => {
        if (!done.toString().includes('called')) {
          done(new Error('Expected auth:error event but got connect_error'));
        }
      });
    });
  });

  describe('auth:expire_soon events', () => {
    it('should emit auth:expire_soon when token expires in less than 2 minutes', (done) => {
      const shortExpiryToken = jwt.sign(
        { userId: 1, email: 'test@example.com', role: 'admin' },
        config.JWT_SECRET,
        { expiresIn: '90s' } // 1.5 minutes
      );

      // Mock UserService.findById to return a valid user
      mockUserService.findById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        role: 'admin',
        status: 'active',
        full_name: 'Test User'
      } as any);

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: shortExpiryToken }
      });

      clientSocket.on('auth:expire_soon', (data) => {
        try {
          expect(data.remainingSeconds).toBeLessThanOrEqual(120);
          expect(data.remainingSeconds).toBeGreaterThan(0);
          done();
        } catch (e) {
          done(e);
        }
      });

      clientSocket.on('connect', () => {
        // If we connect but don't get auth:expire_soon, that's also valid
        // depending on the exact timing
        setTimeout(() => {
          if (!done.toString().includes('called')) {
            done(new Error('Expected auth:expire_soon event'));
          }
        }, 1000);
      });
    });

    it('should not emit auth:expire_soon when token expires in more than 2 minutes', (done) => {
      const longExpiryToken = jwt.sign(
        { userId: 1, email: 'test@example.com', role: 'admin' },
        config.JWT_SECRET,
        { expiresIn: '5m' } // 5 minutes
      );

      // Mock UserService.findById to return a valid user
      mockUserService.findById.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        role: 'admin',
        status: 'active',
        full_name: 'Test User'
      } as any);

      clientSocket = ioClient(`http://localhost:${serverPort}`, {
        auth: { token: longExpiryToken }
      });

      clientSocket.on('auth:expire_soon', (data) => {
        done(new Error('Should not emit auth:expire_soon for tokens with >2 min expiry'));
      });

      clientSocket.on('connect', () => {
        // Wait a bit and if no auth:expire_soon, test passes
        setTimeout(() => {
          done();
        }, 1000);
      });
    });
  });

  describe('WebSocketService helper methods', () => {
    it('should have emitAuthError method', () => {
      expect(typeof WebSocketService.emitAuthError).toBe('function');
    });

    it('should have emitAuthExpirationWarning method', () => {
      expect(typeof WebSocketService.emitAuthExpirationWarning).toBe('function');
    });
  });
});
