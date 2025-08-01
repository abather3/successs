"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Mock Redis
const mockRedis = {
    call: jest.fn().mockResolvedValue('OK')
};
jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => mockRedis);
});
jest.mock('rate-limit-redis', () => {
    return jest.fn().mockImplementation(() => ({
        sendCommand: jest.fn()
    }));
});
// Create a simple test app
const createTestApp = () => {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    // General rate limiter
    const generalLimiter = (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // Small limit for testing
        message: 'Too many requests, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
    });
    // Sensitive endpoint limiter
    const sensitiveLimiter = (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 3, // Very small limit for testing
        message: 'Too many requests, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use(generalLimiter);
    app.get('/health', (req, res) => {
        res.json({ status: 'OK' });
    });
    app.use('/api/auth/login', sensitiveLimiter);
    app.post('/api/auth/login', (req, res) => {
        res.json({ message: 'Login endpoint' });
    });
    return app;
};
describe('Rate Limiting Tests', () => {
    let app;
    beforeEach(() => {
        app = createTestApp();
    });
    it('should allow requests within the limit', async () => {
        const response = await (0, supertest_1.default)(app)
            .get('/health');
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('OK');
    });
    it('should block requests after exceeding general limit', async () => {
        // Make multiple requests up to the limit
        for (let i = 0; i < 10; i++) {
            await (0, supertest_1.default)(app).get('/health');
        }
        // This should be blocked
        const response = await (0, supertest_1.default)(app)
            .get('/health');
        expect(response.status).toBe(429);
        expect(response.text).toContain('Too many requests');
    });
    it('should block requests after exceeding sensitive endpoint limit', async () => {
        // Make multiple requests up to the sensitive limit
        for (let i = 0; i < 3; i++) {
            await (0, supertest_1.default)(app).post('/api/auth/login').send({});
        }
        // This should be blocked
        const response = await (0, supertest_1.default)(app)
            .post('/api/auth/login')
            .send({});
        expect(response.status).toBe(429);
        expect(response.text).toContain('Too many requests');
    });
    it('should include rate limit headers', async () => {
        const response = await (0, supertest_1.default)(app)
            .get('/health');
        expect(response.headers['ratelimit-limit']).toBeDefined();
        expect(response.headers['ratelimit-remaining']).toBeDefined();
        expect(response.headers['ratelimit-reset']).toBeDefined();
    });
    it('should include retry-after header when rate limited', async () => {
        // Exceed the limit
        for (let i = 0; i < 10; i++) {
            await (0, supertest_1.default)(app).get('/health');
        }
        const response = await (0, supertest_1.default)(app)
            .get('/health');
        expect(response.status).toBe(429);
        expect(response.headers['retry-after']).toBeDefined();
    });
});
//# sourceMappingURL=rateLimitSimple.test.js.map