import 'dotenv/config';

// Global test configuration for contract tests
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.REACT_APP_API_URL = 'http://localhost:1234';

  console.log('Setting up frontend contract test environment...');
});

afterAll(async () => {
  console.log('Cleaning up frontend contract test environment...');
});
