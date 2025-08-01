const { pool } = require('../src/config/database');

async function checkAnalyticsTables() {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM queue_events) AS event_count,
        (SELECT COUNT(*) FROM queue_analytics) AS analytics_count,
        (SELECT COUNT(*) FROM daily_queue_summary) AS summary_count
    `);
    console.log('Analytics Tables Status:', result.rows[0]);
  } catch (error) {
    console.error('Error checking analytics tables:', error);
  } finally {
    pool.end();
  }
}

checkAnalyticsTables();

