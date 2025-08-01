import { pool } from '../config/database';
import { QueueAnalyticsService } from './QueueAnalyticsService';
import { ActivityService } from './activity';

export interface DailyQueueSnapshot {
  date: string;
  totalCustomers: number;
  waitingCustomers: number;
  servingCustomers: number;
  processingCustomers: number;
  completedCustomers: number;
  cancelledCustomers: number;
  priorityCustomers: number;
  avgWaitTime: number;
  peakQueueLength: number;
  operatingHours: number;
}

/**
 * Service responsible for daily queue maintenance operations
 * - Archives queue data for historical analysis
 * - Resets queue for new day operations
 * - Maintains data integrity during transitions
 */
export class DailyQueueResetService {
  
  /**
   * Main function to perform daily queue reset and archival
   * Called at midnight Philippine Time (UTC+8)
   */
  static async performDailyReset(): Promise<void> {
    const client = await pool.connect();
    
    try {
      console.log(`[${new Date().toISOString()}] Starting daily queue reset...`);
      
      await client.query('BEGIN');
      
      // Step 1: Create daily snapshot for analytics
      const snapshot = await this.createDailySnapshot(client);
      console.log('Daily snapshot created:', snapshot);
      
      // Step 2: Archive queue data to history tables
      await this.archiveQueueData(client, snapshot);
      console.log('Queue data archived successfully');
      
      // Step 3: Update analytics with final daily metrics
      await this.updateFinalDailyAnalytics(client, snapshot);
      console.log('Analytics updated with final metrics');
      
      // Step 4: Reset active queue (preserve customer records)
      await this.resetActiveQueue(client);
      console.log('Active queue reset completed');
      
      // Step 5: Update system counters and sequences
      await this.resetDailyCounters(client);
      console.log('Daily counters reset');
      
      // Step 6: Log the reset activity
      await this.logResetActivity(client, snapshot);
      console.log('Reset activity logged');
      
      await client.query('COMMIT');
      console.log('Daily queue reset completed successfully');
      
      // Step 7: Broadcast reset notification via WebSocket
      await this.broadcastResetNotification(snapshot);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Daily queue reset failed:', error);
      
      // Log the error for monitoring
      await ActivityService.log({
        user_id: -1, // System operation
        action: 'daily_reset_failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        ip_address: '0.0.0.0',
        user_agent: 'DailyQueueResetService'
      });
      
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Create a snapshot of previous day's queue state for historical records
   */
  public static async createDailySnapshot(client: any): Promise<DailyQueueSnapshot> {
    // Get yesterday's date to capture the completed day's data
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    console.log(`[SNAPSHOT] Creating snapshot for date: ${yesterdayStr}`);
    
    // First, let's check if we have any customers for yesterday
    const customerCountResult = await client.query('SELECT COUNT(*) as count FROM customers WHERE DATE(created_at) = $1', [yesterdayStr]);
    console.log(`[SNAPSHOT] Found ${customerCountResult.rows[0].count} customers for ${yesterdayStr}`);
    
    const snapshotQuery = `
      WITH queue_stats AS (
        SELECT 
          COUNT(*) as total_customers,
          COUNT(*) FILTER (WHERE queue_status = 'waiting') as waiting_customers,
          COUNT(*) FILTER (WHERE queue_status = 'serving') as serving_customers,
          COUNT(*) FILTER (WHERE queue_status = 'processing') as processing_customers,
          COUNT(*) FILTER (WHERE queue_status = 'completed') as completed_customers,
          COUNT(*) FILTER (WHERE queue_status = 'cancelled') as cancelled_customers,
          COUNT(*) FILTER (WHERE 
            priority_flags->>'senior_citizen' = 'true' OR 
            priority_flags->>'pregnant' = 'true' OR 
            priority_flags->>'pwd' = 'true'
          ) as priority_customers
        FROM customers 
        WHERE DATE(created_at) = $1
      ),
      wait_time_stats AS (
        SELECT 
          AVG(
            CASE 
              WHEN queue_status IN ('serving', 'processing', 'completed') 
              THEN EXTRACT(EPOCH FROM (served_at - created_at))/60.0
              ELSE EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))/60.0
            END
          ) as avg_wait_time
        FROM customers 
        WHERE DATE(created_at) = $1
      ),
      peak_stats AS (
        SELECT 
          MAX(hourly_count) as peak_queue_length
        FROM (
          SELECT 
            COUNT(*) as hourly_count
          FROM customers 
          WHERE DATE(created_at) = $1
          GROUP BY EXTRACT(HOUR FROM created_at)
        ) hourly_counts
      )
      SELECT 
        $1 as date,
        COALESCE(qs.total_customers, 0) as total_customers,
        COALESCE(qs.waiting_customers, 0) as waiting_customers,
        COALESCE(qs.serving_customers, 0) as serving_customers,
        COALESCE(qs.processing_customers, 0) as processing_customers,
        COALESCE(qs.completed_customers, 0) as completed_customers,
        COALESCE(qs.cancelled_customers, 0) as cancelled_customers,
        COALESCE(qs.priority_customers, 0) as priority_customers,
        COALESCE(wts.avg_wait_time, 0) as avg_wait_time,
        COALESCE(ps.peak_queue_length, 0) as peak_queue_length,
        24 as operating_hours -- Full 24-hour day for completed day
      FROM queue_stats qs
      CROSS JOIN wait_time_stats wts
      CROSS JOIN peak_stats ps
    `;
    
    const result = await client.query(snapshotQuery, [yesterdayStr]);
    const snapshot = result.rows[0];
    
    console.log(`[SNAPSHOT] Generated snapshot for ${yesterdayStr}:`, {
      totalCustomers: snapshot.total_customers,
      completedCustomers: snapshot.completed_customers,
      waitingCustomers: snapshot.waiting_customers,
      avgWaitTime: snapshot.avg_wait_time,
      peakQueueLength: snapshot.peak_queue_length
    });
    
    return snapshot;
  }
  
  /**
   * Archive current queue data to historical tables
   */
  public static async archiveQueueData(client: any, snapshot: DailyQueueSnapshot): Promise<void> {
    // Create daily queue history record
    await client.query(`
      INSERT INTO daily_queue_history (
        date, total_customers, waiting_customers, serving_customers, 
        processing_customers, completed_customers, cancelled_customers,
        priority_customers, avg_wait_time_minutes, peak_queue_length,
        operating_hours, archived_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
      ON CONFLICT (date) 
      DO UPDATE SET
        total_customers = EXCLUDED.total_customers,
        waiting_customers = EXCLUDED.waiting_customers,
        serving_customers = EXCLUDED.serving_customers,
        processing_customers = EXCLUDED.processing_customers,
        completed_customers = EXCLUDED.completed_customers,
        cancelled_customers = EXCLUDED.cancelled_customers,
        priority_customers = EXCLUDED.priority_customers,
        avg_wait_time_minutes = EXCLUDED.avg_wait_time_minutes,
        peak_queue_length = EXCLUDED.peak_queue_length,
        operating_hours = EXCLUDED.operating_hours,
        archived_at = CURRENT_TIMESTAMP
    `, [
      snapshot.date,
      snapshot.totalCustomers,
      snapshot.waitingCustomers,
      snapshot.servingCustomers,
      snapshot.processingCustomers,
      snapshot.completedCustomers,
      snapshot.cancelledCustomers,
      snapshot.priorityCustomers,
      snapshot.avgWaitTime,
      snapshot.peakQueueLength,
      snapshot.operatingHours
    ]);
    
    // Archive individual customer records to historical table
    await client.query(`
      INSERT INTO customer_history (
        original_customer_id, name, email, phone, queue_status, 
        token_number, priority_flags, created_at, served_at, 
        counter_id, estimated_wait_time, archive_date
      )
      SELECT 
        id, name, email, contact_number, queue_status, token_number, 
        priority_flags, created_at, served_at, 
        NULL as counter_id,
        CASE 
          WHEN estimated_time IS NOT NULL AND estimated_time::text != 'null' 
          THEN COALESCE((estimated_time->>'minutes')::integer, (estimated_time->>'days')::integer * 1440 + (estimated_time->>'hours')::integer * 60 + (estimated_time->>'minutes')::integer, 0)
          ELSE 0
        END as estimated_wait_time,
        $1
      FROM customers 
      WHERE DATE(created_at) = $1
      ON CONFLICT (original_customer_id, archive_date) 
      DO UPDATE SET
        queue_status = EXCLUDED.queue_status,
        served_at = EXCLUDED.served_at,
        counter_id = EXCLUDED.counter_id
    `, [snapshot.date]);
  }
  
  /**
   * Update analytics with final daily metrics
   */
  public static async updateFinalDailyAnalytics(client: any, snapshot: DailyQueueSnapshot): Promise<void> {
    // Enable analytics update since tables exist
    try {
      await QueueAnalyticsService.updateDailySummary(snapshot.date);
      console.log('Analytics updated with final daily metrics');
    } catch (error) {
      console.error('Failed to update analytics:', error);
      // Don't fail the entire reset if analytics fails
    }
    
    // Update display monitor history for analytics dashboard
    const avgWaitTime = isNaN(snapshot.avgWaitTime) ? 0 : Math.round(snapshot.avgWaitTime);
    const operatingEfficiency = snapshot.totalCustomers > 0 ? 
      Math.round((snapshot.completedCustomers / snapshot.totalCustomers) * 100) : 0;
    
    await client.query(`
      INSERT INTO display_monitor_history (
        date, daily_customers_served, daily_avg_wait_time,
        daily_peak_queue_length, daily_priority_customers,
        operating_efficiency, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (date)
      DO UPDATE SET
        daily_customers_served = EXCLUDED.daily_customers_served,
        daily_avg_wait_time = EXCLUDED.daily_avg_wait_time,
        daily_peak_queue_length = EXCLUDED.daily_peak_queue_length,
        daily_priority_customers = EXCLUDED.daily_priority_customers,
        operating_efficiency = EXCLUDED.operating_efficiency,
        created_at = CURRENT_TIMESTAMP
    `, [
      snapshot.date,
      snapshot.completedCustomers,
      avgWaitTime,
      snapshot.peakQueueLength,
      snapshot.priorityCustomers,
      operatingEfficiency
    ]);
  }
  
  /**
   * Reset the active queue for new day operations
   */
  private static async resetActiveQueue(client: any): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    // First: Mark old customers (from previous days) as completed to clear the display
    // These should not appear on the Display Monitor anymore
    await client.query(`
      UPDATE customers 
      SET 
        queue_status = 'completed',
        carried_forward = false,
        reset_at = CURRENT_TIMESTAMP,
        served_at = CURRENT_TIMESTAMP
      WHERE DATE(created_at) < $1 
      AND queue_status IN ('waiting', 'serving', 'processing')
    `, [today]);
    
    // Second: Reset today's incomplete customers (if any) to waiting status
    // These can be carried forward to the new day
    await client.query(`
      UPDATE customers 
      SET 
        queue_status = CASE 
          WHEN queue_status = 'waiting' THEN 'waiting'
          WHEN queue_status = 'serving' THEN 'waiting'  -- Reset serving to waiting
          WHEN queue_status = 'processing' THEN 'waiting'  -- Reset processing to waiting
          ELSE queue_status  -- Keep completed/cancelled as-is
        END,
        carried_forward = true,
        reset_at = CURRENT_TIMESTAMP
      WHERE DATE(created_at) = $1 
      AND queue_status IN ('waiting', 'serving', 'processing')
    `, [today]);
    
    // Reset counter assignments
    await client.query(`
      UPDATE counters 
      SET 
        current_customer_id = NULL,
        status = 'available',
        last_reset_at = CURRENT_TIMESTAMP
      WHERE is_active = true
    `);
  }
  
  /**
   * Reset daily counters and sequences
   */
  private static async resetDailyCounters(client: any): Promise<void> {
    // Reset daily token number sequence (start fresh each day)
    await client.query(`
      UPDATE system_settings 
      SET value = '1' 
      WHERE key = 'daily_token_counter'
    `);
    
    // Reset daily statistics counters
    await client.query(`
      INSERT INTO daily_reset_log (
        reset_date, customers_processed, customers_carried_forward, 
        reset_timestamp
      )
      SELECT 
        CURRENT_DATE,
        COUNT(*) FILTER (WHERE queue_status IN ('completed', 'cancelled')),
        COUNT(*) FILTER (WHERE queue_status IN ('waiting', 'serving', 'processing')),
        CURRENT_TIMESTAMP
      FROM customers 
      WHERE DATE(created_at) = CURRENT_DATE
    `);
  }
  
  /**
   * Log the reset activity for audit purposes
   */
  private static async logResetActivity(client: any, snapshot: DailyQueueSnapshot): Promise<void> {
    await ActivityService.log({
      user_id: -1, // System operation
      action: 'daily_queue_reset',
      details: {
        date: snapshot.date,
        customersArchived: snapshot.totalCustomers,
        completedCustomers: snapshot.completedCustomers,
        carriedForwardCustomers: snapshot.waitingCustomers + snapshot.servingCustomers + snapshot.processingCustomers,
        avgWaitTime: Math.round(snapshot.avgWaitTime),
        peakQueueLength: snapshot.peakQueueLength
      },
      ip_address: '0.0.0.0',
      user_agent: 'DailyQueueResetService'
    });
  }
  
  /**
   * Broadcast reset notification to connected clients
   */
  private static async broadcastResetNotification(snapshot: DailyQueueSnapshot): Promise<void> {
    try {
      const WebSocketService = require('./websocket').WebSocketService;
      
      WebSocketService.broadcastToAll('daily_reset_completed', {
        date: snapshot.date,
        archivedCustomers: snapshot.totalCustomers,
        newDayStarted: true,
        message: 'Queue has been reset for the new day. Historical data preserved in analytics.',
        timestamp: new Date().toISOString()
      });
      
      console.log('Daily reset notification broadcasted to all clients');
    } catch (error) {
      console.error('Failed to broadcast reset notification:', error);
      // Don't throw error as this is non-critical
    }
  }
  
  /**
   * Get daily queue history for analytics dashboard
   */
  static async getDailyHistory(days: number = 30): Promise<DailyQueueSnapshot[]> {
    const query = `
      SELECT 
        date, 
        total_customers as "totalCustomers", 
        waiting_customers as "waitingCustomers", 
        serving_customers as "servingCustomers",
        processing_customers as "processingCustomers", 
        completed_customers as "completedCustomers", 
        cancelled_customers as "cancelledCustomers",
        priority_customers as "priorityCustomers", 
        avg_wait_time_minutes as "avgWaitTime",
        peak_queue_length as "peakQueueLength", 
        operating_hours as "operatingHours"
      FROM daily_queue_history
      WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY date DESC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }
  
  /**
   * Get display monitor history for analytics dashboard integration
   */
  static async getDisplayMonitorHistory(days: number = 30): Promise<any[]> {
    const query = `
      SELECT 
        date, daily_customers_served, daily_avg_wait_time,
        daily_peak_queue_length, daily_priority_customers,
        operating_efficiency, created_at
      FROM display_monitor_history
      WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY date DESC
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }
}
