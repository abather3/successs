interface PerformanceMetric {
    name: string;
    value: number;
    unit: string;
    timestamp: Date;
    category: 'database' | 'api' | 'memory' | 'queue' | 'sms';
}
interface SystemHealth {
    status: 'healthy' | 'warning' | 'critical';
    uptime: number;
    memory: {
        used: number;
        free: number;
        percentage: number;
    };
    cpu: {
        percentage: number;
    };
    database: {
        connections: number;
        queryTime: number;
        status: string;
    };
    queue: {
        waiting: number;
        processing: number;
        averageWaitTime: number;
    };
    sms: {
        successRate: number;
        pendingCount: number;
        status: string;
    };
}
declare class SimpleMonitor {
    private metrics;
    private alerts;
    private maxMetrics;
    private maxAlerts;
    private monitoringInterval?;
    constructor();
    recordMetric(name: string, value: number, unit: string, category: PerformanceMetric['category']): void;
    getMetrics(category?: PerformanceMetric['category'], minutes?: number): PerformanceMetric[];
    getSystemHealth(): Promise<SystemHealth>;
    private checkAlerts;
    private addAlert;
    getRecentAlerts(minutes?: number): typeof this.alerts;
    private startMonitoring;
    private collectSystemMetrics;
    private getDatabaseMetrics;
    private getQueueMetrics;
    private getSMSMetrics;
    private getCPUUsage;
    private calculateOverallStatus;
    exportMetrics(minutes?: number): string;
    getMetricsSummary(name: string, minutes?: number): {
        count: number;
        min: number;
        max: number;
        avg: number;
        latest: number;
    };
    destroy(): void;
}
export declare const monitor: SimpleMonitor;
export declare function recordDatabaseQuery(duration: number): void;
export declare function recordAPIResponse(endpoint: string, duration: number): void;
export declare function recordQueueOperation(operation: string, duration: number): void;
export {};
//# sourceMappingURL=simpleMonitor.d.ts.map