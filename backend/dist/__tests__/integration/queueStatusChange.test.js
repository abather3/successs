"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const app_1 = require("../../app");
const database_1 = require("../../config/database");
const types_1 = require("../../types");
describe('REST API Integration Tests', () => {
    let token;
    let testUserId;
    let testCustomerId;
    beforeAll(async () => {
        // Create test user for authentication
        const result = await database_1.pool.query(`
      INSERT INTO users (email, password, full_name, role, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, ['rest-test@example.com', 'hashedpassword', 'REST Test User', types_1.UserRole.ADMIN, 'active']);
        testUserId = result.rows[0].id;
        // Authenticate user to retrieve JWT token
        const res = await (0, supertest_1.default)(app_1.app)
            .post('/api/auth/login')
            .send({ email: 'rest-test@example.com', password: 'hashedpassword' });
        token = res.body.token;
        // Create test customer
        const customerResult = await database_1.pool.query(`
      INSERT INTO customers (name, contact_number, queue_status)
      VALUES ($1, $2, $3)
      RETURNING id
    `, ['REST Test Customer', '1234567890', types_1.QueueStatus.WAITING]);
        testCustomerId = customerResult.rows[0].id;
    });
    afterAll(async () => {
        await database_1.pool.query('DELETE FROM customers WHERE id = $1', [testCustomerId]);
        await database_1.pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    });
    it('should change status from waiting to serving', async () => {
        const response = await (0, supertest_1.default)(app_1.app)
            .post(`/api/customers/${testCustomerId}/status`)
            .set('Authorization', `Bearer ${token}`)
            .send({ status: types_1.QueueStatus.SERVING });
        expect(response.status).toBe(200);
        expect(response.body.queue_status).toBe(types_1.QueueStatus.SERVING);
    });
    it('should not allow unauthorized role to change status', async () => {
        await (0, supertest_1.default)(app_1.app)
            .post(`/api/customers/${testCustomerId}/status`)
            .set('Authorization', `Bearer ${token}`)
            .send({ status: types_1.QueueStatus.COMPLETED, role: types_1.UserRole.SALES })
            .expect(403);
    });
});
//# sourceMappingURL=queueStatusChange.test.js.map