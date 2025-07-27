# Payment System Testing Guide

This document provides comprehensive testing instructions for the payment settlement system including unit tests, integration tests, migration compatibility tests, and end-to-end tests.

## Overview

The payment system includes the following test suites:

1. **Unit Tests** - Service calculations and validation logic
2. **Integration Tests** - Full payment flows and business logic
3. **Migration Tests** - Backward compatibility with legacy data
4. **E2E Tests** - Frontend payment flows using Cypress

## Quick Start

### Run All Tests
```bash
npm run test:all
```

### Run Individual Test Suites
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Migration tests only
npm run test:migration

# Coverage analysis
npm run test:coverage

# E2E tests
npm run test:e2e
```

## Test Structure

### Unit Tests (`src/__tests__/paymentSettlements.test.ts`)
- Payment amount validation
- Settlement calculation logic
- Payment mode validation
- Business rule enforcement
- Error handling
- Edge cases

### Integration Tests (`src/__tests__/integration/payment-flows.test.ts`)
- Full payment workflows
- Partial payment scenarios
- Multiple payment handling
- Over-payment protection
- WebSocket event validation
- Database transaction integrity

### Migration Tests (`src/__tests__/migration/backward-compatibility.test.ts`)
- Legacy data migration
- Default value application
- Data integrity preservation
- Performance validation
- Referential integrity
- Mixed data scenarios

### E2E Tests (`frontend/cypress/e2e/payment-flows.cy.js`)
- Frontend payment forms
- Real-time UI updates
- Payment validation
- Settlement history
- Error handling
- WebSocket integration

## Test Configuration

### Jest Configuration
```json
{
  "preset": "ts-jest",
  "testEnvironment": "node",
  "collectCoverageFrom": [
    "src/**/*.{ts,js}",
    "!src/**/*.d.ts",
    "!src/**/*.test.{ts,js}",
    "!src/migrations/**",
    "!src/types/**",
    "!src/config/**"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  }
}
```

### Coverage Requirements
- **Lines**: 80% minimum
- **Functions**: 80% minimum
- **Branches**: 80% minimum
- **Statements**: 80% minimum

## Running Tests

### Development Mode
```bash
# Watch mode for development
npm run test:watch

# Quick test run
npm run test:quick

# Specific test suites
npm run test:settlements
npm run test:websocket
```

### CI/CD Mode
```bash
# CI optimized test run
npm run test:ci

# Full coverage report
npm run test:coverage:full
```

### Cypress E2E Tests
```bash
# Interactive mode
npm run test:e2e:open

# Headless mode
npm run test:e2e

# Specific browsers
npm run cypress:run:chrome
npm run cypress:run:firefox
```

## Test Data

### Mock Data Structure
```typescript
// Transaction test data
const mockTransaction = {
  id: 1,
  customer_id: 1,
  amount: 1000,
  paid_amount: 500,
  balance_amount: 500,
  payment_status: 'partial',
  payment_mode: 'cash',
  created_at: new Date(),
  updated_at: new Date()
};

// Settlement test data
const mockSettlement = {
  id: 1,
  transaction_id: 1,
  amount: 300,
  payment_mode: 'card',
  notes: 'Partial payment',
  processed_by: 'user123',
  created_at: new Date()
};
```

### Test Database Setup
```typescript
// Test database configuration
const testDb = {
  client: 'sqlite3',
  connection: ':memory:',
  useNullAsDefault: true,
  migrations: {
    directory: './src/migrations'
  }
};
```

## Test Scenarios

### Payment Settlement Scenarios
1. **Full Payment** - Single payment covers entire balance
2. **Partial Payment** - Multiple payments to complete transaction
3. **Over-Payment Protection** - Prevents payments exceeding balance
4. **Multi-Mode Payments** - Different payment methods for same transaction
5. **Concurrent Payments** - Race condition handling
6. **Invalid Amounts** - Negative, zero, or non-numeric amounts
7. **Payment Validation** - Required fields and format validation

### Migration Scenarios
1. **Legacy Data** - Transactions without payment tracking
2. **Default Values** - Applying correct defaults to legacy records
3. **Data Integrity** - Preserving existing relationships
4. **Performance** - Large dataset migration handling
5. **Rollback Safety** - Ensuring migration reversibility

### WebSocket Event Scenarios
1. **Real-time Updates** - Transaction status changes
2. **Settlement Notifications** - New payment alerts
3. **Multi-client Sync** - Updates across multiple sessions
4. **Error Handling** - Connection failures and reconnection
5. **Event Ordering** - Proper sequence of notifications

## Coverage Reports

### HTML Coverage Report
After running coverage tests, open:
```
coverage/lcov-report/index.html
```

### Text Coverage Summary
```bash
npm run test:coverage
```

### JSON Coverage Data
```bash
npm run test:coverage:full
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Reset test database
   npm run db:reset:test
   ```

2. **Port Conflicts**
   ```bash
   # Kill processes on test ports
   lsof -ti:3001 | xargs kill -9
   ```

3. **Memory Issues**
   ```bash
   # Increase Node.js memory
   NODE_OPTIONS="--max-old-space-size=4096" npm test
   ```

4. **Cypress Issues**
   ```bash
   # Clear Cypress cache
   npx cypress cache clear
   npx cypress install
   ```

### Debug Mode
```bash
# Enable debug logging
DEBUG=app:* npm test

# Verbose Jest output
npm test -- --verbose --no-cache
```

## Best Practices

### Test Writing
- Use descriptive test names
- Test both success and failure scenarios
- Mock external dependencies
- Clean up after tests
- Use proper assertions

### Test Organization
- Group related tests in describe blocks
- Use beforeEach/afterEach for setup/cleanup
- Keep tests independent
- Use shared utilities for common operations

### Performance
- Use `--runInBand` for debugging
- Minimize database operations
- Use in-memory databases for unit tests
- Parallel test execution for CI

## Continuous Integration

### GitHub Actions Example
```yaml
name: Test Payment System
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm ci
      - run: npm run test:all
      - run: npm run test:coverage
```

### Test Results
Test results are saved to `test-results.json` with:
- Test summary statistics
- Individual test results
- Coverage information
- Timestamp and metadata

## Support

For issues or questions about testing:
1. Check the troubleshooting section
2. Review test output for specific errors
3. Consult the Jest documentation
4. Review Cypress documentation for E2E issues

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure all tests pass
3. Maintain coverage thresholds
4. Update documentation
5. Add E2E tests for UI changes
