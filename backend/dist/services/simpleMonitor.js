"use strict";
// Zero-Cost Performance Monitoring
// Uses built-in Node.js features for monitoring (no external dependencies)
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitor = void 0;
exports.recordDatabaseQuery = recordDatabaseQuery;
exports.recordAPIResponse = recordAPIResponse;
exports.recordQueueOperation = recordQueueOperation;
class SimpleMonitor {
    constructor() {
        this.metrics = [];
        this.alerts = [];
        this.maxMetrics = 1000; // Keep last 1000 metrics
        this.maxAlerts = 100; // Keep last 100 alerts
        this.startMonitoring();
    }
    // Record a performance metric
    recordMetric(name, value, unit, category) {
        const metric = {
            name,
            value,
            unit,
            timestamp: new Date(),
            category
        };
        this.metrics.push(metric);
        // Keep only last N metrics
        if (this.metrics.length > this.maxMetrics) {
            this.metrics = this.metrics.slice(-this.maxMetrics);
        }
        // Check for alerts
        this.checkAlerts(metric);
    }
    // Get metrics for a specific time period
    getMetrics(category, minutes = 60) {
        const cutoff = new Date(Date.now() - minutes * 60 * 1000);
        return this.metrics.filter(metric => {
            const matchesCategory = !category || metric.category === category;
            const withinTimeRange = metric.timestamp >= cutoff;
            return matchesCategory && withinTimeRange;
        });
    }
    // Get system health status
    async getSystemHealth() {
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();
        // Database metrics (you'll need to implement these based on your DB)
        const dbMetrics = await this.getDatabaseMetrics();
        // Queue metrics
        const queueMetrics = await this.getQueueMetrics();
        // SMS metrics
        const smsMetrics = await this.getSMSMetrics();
        const health = {
            status: this.calculateOverallStatus(dbMetrics, queueMetrics, smsMetrics),
            uptime,
            memory: {
                used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
                free: Math.round((memoryUsage.heapTotal - memoryUsage.heapUsed) / 1024 / 1024), // MB
                percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
            },
            cpu: {
                percentage: await this.getCPUUsage()
            },
            database: dbMetrics,
            queue: queueMetrics,
            sms: smsMetrics
        };
        return health;
    }
    // Alert management
    checkAlerts(metric) {
        // Memory usage alert
        if (metric.category === 'memory' && metric.name === 'heap_used_percentage' && metric.value > 80) {
            this.addAlert(`High memory usage: ${metric.value}%`, 'warning');
        }
        // Database response time alert
        if (metric.category === 'database' && metric.name === 'query_time' && metric.value > 1000) {
            this.addAlert(`Slow database query: ${metric.value}ms`, 'warning');
        }
        // Queue processing alert
        if (metric.category === 'queue' && metric.name === 'average_wait_time' && metric.value > 300) {
            this.addAlert(`Long queue wait time: ${metric.value} seconds`, 'warning');
        }
        // SMS failure rate alert
        if (metric.category === 'sms' && metric.name === 'failure_rate' && metric.value > 10) {
            this.addAlert(`High SMS failure rate: ${metric.value}%`, 'error');
        }
    }
    addAlert(message, level) {
        this.alerts.push({
            message,
            level,
            timestamp: new Date()
        });
        // Keep only last N alerts
        if (this.alerts.length > this.maxAlerts) {
            this.alerts = this.alerts.slice(-this.maxAlerts);
        }
        console.log(`[${level.toUpperCase()}] ${message}`);
    }
    // Get recent alerts
    getRecentAlerts(minutes = 60) {
        const cutoff = new Date(Date.now() - minutes * 60 * 1000);
        return this.alerts.filter(alert => alert.timestamp >= cutoff);
    }
    // Auto-monitoring setup
    startMonitoring() {
        this.monitoringInterval = setInterval(() => {
            this.collectSystemMetrics();
        }, 30000); // Every 30 seconds
        console.log('Performance monitoring started');
    }
    collectSystemMetrics() {
        const memoryUsage = process.memoryUsage();
        // Record memory metrics
        this.recordMetric('heap_used', memoryUsage.heapUsed, 'bytes', 'memory');
        this.recordMetric('heap_total', memoryUsage.heapTotal, 'bytes', 'memory');
        this.recordMetric('heap_used_percentage', (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100, 'percentage', 'memory');
        // Record uptime
        this.recordMetric('uptime', process.uptime(), 'seconds', 'api');
    }
    // Database metrics (implement based on your database)
    async getDatabaseMetrics() {
        // This is a placeholder - implement actual database monitoring
        return {
            connections: 5, // You'd get this from your connection pool
            queryTime: Math.random() * 100, // Average query time in ms
            status: 'healthy'
        };
    }
    // Queue metrics (implement based on your queue service)
    async getQueueMetrics() {
        // This is a placeholder - implement actual queue monitoring
        return {
            waiting: Math.floor(Math.random() * 10), // Current waiting customers
            processing: Math.floor(Math.random() * 5), // Currently being served
            averageWaitTime: Math.random() * 300 // Average wait time in seconds
        };
    }
    // SMS metrics (implement based on your SMS service)
    async getSMSMetrics() {
        // This is a placeholder - implement actual SMS monitoring
        return {
            successRate: 90 + Math.random() * 10, // Success rate percentage
            pendingCount: Math.floor(Math.random() * 5), // Pending SMS count
            status: 'healthy'
        };
    }
    async getCPUUsage() {
        // Simple CPU usage calculation
        return new Promise((resolve) => {
            const startUsage = process.cpuUsage();
            setTimeout(() => {
                const currentUsage = process.cpuUsage(startUsage);
                const userTime = currentUsage.user / 1000; // Convert to milliseconds
                const systemTime = currentUsage.system / 1000;
                const totalTime = userTime + systemTime;
                const percentage = (totalTime / 100) * 100; // Rough approximation
                resolve(Math.min(percentage, 100));
            }, 100);
        });
    }
    calculateOverallStatus(db, queue, sms) {
        // Simple status calculation logic
        if (db.queryTime > 1000 || queue.averageWaitTime > 600 || sms.successRate < 80) {
            return 'critical';
        }
        if (db.queryTime > 500 || queue.averageWaitTime > 300 || sms.successRate < 90) {
            return 'warning';
        }
        return 'healthy';
    }
    // Export metrics for external tools (CSV format)
    exportMetrics(minutes = 60) {
        const metrics = this.getMetrics(undefined, minutes);
        const headers = 'timestamp,name,value,unit,category\n';
        const rows = metrics.map(m => `${m.timestamp.toISOString()},${m.name},${m.value},${m.unit},${m.category}`).join('\n');
        return headers + rows;
    }
    // Get summary statistics
    getMetricsSummary(name, minutes = 60) {
        const metrics = this.getMetrics(undefined, minutes)
            .filter(m => m.name === name)
            .map(m => m.value);
        if (metrics.length === 0) {
            return { count: 0, min: 0, max: 0, avg: 0, latest: 0 };
        }
        return {
            count: metrics.length,
            min: Math.min(...metrics),
            max: Math.max(...metrics),
            avg: metrics.reduce((a, b) => a + b, 0) / metrics.length,
            latest: metrics[metrics.length - 1]
        };
    }
    // Cleanup
    destroy() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        console.log('Performance monitoring stopped');
    }
}
// Singleton instance
exports.monitor = new SimpleMonitor();
// Convenience functions
function recordDatabaseQuery(duration) {
    exports.monitor.recordMetric('query_time', duration, 'milliseconds', 'database');
}
function recordAPIResponse(endpoint, duration) {
    exports.monitor.recordMetric(`api_${endpoint}_response_time`, duration, 'milliseconds', 'api');
}
function recordQueueOperation(operation, duration) {
    exports.monitor.recordMetric(`queue_${operation}_time`, duration, 'milliseconds', 'queue');
}
//# sourceMappingURL=simpleMonitor.js.map