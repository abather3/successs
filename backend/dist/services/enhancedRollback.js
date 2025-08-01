"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhancedRollbackSystem = exports.EnhancedRollbackSystem = void 0;
const monitoring_1 = require("./monitoring");
const Sentry = __importStar(require("@sentry/node"));
const dd_trace_1 = __importDefault(require("dd-trace"));
const child_process_1 = require("child_process");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
class EnhancedRollbackSystem {
    constructor() {
        this.isRollbackInProgress = false;
        this.rollbackHistory = [];
        this.initializeDefaultTriggers();
    }
    static getInstance() {
        if (!EnhancedRollbackSystem.instance) {
            EnhancedRollbackSystem.instance = new EnhancedRollbackSystem();
        }
        return EnhancedRollbackSystem.instance;
    }
    initializeDefaultTriggers() {
        this.currentConfig = {
            version: process.env.APP_VERSION || '1.0.0',
            deploymentTime: new Date(),
            rollbackCommand: process.env.ROLLBACK_COMMAND || 'npm run rollback',
            healthCheckUrl: process.env.HEALTH_CHECK_URL || 'http://localhost:5000/health',
            triggers: [
                {
                    name: 'high_error_rate',
                    threshold: 10, // 10% error rate
                    windowMinutes: 5,
                    enabled: true
                },
                {
                    name: 'memory_usage_critical',
                    threshold: 99, // 99% memory usage (disabled for development)
                    windowMinutes: 2,
                    enabled: false // Disabled due to development environment issues
                },
                {
                    name: 'slow_response_times',
                    threshold: 5000, // 5 second average response time
                    windowMinutes: 3,
                    enabled: true
                },
                {
                    name: 'database_connection_failure',
                    threshold: 5, // 5 consecutive failures
                    windowMinutes: 1,
                    enabled: true
                },
                {
                    name: 'websocket_connection_drop',
                    threshold: 50, // 50% of connections dropped
                    windowMinutes: 2,
                    enabled: true
                }
            ]
        };
    }
    async checkRollbackTriggers() {
        if (this.isRollbackInProgress || !this.currentConfig) {
            return;
        }
        const metrics = monitoring_1.monitoringService.getCurrentMetrics();
        const triggeredReasons = [];
        for (const trigger of this.currentConfig.triggers) {
            if (!trigger.enabled)
                continue;
            const shouldTrigger = await this.evaluateTrigger(trigger, metrics);
            if (shouldTrigger) {
                triggeredReasons.push(trigger.name);
            }
        }
        if (triggeredReasons.length > 0) {
            await this.initiateRollback(triggeredReasons);
        }
    }
    async evaluateTrigger(trigger, metrics) {
        switch (trigger.name) {
            case 'high_error_rate':
                return metrics.errorRate > trigger.threshold;
            case 'memory_usage_critical':
                const memoryUsagePercentage = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
                return memoryUsagePercentage > trigger.threshold;
            case 'slow_response_times':
                const avgResponseTimes = Object.values(metrics.apiResponseTime);
                if (avgResponseTimes.length === 0)
                    return false;
                const allTimes = avgResponseTimes.flat();
                const avgTime = allTimes.reduce((a, b) => a + b, 0) / allTimes.length;
                return avgTime > trigger.threshold;
            case 'database_connection_failure':
                // This would need to be tracked separately in your database connection logic
                return false; // Placeholder
            case 'websocket_connection_drop':
                if (metrics.websocketConnections === 0)
                    return false;
                const dropPercentage = ((metrics.websocketConnections - metrics.activeWebsocketConnections) / metrics.websocketConnections) * 100;
                return dropPercentage > trigger.threshold;
            default:
                return false;
        }
    }
    async initiateRollback(reasons) {
        if (this.isRollbackInProgress) {
            console.warn('Rollback already in progress, ignoring new trigger');
            return;
        }
        this.isRollbackInProgress = true;
        const rollbackReason = `Automated rollback triggered: ${reasons.join(', ')}`;
        console.error(`🚨 ${rollbackReason}`);
        // Send alerts to monitoring systems
        Sentry.captureMessage(`Automated Rollback Initiated: ${rollbackReason}`, 'error');
        dd_trace_1.default.dogstatsd?.increment('rollback.initiated', 1, [`reasons:${reasons.join(',')}`]);
        try {
            // Log rollback attempt
            this.rollbackHistory.push({
                timestamp: new Date(),
                reason: rollbackReason,
                success: false, // Will be updated if successful
                version: this.currentConfig?.version
            });
            // Execute pre-rollback hooks
            await this.executePreRollbackHooks();
            // Perform the actual rollback
            const rollbackSuccess = await this.executeRollback();
            if (rollbackSuccess) {
                // Execute post-rollback hooks
                await this.executePostRollbackHooks();
                // Update rollback history
                this.rollbackHistory[this.rollbackHistory.length - 1].success = true;
                console.log('✅ Rollback completed successfully');
                Sentry.captureMessage('Automated Rollback Completed Successfully', 'info');
                dd_trace_1.default.dogstatsd?.increment('rollback.success', 1);
            }
            else {
                throw new Error('Rollback execution failed');
            }
        }
        catch (error) {
            console.error('❌ Rollback failed:', error);
            Sentry.captureException(error);
            dd_trace_1.default.dogstatsd?.increment('rollback.failure', 1);
            // Alert about rollback failure
            await this.alertRollbackFailure(error, rollbackReason);
        }
        finally {
            this.isRollbackInProgress = false;
        }
    }
    async executePreRollbackHooks() {
        console.log('🔄 Executing pre-rollback hooks...');
        // Save current application state
        await this.saveApplicationState();
        // Notify external systems
        await this.notifyExternalSystems('pre-rollback');
        // Drain traffic if using load balancer
        await this.drainTraffic();
    }
    async executeRollback() {
        return new Promise((resolve) => {
            console.log('🔄 Executing rollback command...');
            if (!this.currentConfig?.rollbackCommand) {
                console.error('No rollback command configured');
                resolve(false);
                return;
            }
            const rollbackProcess = (0, child_process_1.spawn)('bash', ['-c', this.currentConfig.rollbackCommand], {
                stdio: 'pipe'
            });
            let output = '';
            let errorOutput = '';
            rollbackProcess.stdout?.on('data', (data) => {
                output += data.toString();
                console.log('Rollback output:', data.toString());
            });
            rollbackProcess.stderr?.on('data', (data) => {
                errorOutput += data.toString();
                console.error('Rollback error:', data.toString());
            });
            rollbackProcess.on('close', async (code) => {
                if (code === 0) {
                    console.log('✅ Rollback command executed successfully');
                    // Wait a bit for the new version to start
                    await this.wait(10000);
                    // Verify rollback success with health check
                    const healthCheck = await this.performHealthCheck();
                    resolve(healthCheck);
                }
                else {
                    console.error(`❌ Rollback command failed with code ${code}`);
                    resolve(false);
                }
            });
            rollbackProcess.on('error', (error) => {
                console.error('❌ Failed to start rollback process:', error);
                resolve(false);
            });
            // Timeout after 5 minutes
            setTimeout(() => {
                rollbackProcess.kill();
                console.error('❌ Rollback command timed out');
                resolve(false);
            }, 300000);
        });
    }
    async executePostRollbackHooks() {
        console.log('🔄 Executing post-rollback hooks...');
        // Restore traffic
        await this.restoreTraffic();
        // Notify external systems
        await this.notifyExternalSystems('post-rollback');
        // Clear caches if needed
        await this.clearCaches();
    }
    async performHealthCheck() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(this.currentConfig.healthCheckUrl, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response.ok;
        }
        catch (error) {
            console.error('Health check failed:', error);
            return false;
        }
    }
    async saveApplicationState() {
        try {
            const state = {
                timestamp: new Date(),
                metrics: monitoring_1.monitoringService.getCurrentMetrics(),
                version: this.currentConfig?.version,
                rollbackHistory: this.rollbackHistory
            };
            await promises_1.default.writeFile(path_1.default.join(process.cwd(), 'rollback-state.json'), JSON.stringify(state, null, 2));
            console.log('📄 Application state saved');
        }
        catch (error) {
            console.error('Failed to save application state:', error);
        }
    }
    async notifyExternalSystems(phase) {
        // Implement notifications to external systems like Slack, PagerDuty, etc.
        console.log(`📢 Notifying external systems: ${phase}`);
        // Example webhook notification
        const webhookUrl = process.env.ROLLBACK_WEBHOOK_URL;
        if (webhookUrl) {
            try {
                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phase,
                        timestamp: new Date(),
                        version: this.currentConfig?.version,
                        service: 'escashop-backend'
                    })
                });
            }
            catch (error) {
                console.error('Failed to notify external systems:', error);
            }
        }
    }
    async drainTraffic() {
        console.log('🚦 Draining traffic...');
        // Implement traffic draining logic for your load balancer
        await this.wait(5000); // Wait 5 seconds for requests to complete
    }
    async restoreTraffic() {
        console.log('🚦 Restoring traffic...');
        // Implement traffic restoration logic
        await this.wait(2000);
    }
    async clearCaches() {
        console.log('🗑️ Clearing caches...');
        // Implement cache clearing logic if needed
    }
    async alertRollbackFailure(error, reason) {
        const alertMessage = `CRITICAL: Automated rollback failed!\nReason: ${reason}\nError: ${error.message}`;
        console.error('🚨 CRITICAL: Automated rollback failed!');
        // Send critical alert to Sentry
        Sentry.captureException(error, {
            tags: { rollback_failure: true },
            extra: { rollback_reason: reason }
        });
        // Send critical alert to DataDog
        dd_trace_1.default.dogstatsd?.increment('rollback.critical_failure', 1);
        // If you have PagerDuty or similar, trigger here
        // await this.triggerPagerDuty(alertMessage);
    }
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // Public methods for configuration and monitoring
    updateConfig(config) {
        if (this.currentConfig) {
            this.currentConfig = { ...this.currentConfig, ...config };
        }
    }
    getRollbackHistory() {
        return [...this.rollbackHistory];
    }
    getStatus() {
        return {
            isRollbackInProgress: this.isRollbackInProgress,
            currentVersion: this.currentConfig?.version,
            lastRollback: this.rollbackHistory.length > 0 ? this.rollbackHistory[this.rollbackHistory.length - 1] : null,
            triggers: this.currentConfig?.triggers || []
        };
    }
    // Manual rollback trigger
    async manualRollback(reason) {
        if (this.isRollbackInProgress) {
            throw new Error('Rollback already in progress');
        }
        await this.initiateRollback([`manual_trigger: ${reason}`]);
        return true;
    }
}
exports.EnhancedRollbackSystem = EnhancedRollbackSystem;
exports.enhancedRollbackSystem = EnhancedRollbackSystem.getInstance();
//# sourceMappingURL=enhancedRollback.js.map