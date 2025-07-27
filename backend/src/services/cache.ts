// Zero-Cost In-Memory Cache Service
// Uses Node.js built-in Map for caching (no Redis required)

interface CacheItem<T> {
  value: T;
  expiry: number;
  lastAccessed: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum cache size
  checkExpiry?: boolean; // Check expiry on access
}

class InMemoryCache {
  private cache = new Map<string, CacheItem<any>>();
  private readonly maxSize: number;
  private readonly defaultTtl: number;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTtl = options.ttl || 300000; // 5 minutes default

    // Setup cleanup interval (every 5 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 300000);
  }

  set<T>(key: string, value: T, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.defaultTtl);
    
    // Remove oldest item if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.findOldestKey();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiry,
      lastAccessed: Date.now()
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Check if expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    // Update last accessed time
    item.lastAccessed = Date.now();
    return item.value as T;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  size(): number {
    return this.cache.size;
  }

  // Get or set pattern
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    this.set(key, value, ttl);
    return value;
  }

  private findOldestKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    
    console.log(`Cache cleanup: removed ${keysToDelete.length} expired items`);
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      memoryUsage: process.memoryUsage().heapUsed,
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

// Singleton instance
export const cache = new InMemoryCache({
  maxSize: 5000,
  ttl: 300000, // 5 minutes
});

// Cache keys constants
export const CACHE_KEYS = {
  QUEUE_STATUS: 'queue:status',
  QUEUE_ANALYTICS: 'queue:analytics',
  COUNTER_STATUS: 'counters:status',
  DAILY_REPORT: (date: string) => `report:daily:${date}`,
  CUSTOMER_COUNT: 'customers:count',
  ACTIVE_COUNTERS: 'counters:active',
  QUEUE_METRICS: 'queue:metrics',
} as const;
