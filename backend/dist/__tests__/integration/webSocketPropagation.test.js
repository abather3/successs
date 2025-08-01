"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_1 = require("socket.io");
const http_1 = require("http");
const socket_io_client_1 = __importDefault(require("socket.io-client"));
const database_1 = require("../../config/database");
let ioServer;
let httpServer;
let testCustomerId;
beforeAll(async () => {
    httpServer = (0, http_1.createServer)();
    ioServer = new socket_io_1.Server(httpServer);
    ioServer.on('connection', socket => {
        socket.on('status_change', ({ customerId, newStatus }) => {
            ioServer.emit(`status_updated:${customerId}`, { newStatus });
        });
    });
    await new Promise(resolve => httpServer.listen(3001, resolve));
    // Create test customer
    const customerResult = await database_1.pool.query(`
    INSERT INTO customers (name, contact_number, queue_status)
    VALUES ($1, $2, $3)
    RETURNING id
  `, ['WebSocket Test Customer', '1234567890', 'waiting']);
    testCustomerId = customerResult.rows[0].id;
});
afterAll(async () => {
    ioServer.close();
    httpServer.close();
    await database_1.pool.query('DELETE FROM customers WHERE id = $1', [testCustomerId]);
});
describe('WebSocket Event Propagation Tests', () => {
    it('should propagate status change event', done => {
        const client = (0, socket_io_client_1.default)('http://localhost:3001');
        client.on(`status_updated:${testCustomerId}`, ({ newStatus }) => {
            expect(newStatus).toBe('serving');
            client.disconnect();
            done();
        });
        ioServer.emit('status_change', { customerId: testCustomerId, newStatus: 'serving' });
    });
});
//# sourceMappingURL=webSocketPropagation.test.js.map