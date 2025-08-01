import { QueueService } from './queue';
import { WebSocketService } from './websocket';
export declare class CachedQueueService extends QueueService {
    private wsService;
    constructor(wsService: WebSocketService);
    getQueueStatus(): Promise<{
        waiting: any;
        serving: any;
        counters: any;
        lastUpdated: string;
        totalWaiting: any;
        activeCounters: any;
    }>;
    getQueueAnalytics(): Promise<{
        date: string;
        totalCustomers: any;
        completedCustomers: any;
        averageWaitTime: any;
        hourlyDistribution: any;
        completionRate: number;
    }>;
    getActiveCounters(): Promise<any>;
    callNextCustomer(counterId: number, staffId: number): Promise<any>;
    updateCustomerStatus(customerId: number, status: string, counterId?: number): Promise<any>;
    assignCustomerToCounter(customerId: number, counterId: number): Promise<any>;
    completeCustomerService(customerId: number, counterId: number): Promise<any>;
    private invalidateQueueCaches;
    private invalidateAnalyticsCaches;
    warmUpCache(): Promise<void>;
    getCacheHealth(): {
        cacheSize: number;
        maxCacheSize: number;
        memoryUsage: string;
        hitRate: number;
        isHealthy: boolean;
    };
    private calculateHitRate;
    refreshCache(): Promise<void>;
}
//# sourceMappingURL=cachedQueue.d.ts.map