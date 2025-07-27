import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';

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
  const app = express();
  app.use(express.json());

  // General rate limiter
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Small limit for testing
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Sensitive endpoint limiter
  const sensitiveLimiter = rateLimit({
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
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  it('should allow requests within the limit', async () => {
    const response = await request(app)
      .get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('OK');
  });

  it('should block requests after exceeding general limit', async () => {
    // Make multiple requests up to the limit
    for (let i = 0; i < 10; i++) {
      await request(app).get('/health');
    }

    // This should be blocked
    const response = await request(app)
      .get('/health');

    expect(response.status).toBe(429);
    expect(response.text).toContain('Too many requests');
  });

  it('should block requests after exceeding sensitive endpoint limit', async () => {
    // Make multiple requests up to the sensitive limit
    for (let i = 0; i < 3; i++) {
      await request(app).post('/api/auth/login').send({});
    }

    // This should be blocked
    const response = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(response.status).toBe(429);
    expect(response.text).toContain('Too many requests');
  });

  it('should include rate limit headers', async () => {
    const response = await request(app)
      .get('/health');
    
    expect(response.headers['ratelimit-limit']).toBeDefined();
    expect(response.headers['ratelimit-remaining']).toBeDefined();
    expect(response.headers['ratelimit-reset']).toBeDefined();
  });

  it('should include retry-after header when rate limited', async () => {
    // Exceed the limit
    for (let i = 0; i < 10; i++) {
      await request(app).get('/health');
    }

    const response = await request(app)
      .get('/health');

    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBeDefined();
  });
});
