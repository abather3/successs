// Zero-Cost Performance Monitoring
// Uses built-in Node.js features for monitoring (no external dependencies)

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

class SimpleMonitor {
  private metrics: PerformanceMetric[] = [];
  private alerts: Array<{ message: string; level: 'info' | 'warning' | 'error'; timestamp: Date }> = [];
  private maxMetrics = 1000; // Keep last 1000 metrics
  private maxAlerts = 100;   // Keep last 100 alerts
  private monitoringInterval?: NodeJS.Timeout;

  constructor() {
    this.startMonitoring();
  }

  // Record a performance metric
  recordMetric(name: string, value: number, unit: string, category: PerformanceMetric['category']): void {
    const metric: PerformanceMetric = {
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
  getMetrics(category?: PerformanceMetric['category'], minutes: number = 60): PerformanceMetric[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    
    return this.metrics.filter(metric => {
      const matchesCategory = !category || metric.category === category;
      const withinTimeRange = metric.timestamp >= cutoff;
      return matchesCategory && withinTimeRange;
    });
  }

  // Get system health status
  async getSystemHealth(): Promise<SystemHealth> {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    // Database metrics (you'll need to implement these based on your DB)
    const dbMetrics = await this.getDatabaseMetrics();
    
    // Queue metrics
    const queueMetrics = await this.getQueueMetrics();
    
    // SMS metrics
    const smsMetrics = await this.getSMSMetrics();

    const health: SystemHealth = {
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
  private checkAlerts(metric: PerformanceMetric): void {
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

  private addAlert(message: string, level: 'info' | 'warning' | 'error'): void {
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
  getRecentAlerts(minutes: number = 60): typeof this.alerts {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.alerts.filter(alert => alert.timestamp >= cutoff);
  }

  // Auto-monitoring setup
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Every 30 seconds

    console.log('Performance monitoring started');
  }

  private collectSystemMetrics(): void {
    const memoryUsage = process.memoryUsage();
    
    // Record memory metrics
    this.recordMetric('heap_used', memoryUsage.heapUsed, 'bytes', 'memory');
    this.recordMetric('heap_total', memoryUsage.heapTotal, 'bytes', 'memory');
    this.recordMetric('heap_used_percentage', 
      (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100, 
      'percentage', 
      'memory'
    );

    // Record uptime
    this.recordMetric('uptime', process.uptime(), 'seconds', 'api');
  }

  // Database metrics (implement based on your database)
  private async getDatabaseMetrics(): Promise<SystemHealth['database']> {
    // This is a placeholder - implement actual database monitoring
    return {
      connections: 5, // You'd get this from your connection pool
      queryTime: Math.random() * 100, // Average query time in ms
      status: 'healthy'
    };
  }

  // Queue metrics (implement based on your queue service)
  private async getQueueMetrics(): Promise<SystemHealth['queue']> {
    // This is a placeholder - implement actual queue monitoring
    return {
      waiting: Math.floor(Math.random() * 10), // Current waiting customers
      processing: Math.floor(Math.random() * 5), // Currently being served
      averageWaitTime: Math.random() * 300 // Average wait time in seconds
    };
  }

  // SMS metrics (implement based on your SMS service)
  private async getSMSMetrics(): Promise<SystemHealth['sms']> {
    // This is a placeholder - implement actual SMS monitoring
    return {
      successRate: 90 + Math.random() * 10, // Success rate percentage
      pendingCount: Math.floor(Math.random() * 5), // Pending SMS count
      status: 'healthy'
    };
  }

  private async getCPUUsage(): Promise<number> {
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

  private calculateOverallStatus(
    db: SystemHealth['database'], 
    queue: SystemHealth['queue'], 
    sms: SystemHealth['sms']
  ): SystemHealth['status'] {
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
  exportMetrics(minutes: number = 60): string {
    const metrics = this.getMetrics(undefined, minutes);
    const headers = 'timestamp,name,value,unit,category\n';
    const rows = metrics.map(m => 
      `${m.timestamp.toISOString()},${m.name},${m.value},${m.unit},${m.category}`
    ).join('\n');
    
    return headers + rows;
  }

  // Get summary statistics
  getMetricsSummary(name: string, minutes: number = 60): {
    count: number;
    min: number;
    max: number;
    avg: number;
    latest: number;
  } {
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
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    console.log('Performance monitoring stopped');
  }
}

// Singleton instance
export const monitor = new SimpleMonitor();

// Convenience functions
export function recordDatabaseQuery(duration: number): void {
  monitor.recordMetric('query_time', duration, 'milliseconds', 'database');
}

export function recordAPIResponse(endpoint: string, duration: number): void {
  monitor.recordMetric(`api_${endpoint}_response_time`, duration, 'milliseconds', 'api');
}

export function recordQueueOperation(operation: string, duration: number): void {
  monitor.recordMetric(`queue_${operation}_time`, duration, 'milliseconds', 'queue');
}
