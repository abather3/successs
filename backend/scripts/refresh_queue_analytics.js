#!/usr/bin/env node

/**
 * Queue Analytics Materialized View Refresh Script
 * 
 * This script refreshes the queue_analytics_mv materialized view
 * to ensure analytics data is up-to-date.
 * 
 * Usage:
 *   node scripts/refresh_queue_analytics.js
 *   node scripts/refresh_queue_analytics.js --concurrent  # For concurrent refresh (PostgreSQL 9.4+)
 * 
 * Can be scheduled via cron:
 *   # Refresh every 15 minutes during business hours (8 AM - 6 PM)
 *   */15 8-18 * * 1-5 cd /path/to/project && node scripts/refresh_queue_analytics.js
 *   
 *   # Full refresh once daily at 1 AM
 *   0 1 * * * cd /path/to/project && node scripts/refresh_queue_analytics.js --full
 */

const { Pool } = require('pg');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'escashop',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

/**
 * Logs message with timestamp
 */
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

/**
 * Refreshes the queue analytics materialized view
 */
async function refreshQueueAnalytics(concurrent = false, full = false) {
  const client = await pool.connect();
  
  try {
    log('Starting queue analytics materialized view refresh...');
    
    const startTime = Date.now();
    
    if (full) {
      // Full refresh - recreate the materialized view completely
      log('Performing full refresh (recreating materialized view)...');
      
      // Read and execute the materialized view creation script
      const fs = require('fs');
      const viewScript = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'database', 'materialized_views', 'queue_analytics_view.sql'),
        'utf8'
      );
      
      await client.query(viewScript);
      log('Materialized view recreated successfully');
      
    } else if (concurrent) {
      // Concurrent refresh (non-blocking)
      log('Performing concurrent refresh...');
      await client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY queue_analytics_mv');
      
    } else {
      // Standard refresh (blocking)
      log('Performing standard refresh...');
      await client.query('REFRESH MATERIALIZED VIEW queue_analytics_mv');
    }
    
    const duration = Date.now() - startTime;
    log(`Queue analytics refresh completed in ${duration}ms`);
    
    // Get refresh statistics
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_records,
        MIN(event_date) as earliest_date,
        MAX(event_date) as latest_date,
        MAX(last_updated) as last_data_update
      FROM queue_analytics_mv
    `);
    
    if (stats.rows.length > 0) {
      const { total_records, earliest_date, latest_date, last_data_update } = stats.rows[0];
      log(`Materialized view statistics:`);
      log(`  - Total records: ${total_records}`);
      log(`  - Date range: ${earliest_date} to ${latest_date}`);
      log(`  - Last data update: ${last_data_update}`);
    }
    
    return true;
    
  } catch (error) {
    log(`Error refreshing queue analytics: ${error.message}`);
    console.error(error);
    return false;
    
  } finally {
    client.release();
  }
}

/**
 * Updates the regular queue_analytics and daily_queue_summary tables as well
 */
async function updateAnalyticsTables() {
  const client = await pool.connect();
  
  try {
    log('Updating analytics tables...');
    
    // Update current hour analytics
    await client.query(`
      INSERT INTO queue_analytics (
        date, hour, total_customers, priority_customers,
        avg_wait_time_minutes, avg_service_time_minutes,
        peak_queue_length, customers_served,
        avg_processing_duration_minutes, total_processing_count,
        max_processing_duration_minutes, min_processing_duration_minutes,
        updated_at
      )
      SELECT 
        event_date, event_hour, total_customers, priority_customers,
        avg_wait_time_minutes, avg_service_time_minutes,
        peak_queue_length, customers_served,
        avg_processing_duration_minutes, total_processing_count,
        max_processing_duration_minutes, min_processing_duration_minutes,
        CURRENT_TIMESTAMP
      FROM queue_analytics_mv
      WHERE event_date = CURRENT_DATE
      ON CONFLICT (date, hour) 
      DO UPDATE SET
        total_customers = EXCLUDED.total_customers,
        priority_customers = EXCLUDED.priority_customers,
        avg_wait_time_minutes = EXCLUDED.avg_wait_time_minutes,
        avg_service_time_minutes = EXCLUDED.avg_service_time_minutes,
        peak_queue_length = EXCLUDED.peak_queue_length,
        customers_served = EXCLUDED.customers_served,
        avg_processing_duration_minutes = EXCLUDED.avg_processing_duration_minutes,
        total_processing_count = EXCLUDED.total_processing_count,
        max_processing_duration_minutes = EXCLUDED.max_processing_duration_minutes,
        min_processing_duration_minutes = EXCLUDED.min_processing_duration_minutes,
        updated_at = CURRENT_TIMESTAMP
    `);
    
    // Update daily summary with processing metrics
    await client.query(`
      INSERT INTO daily_queue_summary (
        date, total_customers, priority_customers,
        avg_wait_time_minutes, avg_service_time_minutes,
        peak_hour, peak_queue_length, customers_served,
        avg_processing_duration_minutes, total_processing_count,
        max_processing_duration_minutes, min_processing_duration_minutes,
        busiest_counter_id, updated_at
      )
      SELECT DISTINCT
        event_date, daily_total_customers, daily_priority_customers,
        daily_avg_wait_time, daily_avg_service_time,
        peak_hour, daily_peak_queue_length, daily_customers_served,
        daily_avg_processing_duration, daily_total_processing_count,
        daily_max_processing_duration, daily_min_processing_duration,
        1 as busiest_counter_id,  -- Default value, can be calculated separately
        CURRENT_TIMESTAMP
      FROM queue_analytics_mv
      WHERE event_date >= CURRENT_DATE - INTERVAL '7 days'
      ON CONFLICT (date)
      DO UPDATE SET
        total_customers = EXCLUDED.total_customers,
        priority_customers = EXCLUDED.priority_customers,
        avg_wait_time_minutes = EXCLUDED.avg_wait_time_minutes,
        avg_service_time_minutes = EXCLUDED.avg_service_time_minutes,
        peak_hour = EXCLUDED.peak_hour,
        peak_queue_length = EXCLUDED.peak_queue_length,
        customers_served = EXCLUDED.customers_served,
        avg_processing_duration_minutes = EXCLUDED.avg_processing_duration_minutes,
        total_processing_count = EXCLUDED.total_processing_count,
        max_processing_duration_minutes = EXCLUDED.max_processing_duration_minutes,
        min_processing_duration_minutes = EXCLUDED.min_processing_duration_minutes,
        updated_at = CURRENT_TIMESTAMP
    `);
    
    log('Analytics tables updated successfully');
    
  } catch (error) {
    log(`Error updating analytics tables: ${error.message}`);
    console.error(error);
    
  } finally {
    client.release();
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    const concurrent = args.includes('--concurrent');
    const full = args.includes('--full');
    const skipTables = args.includes('--mv-only');
    
    log('Queue Analytics Refresh Script');
    log(`Options: concurrent=${concurrent}, full=${full}, skipTables=${skipTables}`);
    
    // Refresh the materialized view
    const success = await refreshQueueAnalytics(concurrent, full);
    
    if (!success) {
      process.exit(1);
    }
    
    // Update regular analytics tables unless skipped
    if (!skipTables) {
      await updateAnalyticsTables();
    }
    
    log('All analytics refresh tasks completed successfully');
    
  } catch (error) {
    log(`Script failed: ${error.message}`);
    console.error(error);
    process.exit(1);
    
  } finally {
    await pool.end();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  log('Received SIGINT, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log('Received SIGTERM, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  refreshQueueAnalytics,
  updateAnalyticsTables
};
