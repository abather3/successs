"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitoringService = exports.MonitoringService = void 0;
class MonitoringService {
    constructor() {
        this.metrics = new Map();
        this.websocketConnectionCount = 0;
        this.activeWebsocketConnections = 0;
        this.apiResponseTimes = {};
        this.databaseQueryTimes = [];
        this.errorCount = 0;
        this.requestCount = 0;
        this.startMetricsCollection();
    }
    static getInstance() {
        if (!MonitoringService.instance) {
            MonitoringService.instance = new MonitoringService();
        }
        return MonitoringService.instance;
    }
    // WebSocket Connection Monitoring
    recordWebSocketConnection(connected) {
        if (connected) {
            this.websocketConnectionCount++;
            this.activeWebsocketConnections++;
        }
        else {
            this.activeWebsocketConnections--;
        }
        this.recordMetric({
            name: 'websocket.connections.total',
            value: this.websocketConnectionCount,
            unit: 'count',
            tags: { type: 'websocket' }
        });
        this.recordMetric({
            name: 'websocket.connections.active',
            value: this.activeWebsocketConnections,
            unit: 'count',
            tags: { type: 'websocket' }
        });
        // Send to DataDog
        // Development: Commenting out tracer calls
        // tracer.dogstatsd?.increment('websocket.connections', 1, 
        //   connected ? ['status:connected'] : ['status:disconnected']
        // );
        // Send to Sentry
        // Development: Commenting out Sentry calls
        // Sentry.addBreadcrumb({
        //   message: `WebSocket ${connected ? 'connected' : 'disconnected'}`,
        //   category: 'websocket',
        //   level: 'info',
        //   data: {
        //     activeConnections: this.activeWebsocketConnections,
        //     totalConnections: this.websocketConnectionCount
        //   }
        // });
    }
    // API Response Time Monitoring
    recordAPIResponseTime(endpoint, duration) {
        if (!this.apiResponseTimes[endpoint]) {
            this.apiResponseTimes[endpoint] = [];
        }
        this.apiResponseTimes[endpoint].push(duration);
        // Keep only last 100 measurements per endpoint
        if (this.apiResponseTimes[endpoint].length > 100) {
            this.apiResponseTimes[endpoint] = this.apiResponseTimes[endpoint].slice(-100);
        }
        this.recordMetric({
            name: 'api.response_time',
            value: duration,
            unit: 'milliseconds',
            tags: { endpoint }
        });
        // Send to DataDog
        // Development: Commenting out tracer calls
        // tracer.dogstatsd?.histogram('api.response_time', duration, [`endpoint:${endpoint}`]);
        // Send to Sentry
        // Development: Commenting out Sentry calls
        // if (duration > 1000) { // Log slow responses
        //   Sentry.addBreadcrumb({
        //     message: `Slow API response: ${endpoint}`,
        //     category: 'performance',
        //     level: 'warning',
        //     data: { duration, endpoint }
        //   });
        // }
    }
    // Database Query Performance Monitoring
    recordDatabaseQuery(duration, query) {
        this.databaseQueryTimes.push(duration);
        // Keep only last 1000 measurements
        if (this.databaseQueryTimes.length > 1000) {
            this.databaseQueryTimes = this.databaseQueryTimes.slice(-1000);
        }
        this.recordMetric({
            name: 'database.query_time',
            value: duration,
            unit: 'milliseconds',
            tags: { type: 'postgresql' }
        });
        // Send to DataDog
        tracer.dogstatsd?.histogram('database.query_time', duration, ['type:postgresql']);
        // Send to Sentry for slow queries
        if (duration > 500) {
            Sentry.addBreadcrumb({
                message: 'Slow database query detected',
                category: 'database',
                level: 'warning',
                data: { duration, query: query ? query.substring(0, 100) : 'unknown' }
            });
        }
    }
    // Frontend Rendering Performance (from client-side)
    recordFrontendPerformance(metrics) {
        this.recordMetric({
            name: 'frontend.render_time',
            value: metrics.renderTime,
            unit: 'milliseconds',
            tags: { component: metrics.componentName }
        });
        if (metrics.pageLoad) {
            this.recordMetric({
                name: 'frontend.page_load_time',
                value: metrics.pageLoad,
                unit: 'milliseconds',
                tags: { component: metrics.componentName }
            });
        }
        // Send to DataDog
        tracer.dogstatsd?.histogram('frontend.render_time', metrics.renderTime, [`component:${metrics.componentName}`]);
        // Send to Sentry
        Sentry.addBreadcrumb({
            message: 'Frontend performance recorded',
            category: 'performance',
            level: 'info',
            data: metrics
        });
    }
    // Error Rate Monitoring
    recordError(error, context) {
        this.errorCount++;
        this.recordMetric({
            name: 'errors.count',
            value: this.errorCount,
            unit: 'count',
            tags: { type: 'application' }
        });
        // Send to DataDog
        tracer.dogstatsd?.increment('errors.count', 1, ['type:application']);
        // Send to Sentry
        Sentry.captureException(error, {
            contexts: {
                monitoring: context
            }
        });
    }
    // Request Count Monitoring
    recordRequest(endpoint, method, statusCode) {
        this.requestCount++;
        this.recordMetric({
            name: 'requests.count',
            value: this.requestCount,
            unit: 'count',
            tags: { endpoint, method, status: statusCode.toString() }
        });
        // Send to DataDog
        tracer.dogstatsd?.increment('requests.count', 1, [
            `endpoint:${endpoint}`,
            `method:${method}`,
            `status:${statusCode}`
        ]);
    }
    // System Metrics Collection
    startMetricsCollection() {
        setInterval(() => {
            this.collectSystemMetrics();
        }, 30000); // Every 30 seconds
    }
    collectSystemMetrics() {
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        // Memory metrics
        this.recordMetric({
            name: 'system.memory.heap_used',
            value: memoryUsage.heapUsed,
            unit: 'bytes',
            tags: { type: 'system' }
        });
        this.recordMetric({
            name: 'system.memory.heap_total',
            value: memoryUsage.heapTotal,
            unit: 'bytes',
            tags: { type: 'system' }
        });
        // Send to DataDog
        tracer.dogstatsd?.gauge('system.memory.heap_used', memoryUsage.heapUsed);
        tracer.dogstatsd?.gauge('system.memory.heap_total', memoryUsage.heapTotal);
        // Check for memory leaks
        const memoryUsagePercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
        if (memoryUsagePercentage > 80) {
            Sentry.addBreadcrumb({
                message: 'High memory usage detected',
                category: 'system',
                level: 'warning',
                data: { memoryUsagePercentage, heapUsed: memoryUsage.heapUsed }
            });
        }
    }
    // Get Current Performance Metrics
    getCurrentMetrics() {
        const memoryUsage = process.memoryUsage();
        return {
            websocketConnections: this.websocketConnectionCount,
            activeWebsocketConnections: this.activeWebsocketConnections,
            apiResponseTime: this.apiResponseTimes,
            databaseQueryTime: this.databaseQueryTimes,
            queueLength: 0, // To be updated by queue service
            memoryUsage,
            cpuUsage: 0, // To be calculated
            errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0
        };
    }
    // Alert Thresholds
    checkAlertThresholds() {
        const metrics = this.getCurrentMetrics();
        // Memory usage alert
        const memoryUsagePercentage = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
        if (memoryUsagePercentage > 85) {
            this.triggerAlert('high_memory_usage', `Memory usage at ${memoryUsagePercentage.toFixed(2)}%`);
        }
        // Error rate alert
        if (metrics.errorRate > 5) {
            this.triggerAlert('high_error_rate', `Error rate at ${metrics.errorRate.toFixed(2)}%`);
        }
        // API response time alert
        Object.entries(metrics.apiResponseTime).forEach(([endpoint, times]) => {
            if (times.length > 0) {
                const avgResponseTime = times.reduce((a, b) => a + b, 0) / times.length;
                if (avgResponseTime > 2000) {
                    this.triggerAlert('slow_api_response', `${endpoint} average response time: ${avgResponseTime.toFixed(2)}ms`);
                }
            }
        });
        // Database query time alert
        if (metrics.databaseQueryTime.length > 0) {
            const avgQueryTime = metrics.databaseQueryTime.reduce((a, b) => a + b, 0) / metrics.databaseQueryTime.length;
            if (avgQueryTime > 1000) {
                this.triggerAlert('slow_database_queries', `Average query time: ${avgQueryTime.toFixed(2)}ms`);
            }
        }
    }
    triggerAlert(alertType, message) {
        // Send to Sentry
        Sentry.captureMessage(`Alert: ${alertType} - ${message}`, 'warning');
        // Send to DataDog
        tracer.dogstatsd?.increment('alerts.triggered', 1, [`type:${alertType}`]);
        console.warn(`[ALERT] ${alertType}: ${message}`);
    }
    // Generic metric recording
    recordMetric(metric) {
        if (!this.metrics.has(metric.name)) {
            this.metrics.set(metric.name, []);
        }
        const metricArray = this.metrics.get(metric.name);
        metricArray.push({
            ...metric,
            timestamp: metric.timestamp || new Date()
        });
        // Keep only last 1000 measurements per metric
        if (metricArray.length > 1000) {
            this.metrics.set(metric.name, metricArray.slice(-1000));
        }
    }
    // Middleware for automatic API monitoring
    createAPIMonitoringMiddleware() {
        return (req, res, next) => {
            const startTime = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - startTime;
                this.recordAPIResponseTime(req.path, duration);
                this.recordRequest(req.path, req.method, res.statusCode);
            });
            next();
        };
    }
    // Health check for monitoring systems
    async getHealthStatus() {
        return {
            sentry: true, // Sentry doesn't have a direct health check API
            datadog: !!tracer.dogstatsd,
            metrics: this.getCurrentMetrics()
        };
    }
}
exports.MonitoringService = MonitoringService;
exports.monitoringService = MonitoringService.getInstance();
//# sourceMappingURL=monitoring-original.js.map