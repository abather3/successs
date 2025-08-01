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
export declare class DailyQueueResetService {
    /**
     * Main function to perform daily queue reset and archival
     * Called at midnight Philippine Time (UTC+8)
     */
    static performDailyReset(): Promise<void>;
    /**
     * Create a snapshot of previous day's queue state for historical records
     */
    static createDailySnapshot(client: any): Promise<DailyQueueSnapshot>;
    /**
     * Archive current queue data to historical tables
     */
    static archiveQueueData(client: any, snapshot: DailyQueueSnapshot): Promise<void>;
    /**
     * Update analytics with final daily metrics
     */
    static updateFinalDailyAnalytics(client: any, snapshot: DailyQueueSnapshot): Promise<void>;
    /**
     * Reset the active queue for new day operations
     */
    private static resetActiveQueue;
    /**
     * Reset daily counters and sequences
     */
    private static resetDailyCounters;
    /**
     * Log the reset activity for audit purposes
     */
    private static logResetActivity;
    /**
     * Broadcast reset notification to connected clients
     */
    private static broadcastResetNotification;
    /**
     * Get daily queue history for analytics dashboard
     */
    static getDailyHistory(days?: number): Promise<DailyQueueSnapshot[]>;
    /**
     * Get display monitor history for analytics dashboard integration
     */
    static getDisplayMonitorHistory(days?: number): Promise<any[]>;
}
//# sourceMappingURL=DailyQueueResetService.d.ts.map