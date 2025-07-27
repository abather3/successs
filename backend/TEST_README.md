# Integration Tests - Daily Queue Reset & Activity Service

This document describes the comprehensive integration tests added for the `DailyQueueResetService.performDailyReset()` and `ActivityService.log()` methods against a Dockerized PostgreSQL database.

## Overview

The tests verify:

1. **DailyQueueResetService** - No `column served_at does not exist` errors
2. **ActivityService** - Proper handling of `'system'`/`'scheduler'` IP address mapping to valid IPs

## Test Structure

```
src/__tests__/
├── integration/
│   └── dailyQueueReset.test.ts      # DailyQueueResetService integration tests
└── services/
    └── activityService.test.ts      # ActivityService unit/integration tests
```

## Prerequisites

1. **Docker & Docker Compose** must be installed
   - Docker Desktop: https://www.docker.com/products/docker-desktop
   
2. **Node.js dependencies** must be installed:
   ```bash
   npm install
   ```

## Quick Start

### 1. Start Test Environment
```bash
npm run test:docker:start
```

### 2. Run Integration Tests
```bash
npm run test:integration
```

### 3. Stop Test Environment
```bash
npm run test:docker:stop
```

## Available Test Scripts

| Script | Description |
|--------|-------------|
| `npm run test:integration` | Run all integration tests (auto-starts Docker if needed) |
| `npm run test:docker:start` | Start Docker PostgreSQL test database |
| `npm run test:docker:stop` | Stop Docker test environment |
| `npm run test:docker:status` | Check status of test database and tables |
| `npm run test:docker:setup` | Setup test schema and required columns |

## Test Environment Details

### Docker Configuration
- **Database**: PostgreSQL 15 Alpine
- **Port**: 5433 (to avoid conflicts with local PostgreSQL)
- **Database Name**: `escashop_test`
- **Username**: `test_user`
- **Password**: `test_password`

### Database Schema
The tests ensure the following database schema requirements:

#### customers table
- ✅ `served_at TIMESTAMP` column exists
- ✅ `carried_forward BOOLEAN` column exists
- ✅ `reset_at TIMESTAMP` column exists

#### counters table
- ✅ `status VARCHAR(20)` column exists
- ✅ `last_reset_at TIMESTAMP` column exists

#### activity_logs table
- ✅ `ip_address VARCHAR(45)` accepts valid IP addresses
- ✅ Non-IP strings are mapped to '0.0.0.0'

## Test Coverage

### DailyQueueResetService Tests

#### Schema Compatibility Tests
- ✅ **No `served_at` column errors** - Main requirement verification
- ✅ **Handle existing `served_at` data** - Verifies proper data handling
- ✅ **Archive served_at timestamps** - Preserves timing data in history

#### Daily Reset Functionality
- ✅ **Create daily snapshot** - Aggregates queue metrics
- ✅ **Reset queue status and counters** - Resets active operations  
- ✅ **Log reset activity** - Records operations via ActivityService
- ✅ **Handle reset failures** - Error logging and rollback

#### Data Verification
- ✅ **Daily queue history created** - Archive table populated
- ✅ **Customer history preserved** - Historical records maintained
- ✅ **Counter assignments reset** - Available for new day
- ✅ **Token counter reset** - Sequential numbering restarted

### ActivityService Tests

#### IP Address Validation & Mapping
- ✅ **Map 'system' → '0.0.0.0'** - System operations use valid IP
- ✅ **Map 'scheduler' → '0.0.0.0'** - Scheduler operations use valid IP
- ✅ **Valid IPv4 addresses unchanged** - Real IPs preserved
- ✅ **Valid IPv6 addresses unchanged** - IPv6 support maintained
- ✅ **Invalid strings → '0.0.0.0'** - Fallback for non-IP values

#### Service Integration Scenarios
- ✅ **DailyQueueResetService logging** - Success and failure scenarios
- ✅ **Scheduler service logging** - Automated task logging
- ✅ **Bulk insert operations** - No database constraint violations
- ✅ **Concurrent logging** - Thread-safe operations

#### Database Integration
- ✅ **Proper storage and retrieval** - Data integrity verification
- ✅ **Complex details serialization** - JSON handling
- ✅ **Error handling** - Graceful failure modes

## Running Specific Tests

### Run only DailyQueueResetService tests:
```bash
npx jest --testPathPattern="dailyQueueReset.test.ts"
```

### Run only ActivityService tests:
```bash
npx jest --testPathPattern="activityService.test.ts"
```

### Run with coverage:
```bash
npm run test:coverage -- --testPathPattern="integration|services"
```

### Run in watch mode:
```bash
npm run test:watch -- --testPathPattern="integration"
```

## Troubleshooting

### Docker Issues

**Problem**: `Docker is not running`
```bash
# Start Docker Desktop application
# Or on Linux: sudo systemctl start docker
```

**Problem**: `Port 5433 is already in use`
```bash
# Check what's using the port
netstat -tulpn | grep 5433
# Kill the process or change port in docker-compose.test.yml
```

**Problem**: `Database connection failed`
```bash
# Check Docker container status
npm run test:docker:status

# Restart the environment
npm run test:docker:stop
npm run test:docker:start
```

### Test Issues

**Problem**: `Table 'served_at' column missing`
```bash
# Setup test schema
npm run test:docker:setup
```

**Problem**: `Tests timeout`
```bash
# Increase Jest timeout in jest.config.js
# Or wait for database to fully initialize
```

### Clean Up

**Remove all test data:**
```bash
node scripts/test-docker.js cleanup
```

**Remove Docker volumes:**
```bash
docker-compose -f docker-compose.test.yml down -v
```

## Test Output Examples

### Successful Test Run
```
✅ DailyQueueResetService Integration Tests
  ✅ Schema Compatibility Tests
    ✅ should not throw "column served_at does not exist" error
    ✅ should handle customers with served_at column in all queries
  ✅ Daily Reset Functionality  
    ✅ should create daily snapshot without errors
    ✅ should reset queue status and counters correctly
    ✅ should log reset activity via ActivityService

✅ ActivityService Tests
  ✅ IP Address Validation and Mapping
    ✅ should map "system" string to valid IP address (0.0.0.0)
    ✅ should map "scheduler" string to valid IP address (0.0.0.0)
    ✅ should ensure inserts succeed with system/scheduler mapped to valid IP
```

### Schema Verification
```
npm run test:docker:status

Container running: true
Database connected: ✅
Tables found: 24
All required tables present: ✅
```

## Integration with CI/CD

For continuous integration, add this to your CI configuration:

```yaml
# GitHub Actions example
- name: Start Test Database
  run: npm run test:docker:start

- name: Run Integration Tests  
  run: npm run test:integration

- name: Stop Test Database
  run: npm run test:docker:stop
```

## Key Improvements Made

1. **Docker-based testing** - Isolated, reproducible test environment
2. **Schema validation** - Ensures `served_at` column exists before testing
3. **IP address mapping** - Verifies `'system'`/`'scheduler'` → valid IP conversion
4. **Error scenario testing** - Tests failure cases and rollback behavior
5. **Comprehensive coverage** - Tests all critical paths and edge cases
6. **Easy automation** - Simple commands for CI/CD integration

These tests ensure that:
- ✅ `DailyQueueResetService.performDailyReset()` works with new schema
- ✅ `ActivityService.log()` handles non-IP strings gracefully  
- ✅ No database errors occur during daily operations
- ✅ All logging operations succeed with proper IP address handling
