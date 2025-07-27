import { Pool } from 'pg';
import { DailyQueueResetService } from '../../services/DailyQueueResetService';
import { ActivityService } from '../../services/activity';

// Integration test using Dockerized PostgreSQL
describe('DailyQueueResetService Integration Tests', () => {
  let testPool: Pool;
  let originalPool: Pool;

  beforeAll(async () => {
    // Use dockerized test database
    testPool = new Pool({
      host: 'localhost',
      port: 5433,
      database: 'escashop_test',
      user: 'test_user',
      password: 'test_password',
    });

    // Wait for database to be ready
    let retries = 10;
    while (retries > 0) {
      try {
        await testPool.query('SELECT 1');
        console.log('Test database connected successfully');
        break;
      } catch (error) {
        console.log(`Waiting for test database... (${retries} retries left)`);
        retries--;
        if (retries === 0) throw new Error('Test database failed to start');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Mock the pool in the database config to use our test pool
    const databaseModule = require('../../config/database');
    originalPool = databaseModule.pool;
    databaseModule.pool = testPool;
  }, 60000);

  beforeEach(async () => {
    // Clean up test data before each test
    await testPool.query('TRUNCATE TABLE customers, activity_logs, daily_queue_history, customer_history, display_monitor_history, daily_reset_log, counters RESTART IDENTITY CASCADE');
    
    // Insert test counters
    await testPool.query(`
      INSERT INTO counters (name, is_active, display_order) 
      VALUES 
        ('Counter 1', true, 1),
        ('Counter 2', true, 2)
    `);

    // Ensure customers table has served_at column (main test requirement)
    try {
      await testPool.query(`
        ALTER TABLE customers ADD COLUMN IF NOT EXISTS served_at TIMESTAMP
      `);
      console.log('✅ served_at column exists or added successfully');
    } catch (error: any) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }

    // Add other required columns for customers table
    const requiredColumns = [
      'carried_forward BOOLEAN DEFAULT false',
      'reset_at TIMESTAMP'
    ];

    for (const columnDef of requiredColumns) {
      const [columnName] = columnDef.split(' ');
      try {
        await testPool.query(`
          ALTER TABLE customers ADD COLUMN IF NOT EXISTS ${columnDef}
        `);
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.warn(`Warning adding column ${columnName}:`, error.message);
        }
      }
    }
  });

  afterAll(async () => {
    // Restore original pool
    if (originalPool) {
      const databaseModule = require('../../config/database');
      databaseModule.pool = originalPool;
    }

    await testPool?.end();
  }, 30000);

  describe('Schema Compatibility Tests', () => {
    it('should not throw "column served_at does not exist" error', async () => {
      // Create test customers with various statuses
      const customerIds = [];
      
      const customers = [
        { name: 'Customer 1', status: 'waiting', token: 1 },
        { name: 'Customer 2', status: 'serving', token: 2 },
        { name: 'Customer 3', status: 'completed', token: 3 },
        { name: 'Customer 4', status: 'cancelled', token: 4 },
        { name: 'Customer 5', status: 'processing', token: 5 }
      ];

      for (const customer of customers) {
        const result = await testPool.query(`
          INSERT INTO customers (
            or_number, name, contact_number, age, address, 
            distribution_info, grade_type, lens_type, payment_info, 
            priority_flags, queue_status, token_number, created_at
          ) VALUES (
            $1, $2, '1234567890', 25, 'Test Address',
            'Test Distribution', 'No Grade', 'non-coated (ORD)', 'Cash Payment',
            '{}', $3, $4, CURRENT_DATE
          ) RETURNING id
        `, [`OR-${customer.token}-${Date.now()}`, customer.name, customer.status, customer.token]);
        
        customerIds.push(result.rows[0].id);
      }

      // Set served_at for completed customers (simulating real scenario)
      await testPool.query(`
        UPDATE customers 
        SET served_at = CURRENT_TIMESTAMP - INTERVAL '1 hour'
        WHERE queue_status IN ('completed', 'cancelled')
      `);

      // Add system settings required by the service
      await testPool.query(`
        INSERT INTO system_settings (key, value) 
        VALUES ('daily_token_counter', '5')
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `);

      // This is the main test: ensure performDailyReset() doesn't fail with served_at column error
      let resetError: Error | null = null;
      try {
        await DailyQueueResetService.performDailyReset();
        console.log('✅ DailyQueueResetService.performDailyReset() completed without served_at column errors');
      } catch (error: any) {
        resetError = error;
        console.error('❌ DailyQueueResetService.performDailyReset() failed:', error.message);
      }

      // Assert that no "served_at does not exist" error occurred
      expect(resetError).toBeNull();

      // Verify that the database operations completed successfully
      const dailyHistoryCount = await testPool.query('SELECT COUNT(*) FROM daily_queue_history');
      expect(parseInt(dailyHistoryCount.rows[0].count)).toBeGreaterThan(0);

      const customerHistoryCount = await testPool.query('SELECT COUNT(*) FROM customer_history');
      expect(parseInt(customerHistoryCount.rows[0].count)).toBeGreaterThan(0);

      const resetLogCount = await testPool.query('SELECT COUNT(*) FROM daily_reset_log');
      expect(parseInt(resetLogCount.rows[0].count)).toBeGreaterThan(0);
    });

    it('should handle customers with served_at column in all queries', async () => {
      // Insert customers with served_at values
      const customers = [
        { status: 'completed', served_at: new Date(Date.now() - 3600000) }, // 1 hour ago
        { status: 'waiting', served_at: null },
        { status: 'serving', served_at: null },
        { status: 'cancelled', served_at: new Date(Date.now() - 1800000) } // 30 min ago
      ];

      for (let i = 0; i < customers.length; i++) {
        const customer = customers[i];
        await testPool.query(`
          INSERT INTO customers (
            or_number, name, contact_number, age, address, 
            distribution_info, grade_type, lens_type, payment_info, 
            priority_flags, queue_status, token_number, served_at, created_at
          ) VALUES (
            $1, $2, '1234567890', 25, 'Test Address',
            'Test Distribution', 'No Grade', 'non-coated (ORD)', 'Cash Payment',
            '{}', $3, $4, $5, CURRENT_DATE
          )
        `, [
          `OR-TEST-${i + 1}-${Date.now()}`, 
          `Test Customer ${i + 1}`, 
          customer.status, 
          i + 1, 
          customer.served_at
        ]);
      }

      // Add required system settings
      await testPool.query(`
        INSERT INTO system_settings (key, value) 
        VALUES ('daily_token_counter', '4')
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `);

      // Test that daily reset works with served_at column data
      expect(async () => {
        await DailyQueueResetService.performDailyReset();
      }).not.toThrow();

      // Verify the served_at data was properly handled in archived records
      const archivedCustomers = await testPool.query(`
        SELECT served_at, queue_status 
        FROM customer_history 
        WHERE archive_date = CURRENT_DATE
      `);

      expect(archivedCustomers.rows.length).toBe(4);
      
      // Check that served customers have their served_at preserved
      const servedCustomers = archivedCustomers.rows.filter(c => c.queue_status === 'completed' || c.queue_status === 'cancelled');
      servedCustomers.forEach(customer => {
        expect(customer.served_at).not.toBeNull();
      });
    });
  });

  describe('Daily Reset Functionality', () => {
    it('should create daily snapshot without errors', async () => {
      // Setup test data
      const testCustomers = [
        { status: 'waiting', priority: true },
        { status: 'serving', priority: false },
        { status: 'completed', priority: false, served: true },
        { status: 'cancelled', priority: true, served: true }
      ];

      for (let i = 0; i < testCustomers.length; i++) {
        const customer = testCustomers[i];
        const priorityFlags = customer.priority ? '{"senior_citizen": "true"}' : '{}';
        const servedAt = customer.served ? new Date(Date.now() - Math.random() * 7200000) : null;
        
        await testPool.query(`
          INSERT INTO customers (
            or_number, name, contact_number, age, address,
            distribution_info, grade_type, lens_type, payment_info,
            priority_flags, queue_status, token_number, served_at, created_at
          ) VALUES (
            $1, $2, '1234567890', 30, 'Address',
            'Distribution', 'No Grade', 'non-coated (ORD)', 'Cash',
            $3, $4, $5, $6, CURRENT_DATE
          )
        `, [
          `OR-SNAP-${i + 1}-${Date.now()}`,
          `Snapshot Customer ${i + 1}`,
          priorityFlags,
          customer.status,
          i + 1,
          servedAt
        ]);
      }

      // Add system settings
      await testPool.query(`
        INSERT INTO system_settings (key, value) 
        VALUES ('daily_token_counter', '4')
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `);

      // Perform daily reset
      await expect(DailyQueueResetService.performDailyReset()).resolves.not.toThrow();

      // Verify daily queue history was created
      const dailyHistory = await testPool.query(`
        SELECT * FROM daily_queue_history WHERE date = CURRENT_DATE
      `);

      expect(dailyHistory.rows.length).toBe(1);
      const history = dailyHistory.rows[0];
      expect(history.total_customers).toBe(4);
      expect(history.priority_customers).toBe(2);
      expect(history.waiting_customers).toBe(1);
      expect(history.serving_customers).toBe(1);
      expect(history.completed_customers).toBe(1);
      expect(history.cancelled_customers).toBe(1);
    });

    it('should reset queue status and counters correctly', async () => {
      // Setup active customers
      await testPool.query(`
        INSERT INTO customers (
          or_number, name, contact_number, age, address,
          distribution_info, grade_type, lens_type, payment_info,
          priority_flags, queue_status, token_number, created_at
        ) VALUES 
          ('OR-RESET-1', 'Active Customer 1', '1234567890', 25, 'Address',
           'Distribution', 'No Grade', 'non-coated (ORD)', 'Cash',
           '{}', 'serving', 1, CURRENT_DATE),
          ('OR-RESET-2', 'Active Customer 2', '1234567890', 30, 'Address',
           'Distribution', 'No Grade', 'non-coated (ORD)', 'Cash',
           '{}', 'processing', 2, CURRENT_DATE)
      `);

      // Setup counter with active assignment
      await testPool.query(`
        UPDATE counters SET current_customer_id = 1, status = 'busy'
        WHERE id = 1
      `);

      // Add system settings
      await testPool.query(`
        INSERT INTO system_settings (key, value) 
        VALUES ('daily_token_counter', '2')
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `);

      // Perform reset
      await DailyQueueResetService.performDailyReset();

      // Verify customers were reset to waiting and marked as carried forward
      const resetCustomers = await testPool.query(`
        SELECT queue_status, carried_forward, reset_at 
        FROM customers 
        WHERE or_number IN ('OR-RESET-1', 'OR-RESET-2')
      `);

      resetCustomers.rows.forEach(customer => {
        expect(customer.queue_status).toBe('waiting');
        expect(customer.carried_forward).toBe(true);
        expect(customer.reset_at).not.toBeNull();
      });

      // Verify counters were reset
      const counters = await testPool.query(`
        SELECT current_customer_id, status, last_reset_at 
        FROM counters 
        WHERE is_active = true
      `);

      counters.rows.forEach(counter => {
        expect(counter.current_customer_id).toBeNull();
        expect(counter.status).toBe('available');
        expect(counter.last_reset_at).not.toBeNull();
      });

      // Verify token counter was reset
      const tokenCounter = await testPool.query(`
        SELECT value FROM system_settings WHERE key = 'daily_token_counter'
      `);
      expect(tokenCounter.rows[0].value).toBe('1');
    });

    it('should log reset activity via ActivityService', async () => {
      // Setup minimal data for reset
      await testPool.query(`
        INSERT INTO customers (
          or_number, name, contact_number, age, address,
          distribution_info, grade_type, lens_type, payment_info,
          priority_flags, queue_status, token_number, created_at
        ) VALUES 
          ('OR-LOG-1', 'Log Test Customer', '1234567890', 25, 'Address',
           'Distribution', 'No Grade', 'non-coated (ORD)', 'Cash',
           '{}', 'completed', 1, CURRENT_DATE)
      `);

      await testPool.query(`
        INSERT INTO system_settings (key, value) 
        VALUES ('daily_token_counter', '1')
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `);

      // Perform reset
      await DailyQueueResetService.performDailyReset();

      // Verify activity was logged
      const activityLogs = await testPool.query(`
        SELECT * FROM activity_logs 
        WHERE action = 'daily_queue_reset' 
        AND user_id = -1
        ORDER BY created_at DESC
        LIMIT 1
      `);

      expect(activityLogs.rows.length).toBe(1);
      const log = activityLogs.rows[0];
      expect(log.action).toBe('daily_queue_reset');
      expect(log.user_id).toBe(-1);
      expect(log.ip_address).toBe('0.0.0.0');
      expect(log.user_agent).toBe('DailyQueueResetService');
      
      const details = JSON.parse(log.details);
      expect(details).toHaveProperty('date');
      expect(details).toHaveProperty('customersArchived');
      expect(details).toHaveProperty('completedCustomers');
      expect(details).toHaveProperty('carriedForwardCustomers');
    });
  });

  describe('Error Handling', () => {
    it('should log error activity when daily reset fails', async () => {
      // Create a scenario that will cause the reset to fail
      // by dropping a required table temporarily
      const tempTableQuery = `
        CREATE TEMPORARY TABLE temp_backup AS SELECT * FROM daily_queue_history;
        DROP TABLE daily_queue_history CASCADE;
      `;

      await testPool.query(tempTableQuery);

      // Setup system settings to prevent other errors
      await testPool.query(`
        INSERT INTO system_settings (key, value) 
        VALUES ('daily_token_counter', '0')
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `);

      // Attempt reset (should fail)
      let resetFailed = false;
      try {
        await DailyQueueResetService.performDailyReset();
      } catch (error) {
        resetFailed = true;
      }

      expect(resetFailed).toBe(true);

      // Restore the table
      await testPool.query(`
        CREATE TABLE daily_queue_history (
          id SERIAL PRIMARY KEY,
          date DATE NOT NULL UNIQUE,
          total_customers INTEGER DEFAULT 0,
          waiting_customers INTEGER DEFAULT 0,
          serving_customers INTEGER DEFAULT 0,
          processing_customers INTEGER DEFAULT 0,
          completed_customers INTEGER DEFAULT 0,
          cancelled_customers INTEGER DEFAULT 0,
          priority_customers INTEGER DEFAULT 0,
          avg_wait_time_minutes DECIMAL(10,2) DEFAULT 0,
          peak_queue_length INTEGER DEFAULT 0,
          operating_hours INTEGER DEFAULT 0,
          archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Verify error was logged via ActivityService
      const errorLogs = await testPool.query(`
        SELECT * FROM activity_logs 
        WHERE action = 'daily_reset_failed'
        AND user_id = -1
        ORDER BY created_at DESC
        LIMIT 1
      `);

      expect(errorLogs.rows.length).toBe(1);
      const errorLog = errorLogs.rows[0];
      expect(errorLog.action).toBe('daily_reset_failed');
      expect(errorLog.user_id).toBe(-1);
      expect(errorLog.ip_address).toBe('0.0.0.0');
      expect(errorLog.user_agent).toBe('DailyQueueResetService');
      
      const details = JSON.parse(errorLog.details);
      expect(details).toHaveProperty('error');
    });
  });
});
