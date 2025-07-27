import request from 'supertest';
import { app } from '../../app';
import { pool } from '../../config/database';
import { QueueStatus, UserRole, User } from '../../types';

describe('REST API Integration Tests', () => {
  let token: string;
  let testUserId: number;
  let testCustomerId: number;

  beforeAll(async () => {
    // Create test user for authentication
    const result = await pool.query(`
      INSERT INTO users (email, password, full_name, role, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, ['rest-test@example.com', 'hashedpassword', 'REST Test User', UserRole.ADMIN, 'active']);
    testUserId = result.rows[0].id;

    // Authenticate user to retrieve JWT token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rest-test@example.com', password: 'hashedpassword' });
    token = res.body.token;

    // Create test customer
    const customerResult = await pool.query(`
      INSERT INTO customers (name, contact_number, queue_status)
      VALUES ($1, $2, $3)
      RETURNING id
    `, ['REST Test Customer', '1234567890', QueueStatus.WAITING]);
    testCustomerId = customerResult.rows[0].id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM customers WHERE id = $1', [testCustomerId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  it('should change status from waiting to serving', async () => {
    const response = await request(app)
      .post(`/api/customers/${testCustomerId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: QueueStatus.SERVING });

    expect(response.status).toBe(200);
    expect(response.body.queue_status).toBe(QueueStatus.SERVING);
  });

  it('should not allow unauthorized role to change status', async () => {
    await request(app)
      .post(`/api/customers/${testCustomerId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: QueueStatus.COMPLETED, role: UserRole.SALES })
      .expect(403);
  });
});
