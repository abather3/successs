import * as cron from 'node-cron';
import moment from 'moment-timezone';
import { DailyQueueResetService } from './DailyQueueResetService';
import { ActivityService } from './activity';

/**
 * Scheduler service for daily queue reset operations
 * Handles timing, error recovery, and coordination with Philippine timezone
 */
export class DailyQueueScheduler {
  private static isRunning = false;
  private static currentTask: cron.ScheduledTask | null = null;
  private static lastReset: Date | null = null;

  /**
   * Initialize the daily reset scheduler
   */
  static initialize(): void {
    console.log('🕐 Initializing Daily Queue Reset Scheduler...');
    
    // Validate timezone support
    this.validateTimezoneSupport();
    
    // Schedule daily reset at midnight Philippine Time (UTC+8)
    this.scheduleDailyReset();
    
    // Schedule cleanup task for old history data
    this.scheduleHistoryCleanup();
    
    console.log('✅ Daily Queue Reset Scheduler initialized successfully');
    console.log(`📍 Next reset scheduled for: ${this.getNextResetTime()}`);
  }

  /**
   * Schedule the main daily reset task at midnight Philippine Time
   */
  private static scheduleDailyReset(): void {
    // Cron expression: 0 0 * * * (every day at midnight)
    // Timezone: Asia/Manila (Philippine Time, UTC+8)
    this.currentTask = cron.schedule('0 0 * * *', async () => {
      await this.executeDailyReset();
    }, {
      timezone: "Asia/Manila" // Philippine Time Zone
    });

    console.log('📅 Daily reset cron job scheduled for midnight Philippine Time');
  }

  /**
   * Schedule weekly cleanup of old history data
   */
  private static scheduleHistoryCleanup(): void {
    // Run cleanup every Sunday at 2 AM Philippine Time
    cron.schedule('0 2 * * 0', async () => {
      await this.performHistoryCleanup();
    }, {
      timezone: "Asia/Manila"
    });

    console.log('🧹 Weekly history cleanup scheduled for Sunday 2 AM Philippine Time');
  }

  /**
   * Execute the daily reset process with error handling and recovery
   */
  private static async executeDailyReset(): Promise<void> {
    // Prevent concurrent executions
    if (this.isRunning) {
      console.warn('⚠️ Daily reset already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    const philippineTime = moment().tz('Asia/Manila');

    try {
      console.log(`🚀 Starting daily queue reset at ${philippineTime.format('YYYY-MM-DD HH:mm:ss')} Philippine Time`);

      // Check if reset was already performed today
      if (await this.wasResetAlreadyPerformed()) {
        console.log('ℹ️ Daily reset already performed today, skipping...');
        return;
      }

      // Perform the actual reset
      await DailyQueueResetService.performDailyReset();

      const duration = Date.now() - startTime;
      this.lastReset = new Date();

      console.log(`✅ Daily reset completed successfully in ${duration}ms`);

      // Log successful reset
      await this.logResetSuccess(duration);

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('❌ Daily reset failed:', error);

      // Log the failure
      await this.logResetFailure(error, duration);

      // Attempt recovery if appropriate
      await this.attemptRecovery(error);

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check if reset was already performed today
   */
  private static async wasResetAlreadyPerformed(): Promise<boolean> {
    try {
      const { pool } = require('../config/database');
      const today = new Date().toISOString().split('T')[0];
      
      const result = await pool.query(
        'SELECT id FROM daily_reset_log WHERE reset_date = $1 AND success = true',
        [today]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.warn('Could not check reset status:', error);
      return false;
    }
  }

  /**
   * Log successful reset operation
   */
  private static async logResetSuccess(duration: number): Promise<void> {
    try {
      await ActivityService.log({
        user_id: -1, // System operation (use -1 for system)
        action: 'daily_reset_scheduled_success',
        details: {
          scheduledTime: moment().tz('Asia/Manila').format('YYYY-MM-DD HH:mm:ss'),
          duration_ms: duration,
          timezone: 'Asia/Manila'
        },
        ip_address: '0.0.0.0',
        user_agent: 'DailyQueueScheduler'
      });
    } catch (error) {
      console.error('Failed to log reset success:', error);
    }
  }

  /**
   * Log failed reset operation
   */
  private static async logResetFailure(error: any, duration: number): Promise<void> {
    try {
      await ActivityService.log({
        user_id: -1, // System operation (use -1 for system)
        action: 'daily_reset_scheduled_failure',
        details: {
          scheduledTime: moment().tz('Asia/Manila').format('YYYY-MM-DD HH:mm:ss'),
          duration_ms: duration,
          error: error instanceof Error ? error.message : 'Unknown error',
          timezone: 'Asia/Manila'
        },
        ip_address: '0.0.0.0',
        user_agent: 'DailyQueueScheduler'
      });
    } catch (logError) {
      console.error('Failed to log reset failure:', logError);
    }
  }

  /**
   * Attempt recovery from failed reset
   */
  private static async attemptRecovery(error: any): Promise<void> {
    console.log('🔄 Attempting reset recovery...');
    
    // Wait 5 minutes and try once more
    setTimeout(async () => {
      try {
        console.log('🔄 Retry attempt: Performing daily reset...');
        await DailyQueueResetService.performDailyReset();
        console.log('✅ Recovery attempt successful');
        
        await ActivityService.log({
          user_id: -1,
          action: 'daily_reset_recovery_success',
          details: { originalError: error instanceof Error ? error.message : 'Unknown' },
          ip_address: 'scheduler',
          user_agent: 'DailyQueueScheduler'
        });
        
      } catch (recoveryError) {
        console.error('❌ Recovery attempt failed:', recoveryError);
        
        await ActivityService.log({
          user_id: -1,
          action: 'daily_reset_recovery_failed',
          details: { 
            originalError: error instanceof Error ? error.message : 'Unknown',
            recoveryError: recoveryError instanceof Error ? recoveryError.message : 'Unknown'
          },
          ip_address: 'scheduler',
          user_agent: 'DailyQueueScheduler'
        });
      }
    }, 5 * 60 * 1000); // 5 minutes delay
  }

  /**
   * Perform weekly cleanup of old history data
   */
  private static async performHistoryCleanup(): Promise<void> {
    console.log('🧹 Starting weekly history cleanup...');
    
    try {
      const { pool } = require('../config/database');
      
      // Keep 1 year of daily queue history
      await pool.query(`
        DELETE FROM daily_queue_history 
        WHERE date < CURRENT_DATE - INTERVAL '365 days'
      `);
      
      // Keep 1 year of customer history  
      await pool.query(`
        DELETE FROM customer_history 
        WHERE archive_date < CURRENT_DATE - INTERVAL '365 days'
      `);
      
      // Keep 1 year of reset logs
      await pool.query(`
        DELETE FROM daily_reset_log 
        WHERE reset_date < CURRENT_DATE - INTERVAL '365 days'
      `);
      
      console.log('✅ History cleanup completed successfully');
      
      await ActivityService.log({
        user_id: -1,
        action: 'history_cleanup_success',
        details: { cleanupDate: new Date().toISOString() },
        ip_address: 'scheduler',
        user_agent: 'DailyQueueScheduler'
      });
      
    } catch (error) {
      console.error('❌ History cleanup failed:', error);
      
      await ActivityService.log({
        user_id: -1,
        action: 'history_cleanup_failed',
        details: { error: error instanceof Error ? error.message : 'Unknown' },
        ip_address: 'scheduler',
        user_agent: 'DailyQueueScheduler'
      });
    }
  }

  /**
   * Get the next scheduled reset time in Philippine timezone
   */
  static getNextResetTime(): string {
    const now = moment().tz('Asia/Manila');
    let nextReset = now.clone().add(1, 'day').startOf('day'); // Next midnight
    
    // If it's already past midnight today, the next reset is tomorrow
    if (now.hour() === 0 && now.minute() < 5) {
      nextReset = now.clone().startOf('day');
    }
    
    return nextReset.format('YYYY-MM-DD HH:mm:ss [Philippine Time]');
  }

  /**
   * Validate timezone support
   */
  private static validateTimezoneSupport(): void {
    try {
      const testTime = moment().tz('Asia/Manila');
      console.log(`📍 Philippine Time support validated: ${testTime.format('YYYY-MM-DD HH:mm:ss Z')}`);
    } catch (error) {
      console.error('❌ Philippine timezone not supported:', error);
      throw new Error('Philippine timezone support required for daily reset scheduler');
    }
  }

  /**
   * Manually trigger daily reset (for testing or manual execution)
   */
  static async triggerManualReset(): Promise<void> {
    console.log('🔧 Manual reset triggered...');
    
    if (this.isRunning) {
      throw new Error('Reset already in progress');
    }

    await this.executeDailyReset();
  }

  /**
   * Get scheduler status information
   */
  static getStatus(): {
    isScheduled: boolean;
    isRunning: boolean;
    nextReset: string;
    lastReset: Date | null;
    timezone: string;
  } {
    return {
      isScheduled: this.currentTask !== null && this.currentTask.getStatus() === 'scheduled',
      isRunning: this.isRunning,
      nextReset: this.getNextResetTime(),
      lastReset: this.lastReset,
      timezone: 'Asia/Manila'
    };
  }

  /**
   * Stop the scheduler (for shutdown or maintenance)
   */
  static stop(): void {
    if (this.currentTask) {
      this.currentTask.stop();
      console.log('🛑 Daily queue reset scheduler stopped');
    }
  }

  /**
   * Start the scheduler (after being stopped)
   */
  static start(): void {
    if (this.currentTask) {
      this.currentTask.start();
      console.log('▶️ Daily queue reset scheduler restarted');
    } else {
      this.initialize();
    }
  }
}
