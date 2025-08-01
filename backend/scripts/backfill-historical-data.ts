import { pool } from '../src/config/database.js';
import { DailyQueueResetService } from '../src/services/DailyQueueResetService.js';

async function backfillHistoricalData() {
  const datesToBackfill = [
    '2025-07-25',
    '2025-07-26',
    '2025-07-27',
    '2025-07-28',
    '2025-07-29', // Also backfill yesterday to be sure
  ];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const dateStr of datesToBackfill) {
      console.log(`[BACKFILL] Processing date: ${dateStr}`);
      
      // Manually create snapshot for the given date
      const snapshotQuery = DailyQueueResetService.getSnapshotQuery(); // We need to expose this query
      const snapshotResult = await client.query(snapshotQuery, [dateStr]);
      const snapshot = snapshotResult.rows[0];

      if (!snapshot || snapshot.total_customers === 0) {
        console.log(`[BACKFILL] No customers found for ${dateStr}, skipping.`);
        continue;
      }

      console.log(`[BACKFILL] Snapshot for ${dateStr}:`, snapshot);

      // Archive the snapshot
      await DailyQueueResetService.archiveQueueData(client, {
        date: snapshot.date,
        totalCustomers: snapshot.total_customers,
        waitingCustomers: snapshot.waiting_customers,
        servingCustomers: snapshot.serving_customers,
        processingCustomers: snapshot.processing_customers,
        completedCustomers: snapshot.completed_customers,
        cancelledCustomers: snapshot.cancelled_customers,
        priorityCustomers: snapshot.priority_customers,
        avgWaitTime: snapshot.avg_wait_time,
        peakQueueLength: snapshot.peak_queue_length,
        operatingHours: snapshot.operating_hours
      });

      // Update final analytics
      await DailyQueueResetService.updateFinalDailyAnalytics(client, {
        date: snapshot.date,
        totalCustomers: snapshot.total_customers,
        waitingCustomers: snapshot.waiting_customers,
        servingCustomers: snapshot.serving_customers,
        processingCustomers: snapshot.processing_customers,
        completedCustomers: snapshot.completed_customers,
        cancelledCustomers: snapshot.cancelled_customers,
        priorityCustomers: snapshot.priority_customers,
        avgWaitTime: snapshot.avg_wait_time,
        peakQueueLength: snapshot.peak_queue_length,
        operatingHours: snapshot.operating_hours
      });

      console.log(`[BACKFILL] Successfully backfilled data for ${dateStr}`);
    }

    await client.query('COMMIT');
    console.log('[BACKFILL] All missing historical data has been successfully backfilled!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[BACKFILL] Error backfilling historical data:', error);
  } finally {
    client.release();
    pool.end();
  }
}

// Expose protected methods for the script
class AccessibleResetService extends DailyQueueResetService {
  static getSnapshotQuery() {
    // @ts-ignore - access private method for script
    return this.getSnapshotQuerySql(); 
  }

  static getSnapshotQuerySql(): string {
    return `
      WITH queue_stats AS (SELECT ...), wait_time_stats AS (SELECT ...), peak_stats AS (SELECT ...) 
      SELECT ...`; // Replace with actual query
  }
}

backfillHistoricalData();

