#!/usr/bin/env ts-node

import 'dotenv/config';
import { pool, connectDatabase } from '../src/config/database';

async function verifyResetTables() {
  try {
    console.log('🔍 Verifying Daily Queue Reset Tables...');
    console.log('⏰ Timestamp:', new Date().toISOString());
    
    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected');
    
    // Check daily_queue_history table
    console.log('\n📊 Checking daily_queue_history table:');
    const queueHistoryResult = await pool.query(`
      SELECT 
        date, 
        total_customers, 
        completed_customers, 
        waiting_customers, 
        serving_customers,
        avg_wait_time_minutes,
        peak_queue_length,
        archived_at
      FROM daily_queue_history 
      ORDER BY date DESC 
      LIMIT 5
    `);
    
    if (queueHistoryResult.rows.length > 0) {
      console.log(`✅ Found ${queueHistoryResult.rows.length} records in daily_queue_history:`);
      queueHistoryResult.rows.forEach((row, index) => {
        console.log(`  ${index + 1}. Date: ${row.date}, Total: ${row.total_customers}, Completed: ${row.completed_customers}, Avg Wait: ${row.avg_wait_time_minutes}min, Peak: ${row.peak_queue_length}`);
      });
    } else {
      console.log('❌ No records found in daily_queue_history');
    }
    
    // Check customer_history table
    console.log('\n👥 Checking customer_history table:');
    const customerHistoryResult = await pool.query(`
      SELECT 
        archive_date,
        COUNT(*) as customer_count,
        COUNT(CASE WHEN served_at IS NOT NULL THEN 1 END) as served_count
      FROM customer_history 
      GROUP BY archive_date
      ORDER BY archive_date DESC 
      LIMIT 5
    `);
    
    if (customerHistoryResult.rows.length > 0) {
      console.log(`✅ Found ${customerHistoryResult.rows.length} archive dates in customer_history:`);
      customerHistoryResult.rows.forEach((row, index) => {
        console.log(`  ${index + 1}. Date: ${row.archive_date}, Customers: ${row.customer_count}, Served: ${row.served_count}`);
      });
    } else {
      console.log('❌ No records found in customer_history');
    }
    
    // Check daily_reset_log table
    console.log('\n📝 Checking daily_reset_log table:');
    const resetLogResult = await pool.query(`
      SELECT 
        reset_date,
        customers_processed,
        customers_carried_forward,
        reset_duration_ms,
        success,
        reset_timestamp
      FROM daily_reset_log 
      ORDER BY reset_timestamp DESC 
      LIMIT 5
    `);
    
    if (resetLogResult.rows.length > 0) {
      console.log(`✅ Found ${resetLogResult.rows.length} records in daily_reset_log:`);
      resetLogResult.rows.forEach((row, index) => {
        console.log(`  ${index + 1}. Date: ${row.reset_date}, Processed: ${row.customers_processed}, Success: ${row.success}, Duration: ${row.reset_duration_ms}ms`);
      });
    } else {
      console.log('❌ No records found in daily_reset_log');
    }
    
    // Check activities table for reset logs
    console.log('\n📋 Checking activity_logs for reset activities:');
    const activitiesResult = await pool.query(`
      SELECT 
        action,
        ip_address,
        created_at,
        details
      FROM activity_logs 
      WHERE action LIKE '%reset%' OR action LIKE '%daily%'
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (activitiesResult.rows.length > 0) {
      console.log(`✅ Found ${activitiesResult.rows.length} reset-related activities:`);
      activitiesResult.rows.forEach((row, index) => {
        const details = typeof row.details === 'string' ? row.details : JSON.stringify(row.details);
        console.log(`  ${index + 1}. Action: ${row.action}, IP: ${row.ip_address}, Time: ${row.created_at}`);
        if (details && details.length < 200) {
          console.log(`      Details: ${details}`);
        }
      });
    } else {
      console.log('❌ No reset-related activities found');
    }
    
    // Check system_settings for daily_token_counter
    console.log('\n⚙️ Checking system_settings for daily_token_counter:');
    const settingsResult = await pool.query(`
      SELECT key, value, description, updated_at
      FROM system_settings 
      WHERE key = 'daily_token_counter'
    `);
    
    if (settingsResult.rows.length > 0) {
      console.log(`✅ Found daily_token_counter setting:`);
      const setting = settingsResult.rows[0];
      console.log(`  Key: ${setting.key}, Value: ${setting.value}, Updated: ${setting.updated_at}`);
    } else {
      console.log('❌ daily_token_counter setting not found');
    }
    
    console.log('\n🎉 Database verification completed!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    if (pool && pool.end) {
      await pool.end();
    }
    process.exit(0);
  }
}

// Run the verification
verifyResetTables();
