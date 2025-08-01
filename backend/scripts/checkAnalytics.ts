import { pool } from '../src/config/database';

async function checkAnalyticsTables() {
  try {
    console.log('Checking analytics tables...');
    
    // Check if tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('queue_events', 'queue_analytics', 'daily_queue_summary')
      ORDER BY table_name
    `);
    
    console.log('Found tables:', tablesResult.rows.map(r => r.table_name));
    
    if (tablesResult.rows.length === 3) {
      // Check record counts
      const countsResult = await pool.query(`
        SELECT
          (SELECT COUNT(*) FROM queue_events) AS event_count,
          (SELECT COUNT(*) FROM queue_analytics) AS analytics_count,
          (SELECT COUNT(*) FROM daily_queue_summary) AS summary_count
      `);
      
      console.log('Record counts:', countsResult.rows[0]);
      
      // Check recent queue events
      const recentEventsResult = await pool.query(`
        SELECT 
          event_type, 
          COUNT(*) as count,
          MAX(created_at) as latest_event
        FROM queue_events 
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY event_type
        ORDER BY count DESC
      `);
      
      console.log('Recent events (last 7 days):', recentEventsResult.rows);
      
      // Check analytics processing
      const analyticsResult = await pool.query(`
        SELECT 
          date,
          SUM(total_customers) as daily_customers,
          AVG(avg_wait_time_minutes) as avg_wait_time
        FROM queue_analytics 
        WHERE date >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY date
        ORDER BY date DESC
        LIMIT 5
      `);
      
      console.log('Recent analytics (last 5 days):', analyticsResult.rows);
    } else {
      console.log('Missing analytics tables! Found:', tablesResult.rows.length, 'out of 3 expected tables');
    }
    
  } catch (error) {
    console.error('Error checking analytics tables:', error);
  } finally {
    await pool.end();
  }
}

checkAnalyticsTables().catch(console.error);
