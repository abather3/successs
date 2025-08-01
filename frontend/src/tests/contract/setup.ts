import 'dotenv/config';

// Global test configuration for contract tests
beforeAll(async () => {
  // Set test environment variables
  Object.defineProperty(process.env, 'NODE_ENV', {
    value: 'test',
    writable: true
  });
  process.env.REACT_APP_API_URL = 'http://localhost:1234';

  console.log('Setting up frontend contract test environment...');
});

afterAll(async () => {
  console.log('Cleaning up frontend contract test environment...');
});
