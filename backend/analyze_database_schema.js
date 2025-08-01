const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'escashop',
  password: 'postgres',
  port: 5432,
});

async function analyzeSchema() {
  try {
    console.log('=== DATABASE SCHEMA ANALYSIS ===\n');

    // 1. Check applied migrations
    console.log('1. APPLIED MIGRATIONS:');
    const migrations = await pool.query(
      'SELECT version, name, applied_at, status FROM schema_migrations ORDER BY version'
    );
    console.table(migrations.rows);

    // 2. Get all current tables
    console.log('\n2. CURRENT TABLES:');
    const tables = await pool.query(`
      SELECT table_name, 
             (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
      FROM information_schema.tables t 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE' 
      ORDER BY table_name
    `);
    console.table(tables.rows);

    // 3. Check tables expected from migration 001 but missing
    console.log('\n3. MIGRATION 001 EXPECTED TABLES:');
    const migration001Tables = [
      'users', 'customers', 'transactions', 'payment_settlements',
      'queue', 'activity_logs', 'notification_logs', 'system_settings',
      'daily_reports', 'grade_types', 'lens_types', 'counters', 'sms_templates'
    ];
    
    const currentTableNames = tables.rows.map(row => row.table_name);
    const missingFromMigration001 = migration001Tables.filter(table => !currentTableNames.includes(table));
    const extraTables = currentTableNames.filter(table => !migration001Tables.includes(table));
    
    console.log('Missing from Migration 001:', missingFromMigration001);
    console.log('Extra tables (not in Migration 001):', extraTables);

    // 4. Check tables expected from migration 003
    console.log('\n4. MIGRATION 003 EXPECTED TABLES:');
    const migration003Tables = [
      'queue_analytics', 'daily_queue_summary', 'queue_events', 
      'sms_notifications', 'customer_notifications'
    ];
    
    const missingFromMigration003 = migration003Tables.filter(table => !currentTableNames.includes(table));
    console.log('Missing from Migration 003:', missingFromMigration003);
    console.log('Present from Migration 003:', migration003Tables.filter(table => currentTableNames.includes(table)));

    // 5. Check tables expected from migration 004
    console.log('\n5. MIGRATION 004 EXPECTED TABLES:');
    const migration004Tables = ['payment_tracking'];
    const missingFromMigration004 = migration004Tables.filter(table => !currentTableNames.includes(table));
    console.log('Missing from Migration 004:', missingFromMigration004);

    // 6. Analyze key columns that migrations would add/modify
    console.log('\n6. KEY COLUMN ANALYSIS:');
    
    // Check system_settings for migration 002 expected columns
    try {
      const systemSettingsColumns = await pool.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'system_settings' 
        ORDER BY ordinal_position
      `);
      console.log('system_settings columns:');
      console.table(systemSettingsColumns.rows);
    } catch (err) {
      console.log('system_settings table not found');
    }

    // Check if payment_settlements has paid_at column (from migration 004)
    try {
      const paymentSettlementsColumns = await pool.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'payment_settlements' 
        ORDER BY ordinal_position
      `);
      console.log('\npayment_settlements columns:');
      console.table(paymentSettlementsColumns.rows);
      
      const hasPaidAt = paymentSettlementsColumns.rows.some(row => row.column_name === 'paid_at');
      console.log('Has paid_at column (Migration 004 feature):', hasPaidAt);
    } catch (err) {
      console.log('payment_settlements table not found');
    }

    // 7. Check application-specific tables that might not be in migrations
    console.log('\n7. APPLICATION-SPECIFIC TABLES ANALYSIS:');
    
    const extraTableAnalysis = [];
    for (const tableName of extraTables) {
      try {
        const columnCount = await pool.query(`
          SELECT count(*) as column_count 
          FROM information_schema.columns 
          WHERE table_name = $1 AND table_schema = 'public'
        `, [tableName]);
        
        const rowCount = await pool.query(`SELECT count(*) as row_count FROM "${tableName}"`);
        
        extraTableAnalysis.push({
          table_name: tableName,
          column_count: columnCount.rows[0].column_count,
          row_count: rowCount.rows[0].row_count
        });
      } catch (err) {
        extraTableAnalysis.push({
          table_name: tableName,
          column_count: 'ERROR',
          row_count: 'ERROR'
        });
      }
    }
    
    console.table(extraTableAnalysis);

    // 8. Test critical application functionality
    console.log('\n8. CRITICAL FUNCTIONALITY TEST:');
    
    // Test if customer_history exists (needed for queue reset)
    const customerHistoryExists = currentTableNames.includes('customer_history');
    console.log('customer_history exists (queue reset functionality):', customerHistoryExists);
    
    // Test if queue_events exists (needed for analytics)
    const queueEventsExists = currentTableNames.includes('queue_events');
    console.log('queue_events exists (analytics functionality):', queueEventsExists);
    
    // Test if daily_queue_summary exists (needed for analytics dashboard)
    const dailyQueueSummaryExists = currentTableNames.includes('daily_queue_summary');
    console.log('daily_queue_summary exists (analytics dashboard):', dailyQueueSummaryExists);

    // 9. Check foreign key constraints
    console.log('\n9. FOREIGN KEY CONSTRAINTS:');
    const constraints = await pool.query(`
      SELECT 
        tc.table_name, 
        tc.constraint_name, 
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_name
    `);
    
    console.log(`Found ${constraints.rows.length} foreign key constraints`);
    if (constraints.rows.length > 0) {
      console.table(constraints.rows.slice(0, 10)); // Show first 10
    }

    console.log('\n=== ANALYSIS COMPLETE ===');

  } catch (error) {
    console.error('Analysis error:', error);
  } finally {
    await pool.end();
  }
}

analyzeSchema();
