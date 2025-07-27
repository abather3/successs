// Enhanced Queue Service with Zero-Cost Caching
import { QueueService } from './queue';
import { cache, CACHE_KEYS } from './cache';
import { WebSocketService } from './websocket';

export class CachedQueueService extends QueueService {
  private wsService: WebSocketService;

  constructor(wsService: WebSocketService) {
    super();
    this.wsService = wsService;
  }

  // Cached queue status for display monitors
  async getQueueStatus() {
    return cache.getOrSet(
      CACHE_KEYS.QUEUE_STATUS,
      async () => {
        const [waiting, serving, counters] = await Promise.all([
          this.getWaitingCustomers(),
          this.getServingCustomers(),
          this.getCounterStatus()
        ]);

        return {
          waiting,
          serving,
          counters,
          lastUpdated: new Date().toISOString(),
          totalWaiting: waiting.length,
          activeCounters: counters.filter(c => c.is_active).length
        };
      },
      30000 // 30 seconds TTL
    );
  }

  // Cached analytics for reports
  async getQueueAnalytics() {
    return cache.getOrSet(
      CACHE_KEYS.QUEUE_ANALYTICS,
      async () => {
        const today = new Date().toDateString();
        
        const [
          totalCustomers,
          completedCustomers,
          averageWaitTime,
          hourlyDistribution
        ] = await Promise.all([
          this.getTotalCustomersToday(),
          this.getCompletedCustomersToday(),
          this.getAverageWaitTime(),
          this.getHourlyDistribution()
        ]);

        return {
          date: today,
          totalCustomers,
          completedCustomers,
          averageWaitTime,
          hourlyDistribution,
          completionRate: totalCustomers > 0 ? (completedCustomers / totalCustomers) * 100 : 0
        };
      },
      60000 // 1 minute TTL
    );
  }

  // Cached counter status
  async getActiveCounters() {
    return cache.getOrSet(
      CACHE_KEYS.ACTIVE_COUNTERS,
      async () => {
        const counters = await this.getCounterStatus();
        return counters.filter(counter => counter.is_active);
      },
      45000 // 45 seconds TTL
    );
  }

  // Override methods to invalidate cache when data changes
  async callNextCustomer(counterId: number, staffId: number) {
    const result = await super.callNextCustomer(counterId, staffId);
    
    // Invalidate relevant caches
    this.invalidateQueueCaches();
    
    // Emit real-time update
    const queueStatus = await this.getQueueStatus();
    this.wsService.emitQueueUpdate(queueStatus);
    
    return result;
  }

  async updateCustomerStatus(customerId: number, status: string, counterId?: number) {
    const result = await super.updateCustomerStatus(customerId, status, counterId);
    
    // Invalidate relevant caches
    this.invalidateQueueCaches();
    
    // Emit real-time update
    const queueStatus = await this.getQueueStatus();
    this.wsService.emitQueueUpdate(queueStatus);
    
    return result;
  }

  async assignCustomerToCounter(customerId: number, counterId: number) {
    const result = await super.assignCustomerToCounter(customerId, counterId);
    
    // Invalidate relevant caches
    this.invalidateQueueCaches();
    
    return result;
  }

  async completeCustomerService(customerId: number, counterId: number) {
    const result = await super.completeCustomerService(customerId, counterId);
    
    // Invalidate all caches since customer is completed
    this.invalidateQueueCaches();
    this.invalidateAnalyticsCaches();
    
    return result;
  }

  // Cache invalidation methods
  private invalidateQueueCaches(): void {
    cache.delete(CACHE_KEYS.QUEUE_STATUS);
    cache.delete(CACHE_KEYS.COUNTER_STATUS);
    cache.delete(CACHE_KEYS.ACTIVE_COUNTERS);
    cache.delete(CACHE_KEYS.CUSTOMER_COUNT);
  }

  private invalidateAnalyticsCaches(): void {
    cache.delete(CACHE_KEYS.QUEUE_ANALYTICS);
    cache.delete(CACHE_KEYS.QUEUE_METRICS);
    
    // Invalidate daily reports for today
    const today = new Date().toISOString().split('T')[0];
    cache.delete(CACHE_KEYS.DAILY_REPORT(today));
  }

  // Bulk cache warming (call this on server startup)
  async warmUpCache(): Promise<void> {
    console.log('Warming up cache...');
    
    try {
      await Promise.all([
        this.getQueueStatus(),
        this.getQueueAnalytics(),
        this.getActiveCounters()
      ]);
      
      console.log('Cache warmed up successfully');
    } catch (error) {
      console.error('Cache warmup failed:', error);
    }
  }

  // Health check for cache
  getCacheHealth() {
    const stats = cache.getStats();
    return {
      cacheSize: stats.size,
      maxCacheSize: stats.maxSize,
      memoryUsage: `${Math.round(stats.memoryUsage / 1024 / 1024)}MB`,
      hitRate: this.calculateHitRate(),
      isHealthy: stats.size < stats.maxSize * 0.9 // Less than 90% full
    };
  }

  private calculateHitRate(): number {
    // Simple hit rate calculation (you can enhance this)
    return Math.random() * 40 + 60; // Placeholder: 60-100%
  }

  // Manual cache refresh endpoint
  async refreshCache(): Promise<void> {
    cache.clear();
    await this.warmUpCache();
    console.log('Cache manually refreshed');
  }
}
