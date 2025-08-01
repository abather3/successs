export interface QueueMetrics {
    date: string;
    hour: number;
    totalCustomers: number;
    priorityCustomers: number;
    avgWaitTimeMinutes: number;
    avgServiceTimeMinutes: number;
    peakQueueLength: number;
    customersServed: number;
    avgProcessingDurationMinutes: number;
    totalProcessingCount: number;
    maxProcessingDurationMinutes: number;
    minProcessingDurationMinutes: number;
}
export interface DailyQueueSummary {
    date: string;
    totalCustomers: number;
    priorityCustomers: number;
    avgWaitTimeMinutes: number;
    avgServiceTimeMinutes: number;
    peakHour: number;
    peakQueueLength: number;
    customersServed: number;
    busiestCounterId: number;
    avgProcessingDurationMinutes: number;
    totalProcessingCount: number;
    maxProcessingDurationMinutes: number;
    minProcessingDurationMinutes: number;
}
export interface QueueEvent {
    customerId: number;
    eventType: 'joined' | 'called' | 'served' | 'left' | 'cancelled';
    counterId?: number;
    queuePosition?: number;
    waitTimeMinutes?: number;
    serviceTimeMinutes?: number;
    isPriority: boolean;
    reason?: string;
}
export interface AnalyticsDashboard {
    today: DailyQueueSummary;
    hourlyTrend: QueueMetrics[];
    weeklyComparison: DailyQueueSummary[];
    peakHours: {
        hour: number;
        avgCustomers: number;
    }[];
    counterPerformance: {
        counterId: number;
        name: string;
        customersServed: number;
        avgServiceTime: number;
    }[];
    waitTimeDistribution: {
        range: string;
        count: number;
    }[];
}
export declare class QueueAnalyticsService {
    /**
     * Record a queue event for analytics tracking
     */
    static recordQueueEvent(event: QueueEvent): Promise<void>;
    /**
     * Update hourly analytics based on recent events
     */
    static updateHourlyAnalytics(): Promise<void>;
    /**
     * Update daily summary analytics
     */
    static updateDailySummary(date?: string): Promise<void>;
    /**
     * Get comprehensive analytics dashboard data
     */
    static getAnalyticsDashboard(dateRange?: {
        start: string;
        end: string;
    }): Promise<AnalyticsDashboard>;
    /**
     * Get queue analytics for a specific date range
     */
    static getQueueAnalytics(startDate: string, endDate: string): Promise<QueueMetrics[]>;
    /**
     * Get daily summaries for a date range
     */
    static getDailySummaries(startDate: string, endDate: string): Promise<DailyQueueSummary[]>;
    /**
     * Export analytics data to different formats
     */
    static exportAnalytics(startDate: string, endDate: string, type?: 'hourly' | 'daily'): Promise<any[]>;
}
//# sourceMappingURL=QueueAnalyticsService.d.ts.map