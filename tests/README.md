# End-to-End Regression Tests

This directory contains Playwright end-to-end tests for the EscaShop application covering critical regression scenarios.

## Test Files

### 1. `transactions-page.spec.ts`
**Purpose**: Ensures no `NaN` requests occur when loading the transactions page.

**What it tests**:
- Opens the Transactions page
- Monitors all network requests for `NaN` values in URLs or request data
- Tests various interactions (pagination, filtering, sorting) that might trigger NaN issues
- Verifies that all API requests to `/api/transactions` are valid
- Handles empty transaction lists gracefully

### 2. `cashier-transaction-flow.spec.ts` 
**Purpose**: Tests cashier role functionality for creating and settling transactions with proper HTTP responses.

**What it tests**:
- Login as cashier user
- Create a new transaction via UI
- Settle the transaction (add payment)
- Verify all API responses are 200-299 (successful)
- Direct API testing for transaction creation and settlement
- Cashier dashboard access validation

### 3. `websocket-connection-recovery.spec.ts`
**Purpose**: Tests WebSocket connection resilience when the server is killed and restarted.

**What it tests**:
- Establishes WebSocket connection
- Kills the WebSocket server for 10 seconds
- Verifies UI shows "Connection lost" message
- Restarts the server
- Ensures connection recovers automatically
- Tests graceful handling of connection interruptions
- Validates WebSocket behavior across page navigation

## Running the Tests

### Prerequisites
- Both backend and frontend servers should be running
- Database should be set up with test data
- Admin user: `admin@escashop.com` / `admin123`
- Cashier user: `cashier@escashop.com` / `cashier123`

### Commands

Run all E2E tests:
```bash
npm run test:e2e
```

Run individual test suites:
```bash
npm run test:e2e:transactions    # NaN prevention tests
npm run test:e2e:cashier        # Cashier workflow tests  
npm run test:e2e:websocket      # WebSocket recovery tests
```

Run with UI mode:
```bash
npm run test:e2e:ui
```

Debug mode:
```bash
npm run test:e2e:debug
```

View test report:
```bash
npm run test:e2e:report
```

## Configuration

Tests are configured in `playwright.config.ts` with:
- Base URL: `http://localhost:3000` 
- Backend: `http://localhost:5000`
- Automatic server startup before tests
- Screenshots on failure
- Video recording on retry
- Trace collection on failure

## Test Data Requirements

The tests expect:
- At least one customer in the database (ID: 1)
- Admin and cashier users to exist
- Backend API endpoints to be functional
- WebSocket server running on the backend

## Troubleshooting

**Tests failing on login**: Verify user accounts exist with correct passwords.

**Network request failures**: Ensure both backend (port 5000) and frontend (port 3000) are running.

**WebSocket tests failing**: The WebSocket recovery test kills and restarts the backend server. On Windows, it uses `taskkill`, on Unix systems it uses `pkill`. Ensure the test runner has appropriate permissions.

**NaN request detection**: If tests report false positives, check the request monitoring logic and adjust the detection patterns.

## CI/CD Integration

These tests can be integrated into CI/CD pipelines:
- Use headless mode in CI: `npm run test:e2e -- --headed=false`
- Generate JUnit reports: `npm run test:e2e -- --reporter=junit`
- Retry failed tests: Set `retries: 2` in `playwright.config.ts`
