"use strict";
// Zero-Cost In-Memory Cache Service
// Uses Node.js built-in Map for caching (no Redis required)
Object.defineProperty(exports, "__esModule", { value: true });
exports.CACHE_KEYS = exports.cache = void 0;
class InMemoryCache {
    constructor(options = {}) {
        this.cache = new Map();
        this.maxSize = options.maxSize || 1000;
        this.defaultTtl = options.ttl || 300000; // 5 minutes default
        // Setup cleanup interval (every 5 minutes)
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 300000);
    }
    set(key, value, ttl) {
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
    get(key) {
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
        return item.value;
    }
    delete(key) {
        return this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
    }
    has(key) {
        const item = this.cache.get(key);
        if (!item)
            return false;
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }
    size() {
        return this.cache.size;
    }
    // Get or set pattern
    async getOrSet(key, fetcher, ttl) {
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }
        const value = await fetcher();
        this.set(key, value, ttl);
        return value;
    }
    findOldestKey() {
        let oldestKey = null;
        let oldestTime = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (item.lastAccessed < oldestTime) {
                oldestTime = item.lastAccessed;
                oldestKey = key;
            }
        }
        return oldestKey;
    }
    cleanup() {
        const now = Date.now();
        const keysToDelete = [];
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
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.cache.clear();
    }
}
// Singleton instance
exports.cache = new InMemoryCache({
    maxSize: 5000,
    ttl: 300000, // 5 minutes
});
// Cache keys constants
exports.CACHE_KEYS = {
    QUEUE_STATUS: 'queue:status',
    QUEUE_ANALYTICS: 'queue:analytics',
    COUNTER_STATUS: 'counters:status',
    DAILY_REPORT: (date) => `report:daily:${date}`,
    CUSTOMER_COUNT: 'customers:count',
    ACTIVE_COUNTERS: 'counters:active',
    QUEUE_METRICS: 'queue:metrics',
};
//# sourceMappingURL=cache.js.map