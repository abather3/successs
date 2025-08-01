"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_1 = require("socket.io");
const http_1 = require("http");
const socket_io_client_1 = require("socket.io-client");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const websocket_1 = require("../services/websocket");
const config_1 = require("../config/config");
const user_1 = require("../services/user");
const mockUserService = user_1.UserService;
describe('WebSocket Authentication Events', () => {
    let httpServer;
    let io;
    let clientSocket;
    let serverPort;
    beforeAll((done) => {
        httpServer = (0, http_1.createServer)();
        io = new socket_io_1.Server(httpServer);
        (0, websocket_1.setupWebSocketHandlers)(io);
        httpServer.listen(() => {
            serverPort = httpServer.address()?.port;
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
            clientSocket = (0, socket_io_client_1.io)(`http://localhost:${serverPort}`, {
                auth: {} // No token provided
            });
            clientSocket.on('auth:error', (error) => {
                try {
                    expect(error.code).toBe('TOKEN_MISSING');
                    expect(error.message).toBe('Authentication token required');
                    done();
                }
                catch (e) {
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
            const expiredToken = jsonwebtoken_1.default.sign({ userId: 1, email: 'test@example.com', role: 'admin' }, config_1.config.JWT_SECRET, { expiresIn: '-1h' });
            clientSocket = (0, socket_io_client_1.io)(`http://localhost:${serverPort}`, {
                auth: { token: expiredToken }
            });
            clientSocket.on('auth:error', (error) => {
                try {
                    expect(error.code).toBe('TOKEN_EXPIRED');
                    expect(error.message).toContain('expired');
                    done();
                }
                catch (e) {
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
            const validToken = jsonwebtoken_1.default.sign({ userId: 999, email: 'test@example.com', role: 'admin' }, config_1.config.JWT_SECRET, { expiresIn: '1h' });
            // Mock UserService.findById to return null
            mockUserService.findById.mockResolvedValue(null);
            clientSocket = (0, socket_io_client_1.io)(`http://localhost:${serverPort}`, {
                auth: { token: validToken }
            });
            clientSocket.on('auth:error', (error) => {
                try {
                    expect(error.code).toBe('TOKEN_INVALID');
                    expect(error.message).toBe('Invalid or inactive user');
                    done();
                }
                catch (e) {
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
            const shortExpiryToken = jsonwebtoken_1.default.sign({ userId: 1, email: 'test@example.com', role: 'admin' }, config_1.config.JWT_SECRET, { expiresIn: '90s' } // 1.5 minutes
            );
            // Mock UserService.findById to return a valid user
            mockUserService.findById.mockResolvedValue({
                id: 1,
                email: 'test@example.com',
                role: 'admin',
                status: 'active',
                full_name: 'Test User'
            });
            clientSocket = (0, socket_io_client_1.io)(`http://localhost:${serverPort}`, {
                auth: { token: shortExpiryToken }
            });
            clientSocket.on('auth:expire_soon', (data) => {
                try {
                    expect(data.remainingSeconds).toBeLessThanOrEqual(120);
                    expect(data.remainingSeconds).toBeGreaterThan(0);
                    done();
                }
                catch (e) {
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
            const longExpiryToken = jsonwebtoken_1.default.sign({ userId: 1, email: 'test@example.com', role: 'admin' }, config_1.config.JWT_SECRET, { expiresIn: '5m' } // 5 minutes
            );
            // Mock UserService.findById to return a valid user
            mockUserService.findById.mockResolvedValue({
                id: 1,
                email: 'test@example.com',
                role: 'admin',
                status: 'active',
                full_name: 'Test User'
            });
            clientSocket = (0, socket_io_client_1.io)(`http://localhost:${serverPort}`, {
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
            expect(typeof websocket_1.WebSocketService.emitAuthError).toBe('function');
        });
        it('should have emitAuthExpirationWarning method', () => {
            expect(typeof websocket_1.WebSocketService.emitAuthExpirationWarning).toBe('function');
        });
    });
});
//# sourceMappingURL=websocket-auth-events.test.js.map