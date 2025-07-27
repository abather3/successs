import request from 'supertest';
import app from '../index';

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    call: jest.fn().mockResolvedValue('OK')
  }));
});

// Function to wait for a specified number of milliseconds
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Automated tests for rate limiting

describe('Rate Limiting', () => {
  it('should allow up to 5 requests to sensitive endpoints', async () => {
    const responseTimes = 5;
    let lastResponse;

    for (let i = 0; i < responseTimes; i++) {
      lastResponse = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'testpass' });
      expect(lastResponse.status).not.toBe(429);
    }
  });

  it('should block requests exceeding the rate limit for sensitive endpoints', async () => {
    const responseTimes = 5;

    for (let i = 0; i < responseTimes; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'testpass' });
    }

    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'testpass' });

    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBeDefined();
  });

  it('should allow 100 requests to non-sensitive endpoints', async () => {
    const responseTimes = 100;
    let lastResponse;

    for (let i = 0; i < responseTimes; i++) {
      lastResponse = await request(app)
        .get('/api/health');
      expect(lastResponse.status).not.toBe(429);
    }
  });

  it('should block requests exceeding the rate limit for non-sensitive endpoints', async () => {
    const responseTimes = 100;

    for (let i = 0; i < responseTimes; i++) {
      await request(app)
        .get('/api/health');
    }

    const response = await request(app)
      .get('/api/health');

    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBeDefined();
  });
});
