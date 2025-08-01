import { pool } from '../src/config/database';
import { QueueAnalyticsService } from '../src/services/QueueAnalyticsService';

async function backfillAnalytics() {
  try {
    console.log('Starting analytics backfill process...\n');
    
    // Step 1: Get date range of existing queue events
    console.log('Step 1: Analyzing existing queue events...');
    const dateRangeResult = await pool.query(`
      SELECT 
        MIN(DATE(created_at)) as earliest_date,
        MAX(DATE(created_at)) as latest_date,
        COUNT(*) as total_events
      FROM queue_events
    `);
    
    const { earliest_date, latest_date, total_events } = dateRangeResult.rows[0];
    console.log(`Found ${total_events} events from ${earliest_date} to ${latest_date}`);
    
    if (!earliest_date || total_events === '0') {
      console.log('No queue events found to process.');
      return;
    }
    
    // Step 2: Process each date and hour combination
    console.log('\nStep 2: Processing hourly analytics...');
    const hourlyEventsResult = await pool.query(`
      SELECT 
        DATE(created_at) as event_date,
        EXTRACT(HOUR FROM created_at) as event_hour,
        COUNT(*) as event_count
      FROM queue_events
      WHERE created_at >= $1
      GROUP BY DATE(created_at), EXTRACT(HOUR FROM created_at)
      ORDER BY event_date, event_hour
    `, [earliest_date]);
    
    console.log(`Found ${hourlyEventsResult.rows.length} hour periods to process`);
    
    let processedHours = 0;
    for (const row of hourlyEventsResult.rows) {
      const { event_date, event_hour } = row;
      
      try {
        // Process hourly analytics for this specific date/hour
        const metricsQuery = `
          WITH hourly_events AS (
            SELECT 
              customer_id,
              event_type,
              wait_time_minutes,
              service_time_minutes,
              processing_duration_minutes,
              is_priority,
              queue_position
            FROM queue_events
            WHERE DATE(created_at) = $1 
            AND EXTRACT(HOUR FROM created_at) = $2
          ),
          metrics AS (
            SELECT 
              COUNT(DISTINCT customer_id) FILTER (WHERE event_type = 'joined') as total_customers,
              COUNT(DISTINCT customer_id) FILTER (WHERE event_type = 'joined' AND is_priority = true) as priority_customers,
              AVG(wait_time_minutes) FILTER (WHERE wait_time_minutes IS NOT NULL) as avg_wait_time,
              AVG(service_time_minutes) FILTER (WHERE service_time_minutes IS NOT NULL) as avg_service_time,
              MAX(queue_position) as peak_queue_length,
              COUNT(DISTINCT customer_id) FILTER (WHERE event_type = 'served') as customers_served,
              AVG(processing_duration_minutes) FILTER (WHERE processing_duration_minutes IS NOT NULL) as avg_processing_duration,
              COUNT(*) FILTER (WHERE processing_duration_minutes IS NOT NULL) as total_processing_count,
              MAX(processing_duration_minutes) as max_processing_duration,
              MIN(processing_duration_minutes) FILTER (WHERE processing_duration_minutes IS NOT NULL) as min_processing_duration
            FROM hourly_events
          )
          SELECT * FROM metrics
        `;
        
        const metricsResult = await pool.query(metricsQuery, [event_date, event_hour]);
        const metrics = metricsResult.rows[0];
        
        if (metrics && (metrics.total_customers > 0 || metrics.customers_served > 0)) {
          const upsertQuery = `
            INSERT INTO queue_analytics (
              date, hour, total_customers, priority_customers,
              avg_wait_time_minutes, avg_service_time_minutes,
              peak_queue_length, customers_served,
              avg_processing_duration_minutes, total_processing_count,
              max_processing_duration_minutes, min_processing_duration_minutes,
              updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
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
          `;
          
          await pool.query(upsertQuery, [
            event_date,
            event_hour,
            metrics.total_customers || 0,
            metrics.priority_customers || 0,
            metrics.avg_wait_time || 0,
            metrics.avg_service_time || 0,
            metrics.peak_queue_length || 0,
            metrics.customers_served || 0,
            metrics.avg_processing_duration || 0,
            metrics.total_processing_count || 0,
            metrics.max_processing_duration || 0,
            metrics.min_processing_duration || 0
          ]);
          
          processedHours++;
        }
      } catch (error) {
        console.error(`Error processing ${event_date} hour ${event_hour}:`, error);
      }
    }
    
    console.log(`Processed ${processedHours} hourly analytics records`);
    
    // Step 3: Process daily summaries
    console.log('\nStep 3: Processing daily summaries...');
    const datesResult = await pool.query(`
      SELECT DISTINCT DATE(created_at) as event_date
      FROM queue_events
      WHERE created_at >= $1
      ORDER BY event_date
    `, [earliest_date]);
    
    let processedDays = 0;
    for (const row of datesResult.rows) {
      const { event_date } = row;
      
      try {
        await QueueAnalyticsService.updateDailySummary(event_date);
        processedDays++;
      } catch (error) {
        console.error(`Error processing daily summary for ${event_date}:`, error);
      }
    }
    
    console.log(`Processed ${processedDays} daily summary records`);
    
    // Step 4: Final verification
    console.log('\nStep 4: Verification...');
    const verificationResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM queue_events) AS total_events,
        (SELECT COUNT(*) FROM queue_analytics) AS analytics_records,
        (SELECT COUNT(*) FROM daily_queue_summary) AS summary_records
    `);
    
    console.log('Final counts:', verificationResult.rows[0]);
    
    console.log('\n=== Backfill Complete ===');
    console.log('✓ Analytics data has been successfully backfilled from existing queue events');
    console.log('✓ Future events will be processed automatically with the updated analytics service');
    
  } catch (error) {
    console.error('Backfill process failed:', error);
  } finally {
    await pool.end();
  }
}

backfillAnalytics().catch(console.error);
