/**
 * Scheduler service for daily queue reset operations
 * Handles timing, error recovery, and coordination with Philippine timezone
 */
export declare class DailyQueueScheduler {
    private static isRunning;
    private static currentTask;
    private static lastReset;
    /**
     * Initialize the daily reset scheduler
     */
    static initialize(): void;
    /**
     * Schedule the main daily reset task at midnight Philippine Time
     */
    private static scheduleDailyReset;
    /**
     * Schedule weekly cleanup of old history data
     */
    private static scheduleHistoryCleanup;
    /**
     * Execute the daily reset process with error handling and recovery
     */
    private static executeDailyReset;
    /**
     * Check if reset was already performed today
     */
    private static wasResetAlreadyPerformed;
    /**
     * Log successful reset operation
     */
    private static logResetSuccess;
    /**
     * Log failed reset operation
     */
    private static logResetFailure;
    /**
     * Attempt recovery from failed reset
     */
    private static attemptRecovery;
    /**
     * Perform weekly cleanup of old history data
     */
    private static performHistoryCleanup;
    /**
     * Get the next scheduled reset time in Philippine timezone
     */
    static getNextResetTime(): string;
    /**
     * Validate timezone support
     */
    private static validateTimezoneSupport;
    /**
     * Manually trigger daily reset (for testing or manual execution)
     */
    static triggerManualReset(): Promise<void>;
    /**
     * Get scheduler status information
     */
    static getStatus(): {
        isScheduled: boolean;
        isRunning: boolean;
        nextReset: string;
        lastReset: Date | null;
        timezone: string;
    };
    /**
     * Stop the scheduler (for shutdown or maintenance)
     */
    static stop(): void;
    /**
     * Start the scheduler (after being stopped)
     */
    static start(): void;
}
//# sourceMappingURL=DailyQueueScheduler.d.ts.map