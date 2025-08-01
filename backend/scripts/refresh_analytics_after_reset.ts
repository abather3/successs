import { pool } from '../src/config/database';
import { QueueAnalyticsService } from '../src/services/QueueAnalyticsService';

/**
 * Script to refresh analytics data after queue reset operations
 * This ensures the Historical Queue Analytics dashboard displays accurate data
 */
async function refreshAnalyticsAfterReset() {
  console.log('Starting analytics refresh after queue reset...');
  
  try {
    // 1. Refresh the materialized view to get latest queue_events data
    console.log('Refreshing queue_analytics_mv materialized view...');
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY queue_analytics_mv');
    console.log('✓ Materialized view refreshed');

    // 2. Update hourly analytics from the refreshed materialized view
    console.log('Updating hourly analytics...');
    await QueueAnalyticsService.updateHourlyAnalytics();
    console.log('✓ Hourly analytics updated');

    // 3. Update daily summary
    console.log('Updating daily summary...');
    await QueueAnalyticsService.updateDailySummary();
    console.log('✓ Daily summary updated');

    // 4. Check if we need to update customer_history analytics
    console.log('Checking customer_history for analytics updates...');
    const historyQuery = `
      SELECT COUNT(*) as count, 
             MIN(archive_date) as oldest_date,
             MAX(archive_date) as newest_date
      FROM customer_history 
      WHERE archive_date >= CURRENT_DATE - INTERVAL '7 days'
    `;
    
    const historyResult = await pool.query(historyQuery);
    const historyData = historyResult.rows[0];
    
    if (parseInt(historyData.count) > 0) {
      console.log(`Found ${historyData.count} archived customers from ${historyData.oldest_date} to ${historyData.newest_date}`);
      
      // Update daily_queue_summary with historical data if needed
      const updateHistoricalQuery = `
        INSERT INTO daily_queue_summary (
          date, 
          total_customers,
          total_served,
          total_cancelled,
          avg_wait_time,
          avg_service_time,
          priority_customers_served
        )
        SELECT 
          archive_date as date,
          COUNT(*) as total_customers,
          COUNT(*) FILTER (WHERE queue_status = 'completed') as total_served,
          COUNT(*) FILTER (WHERE queue_status = 'cancelled') as total_cancelled,
          0 as avg_wait_time, -- Historical data may not have accurate wait times
          0 as avg_service_time, -- Historical data may not have accurate service times
          COUNT(*) FILTER (WHERE priority_flags::json->>'senior_citizen' = 'true' 
                                OR priority_flags::json->>'pwd' = 'true' 
                                OR priority_flags::json->>'pregnant' = 'true') as priority_customers_served
        FROM customer_history
        WHERE archive_date >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY archive_date
        ON CONFLICT (date) DO UPDATE SET
          total_customers = EXCLUDED.total_customers + daily_queue_summary.total_customers,
          total_served = EXCLUDED.total_served + daily_queue_summary.total_served,
          total_cancelled = EXCLUDED.total_cancelled + daily_queue_summary.total_cancelled,
          priority_customers_served = EXCLUDED.priority_customers_served + daily_queue_summary.priority_customers_served
      `;
      
      await pool.query(updateHistoricalQuery);
      console.log('✓ Historical data integrated into daily summaries');
    } else {
      console.log('No recent historical data found to integrate');
    }

    console.log('\n🎉 Analytics refresh completed successfully!');
    console.log('The Historical Queue Analytics dashboard should now display accurate data reflecting the queue reset.');
    
  } catch (error) {
    console.error('❌ Error refreshing analytics:', error);
    throw error;
  }
}

// Run the script if called directly
if (require.main === module) {
  refreshAnalyticsAfterReset()
    .then(() => {
      console.log('Analytics refresh script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Analytics refresh script failed:', error);
      process.exit(1);
    });
}

export { refreshAnalyticsAfterReset };
