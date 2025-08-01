import { pool } from './src/config/database';

async function checkAnalyticsTables() {
  try {
    console.log('🔍 Checking Analytics Tables in Database...\n');
    
    // Check all queue/analytics related tables
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%analytics%' OR table_name LIKE '%queue%' OR table_name LIKE '%summary%')
      ORDER BY table_name
    `;
    
    const tablesResult = await pool.query(tablesQuery);
    console.log('📊 Analytics/Queue Related Tables:');
    tablesResult.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });
    
    // Check specific analytics tables
    const specificTables = [
      'queue_analytics',
      'queue_analytics_hourly', 
      'queue_analytics_daily',
      'daily_queue_summary',
      'queue_events'
    ];
    
    console.log('\n🎯 Checking Specific Analytics Tables:');
    for (const tableName of specificTables) {
      try {
        const result = await pool.query(`SELECT COUNT(*) as count FROM ${tableName} LIMIT 1`);
        console.log(`   ✅ ${tableName}: EXISTS (${result.rows[0].count} records)`);
      } catch (error) {
        console.log(`   ❌ ${tableName}: MISSING`);
      }
    }
    
    // Try to create missing analytics tables (if needed)
    console.log('\n🛠️  Attempting to create missing analytics tables...');
    
    // Create queue_analytics table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS queue_analytics (
          id SERIAL PRIMARY KEY,
          date DATE NOT NULL,
          hour INTEGER NOT NULL,
          total_customers INTEGER DEFAULT 0,
          priority_customers INTEGER DEFAULT 0,
          avg_wait_time_minutes DECIMAL(10,2) DEFAULT 0,
          avg_service_time_minutes DECIMAL(10,2) DEFAULT 0,
          peak_queue_length INTEGER DEFAULT 0,
          customers_served INTEGER DEFAULT 0,
          avg_processing_duration_minutes DECIMAL(10,2) DEFAULT 0,
          total_processing_count INTEGER DEFAULT 0,
          max_processing_duration_minutes DECIMAL(10,2) DEFAULT 0,
          min_processing_duration_minutes DECIMAL(10,2) DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(date, hour)
        )
      `);
      console.log('   ✅ queue_analytics table created/verified');
    } catch (error) {
      const err = error as Error;
      console.log('   ⚠️  queue_analytics table issue:', err.message);
    }
    
    // Create daily_queue_summary table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS daily_queue_summary (
          id SERIAL PRIMARY KEY,
          date DATE NOT NULL UNIQUE,
          total_customers INTEGER DEFAULT 0,
          priority_customers INTEGER DEFAULT 0,
          avg_wait_time_minutes DECIMAL(10,2) DEFAULT 0,
          avg_service_time_minutes DECIMAL(10,2) DEFAULT 0,
          peak_hour INTEGER DEFAULT 0,
          peak_queue_length INTEGER DEFAULT 0,
          customers_served INTEGER DEFAULT 0,
          busiest_counter_id INTEGER,
          avg_processing_duration_minutes DECIMAL(10,2) DEFAULT 0,
          total_processing_count INTEGER DEFAULT 0,
          max_processing_duration_minutes DECIMAL(10,2) DEFAULT 0,
          min_processing_duration_minutes DECIMAL(10,2) DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('   ✅ daily_queue_summary table created/verified');
    } catch (error) {
      const err = error as Error;
      console.log('   ⚠️  daily_queue_summary table issue:', err.message);
    }
    
    // Create queue_events table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS queue_events (
          id SERIAL PRIMARY KEY,
          customer_id INTEGER NOT NULL,
          event_type VARCHAR(50) NOT NULL,
          counter_id INTEGER,
          queue_position INTEGER,
          wait_time_minutes DECIMAL(10,2),
          service_time_minutes DECIMAL(10,2),
          processing_duration_minutes DECIMAL(10,2),
          is_priority BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('   ✅ queue_events table created/verified');
    } catch (error) {
      const err = error as Error;
      console.log('   ⚠️  queue_events table issue:', err.message);
    }
    
    console.log('\n🎉 Analytics tables check completed!');
    
  } catch (error) {
    console.error('❌ Error checking analytics tables:', error);
  } finally {
    await pool.end();
  }
}

checkAnalyticsTables();
