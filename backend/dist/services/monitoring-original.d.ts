import { Request, Response } from 'express';
export interface MetricData {
    name: string;
    value: number;
    unit: string;
    tags?: Record<string, string>;
    timestamp?: Date;
}
export interface PerformanceMetrics {
    websocketConnections: number;
    activeWebsocketConnections: number;
    apiResponseTime: Record<string, number[]>;
    databaseQueryTime: number[];
    queueLength: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: number;
    errorRate: number;
}
export declare class MonitoringService {
    private static instance;
    private metrics;
    private websocketConnectionCount;
    private activeWebsocketConnections;
    private apiResponseTimes;
    private databaseQueryTimes;
    private errorCount;
    private requestCount;
    private constructor();
    static getInstance(): MonitoringService;
    recordWebSocketConnection(connected: boolean): void;
    recordAPIResponseTime(endpoint: string, duration: number): void;
    recordDatabaseQuery(duration: number, query?: string): void;
    recordFrontendPerformance(metrics: {
        renderTime: number;
        componentName: string;
        pageLoad?: number;
    }): void;
    recordError(error: Error, context?: Record<string, any>): void;
    recordRequest(endpoint: string, method: string, statusCode: number): void;
    private startMetricsCollection;
    private collectSystemMetrics;
    getCurrentMetrics(): PerformanceMetrics;
    checkAlertThresholds(): void;
    private triggerAlert;
    private recordMetric;
    createAPIMonitoringMiddleware(): (req: Request, res: Response, next: Function) => void;
    getHealthStatus(): Promise<{
        sentry: boolean;
        datadog: boolean;
        metrics: PerformanceMetrics;
    }>;
}
export declare const monitoringService: MonitoringService;
//# sourceMappingURL=monitoring-original.d.ts.map