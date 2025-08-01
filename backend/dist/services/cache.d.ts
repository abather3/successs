interface CacheOptions {
    ttl?: number;
    maxSize?: number;
    checkExpiry?: boolean;
}
declare class InMemoryCache {
    private cache;
    private readonly maxSize;
    private readonly defaultTtl;
    private cleanupInterval?;
    constructor(options?: CacheOptions);
    set<T>(key: string, value: T, ttl?: number): void;
    get<T>(key: string): T | null;
    delete(key: string): boolean;
    clear(): void;
    has(key: string): boolean;
    size(): number;
    getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T>;
    private findOldestKey;
    private cleanup;
    getStats(): {
        size: number;
        maxSize: number;
        memoryUsage: number;
    };
    destroy(): void;
}
export declare const cache: InMemoryCache;
export declare const CACHE_KEYS: {
    readonly QUEUE_STATUS: "queue:status";
    readonly QUEUE_ANALYTICS: "queue:analytics";
    readonly COUNTER_STATUS: "counters:status";
    readonly DAILY_REPORT: (date: string) => string;
    readonly CUSTOMER_COUNT: "customers:count";
    readonly ACTIVE_COUNTERS: "counters:active";
    readonly QUEUE_METRICS: "queue:metrics";
};
export {};
//# sourceMappingURL=cache.d.ts.map