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
describe('WebSocket Authentication Error Classification', () => {
    let httpServer;
    let io;
    let clientSocket;
    let serverSocket;
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
        done();
    });
    afterEach(() => {
        if (clientSocket) {
            clientSocket.disconnect();
        }
    });
    describe('JWT Error Classification', () => {
        it('should return TOKEN_MISSING error when no token is provided', (done) => {
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
            clientSocket.on('connect_error', (error) => {
                // This should also trigger since the middleware will call next(new Error())
                try {
                    expect(error.message).toBe('Authentication token required');
                }
                catch (e) {
                    // If auth:error was already handled, that's fine
                }
            });
        });
        it('should return TOKEN_EXPIRED error when token is expired', (done) => {
            // Create an expired token
            const expiredToken = jsonwebtoken_1.default.sign({ userId: 1, email: 'test@example.com', role: 'admin' }, config_1.config.JWT_SECRET, { expiresIn: '-1h' } // Expired 1 hour ago
            );
            clientSocket = (0, socket_io_client_1.io)(`http://localhost:${serverPort}`, {
                auth: { token: expiredToken }
            });
            clientSocket.on('connect_error', (error) => {
                try {
                    const parsedError = JSON.parse(error.message);
                    expect(parsedError.code).toBe('TOKEN_EXPIRED');
                    expect(parsedError.message).toContain('expired');
                    done();
                }
                catch (e) {
                    done(e);
                }
            });
        });
        it('should return TOKEN_INVALID error for malformed token', (done) => {
            const malformedToken = 'invalid.token.here';
            clientSocket = (0, socket_io_client_1.io)(`http://localhost:${serverPort}`, {
                auth: { token: malformedToken }
            });
            clientSocket.on('connect_error', (error) => {
                try {
                    const parsedError = JSON.parse(error.message);
                    expect(parsedError.code).toBe('TOKEN_INVALID');
                    expect(parsedError.message).toBeTruthy();
                    done();
                }
                catch (e) {
                    done(e);
                }
            });
        });
        it('should return TOKEN_INVALID error for token signed with wrong secret', (done) => {
            const wrongSecretToken = jsonwebtoken_1.default.sign({ userId: 1, email: 'test@example.com', role: 'admin' }, 'wrong-secret', { expiresIn: '1h' });
            clientSocket = (0, socket_io_client_1.io)(`http://localhost:${serverPort}`, {
                auth: { token: wrongSecretToken }
            });
            clientSocket.on('connect_error', (error) => {
                try {
                    const parsedError = JSON.parse(error.message);
                    expect(parsedError.code).toBe('TOKEN_INVALID');
                    expect(parsedError.message).toBeTruthy();
                    done();
                }
                catch (e) {
                    done(e);
                }
            });
        });
        it('should return TOKEN_INVALID error for token with future nbf (not before) claim', (done) => {
            const futureNbfToken = jsonwebtoken_1.default.sign({
                userId: 1,
                email: 'test@example.com',
                role: 'admin',
                nbf: Math.floor(Date.now() / 1000) + 3600 // Not valid for 1 hour
            }, config_1.config.JWT_SECRET, { expiresIn: '2h' });
            clientSocket = (0, socket_io_client_1.io)(`http://localhost:${serverPort}`, {
                auth: { token: futureNbfToken }
            });
            clientSocket.on('connect_error', (error) => {
                try {
                    const parsedError = JSON.parse(error.message);
                    expect(parsedError.code).toBe('TOKEN_INVALID');
                    expect(parsedError.message).toBeTruthy();
                    done();
                }
                catch (e) {
                    done(e);
                }
            });
        });
    });
    describe('Logging Behavior', () => {
        let consoleSpy;
        beforeEach(() => {
            consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
        });
        afterEach(() => {
            consoleSpy.mockRestore();
        });
        it('should log with console.warn for expected auth failures', (done) => {
            const expiredToken = jsonwebtoken_1.default.sign({ userId: 1, email: 'test@example.com', role: 'admin' }, config_1.config.JWT_SECRET, { expiresIn: '-1h' });
            clientSocket = (0, socket_io_client_1.io)(`http://localhost:${serverPort}`, {
                auth: { token: expiredToken }
            });
            clientSocket.on('connect_error', (error) => {
                try {
                    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('JWT verification failed:'));
                    done();
                }
                catch (e) {
                    done(e);
                }
            });
        });
        it('should log with console.warn for missing token', (done) => {
            clientSocket = (0, socket_io_client_1.io)(`http://localhost:${serverPort}`, {
                auth: {}
            });
            clientSocket.on('connect_error', (error) => {
                try {
                    expect(consoleSpy).toHaveBeenCalledWith('Authentication token required');
                    done();
                }
                catch (e) {
                    done(e);
                }
            });
        });
    });
    describe('Error Response Format', () => {
        it('should return properly formatted JSON error response', (done) => {
            clientSocket = (0, socket_io_client_1.io)(`http://localhost:${serverPort}`, {
                auth: {}
            });
            clientSocket.on('connect_error', (error) => {
                try {
                    const parsedError = JSON.parse(error.message);
                    expect(parsedError).toHaveProperty('code');
                    expect(parsedError).toHaveProperty('message');
                    expect(typeof parsedError.code).toBe('string');
                    expect(typeof parsedError.message).toBe('string');
                    done();
                }
                catch (e) {
                    done(e);
                }
            });
        });
    });
});
//# sourceMappingURL=websocket-auth-errors.test.js.map