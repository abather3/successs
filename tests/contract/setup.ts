import 'dotenv/config';

// Global test configuration for contract tests
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-for-contract-testing';
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-for-contract-testing';

  // Set up database connection for tests if needed
  console.log('Setting up contract test environment...');
});

afterAll(async () => {
  console.log('Cleaning up contract test environment...');
});
