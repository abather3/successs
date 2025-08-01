import { monitoringService } from './monitoring';
import * as Sentry from '@sentry/node';
import tracer from 'dd-trace';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export interface RollbackTrigger {
  name: string;
  threshold: number;
  windowMinutes: number;
  enabled: boolean;
}

export interface RollbackConfig {
  version: string;
  deploymentTime: Date;
  rollbackCommand: string;
  healthCheckUrl: string;
  triggers: RollbackTrigger[];
}

export class EnhancedRollbackSystem {
  private static instance: EnhancedRollbackSystem;
  private currentConfig?: RollbackConfig;
  private isRollbackInProgress = false;
  private rollbackHistory: Array<{
    timestamp: Date;
    reason: string;
    success: boolean;
    version?: string;
  }> = [];

  private constructor() {
    this.initializeDefaultTriggers();
  }

  static getInstance(): EnhancedRollbackSystem {
    if (!EnhancedRollbackSystem.instance) {
      EnhancedRollbackSystem.instance = new EnhancedRollbackSystem();
    }
    return EnhancedRollbackSystem.instance;
  }

  private initializeDefaultTriggers(): void {
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

  async checkRollbackTriggers(): Promise<void> {
    if (this.isRollbackInProgress || !this.currentConfig) {
      return;
    }

    const metrics = monitoringService.getCurrentMetrics();
    const triggeredReasons: string[] = [];

    for (const trigger of this.currentConfig.triggers) {
      if (!trigger.enabled) continue;

      const shouldTrigger = await this.evaluateTrigger(trigger, metrics);
      if (shouldTrigger) {
        triggeredReasons.push(trigger.name);
      }
    }

    if (triggeredReasons.length > 0) {
      await this.initiateRollback(triggeredReasons);
    }
  }

  private async evaluateTrigger(trigger: RollbackTrigger, metrics: any): Promise<boolean> {
    switch (trigger.name) {
      case 'high_error_rate':
        return metrics.errorRate > trigger.threshold;

      case 'memory_usage_critical':
        const memoryUsagePercentage = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
        return memoryUsagePercentage > trigger.threshold;

      case 'slow_response_times':
        const avgResponseTimes = Object.values(metrics.apiResponseTime) as number[][];
        if (avgResponseTimes.length === 0) return false;
        
        const allTimes = avgResponseTimes.flat();
        const avgTime = allTimes.reduce((a, b) => a + b, 0) / allTimes.length;
        return avgTime > trigger.threshold;

      case 'database_connection_failure':
        // This would need to be tracked separately in your database connection logic
        return false; // Placeholder

      case 'websocket_connection_drop':
        if (metrics.websocketConnections === 0) return false;
        const dropPercentage = ((metrics.websocketConnections - metrics.activeWebsocketConnections) / metrics.websocketConnections) * 100;
        return dropPercentage > trigger.threshold;

      default:
        return false;
    }
  }

  private async initiateRollback(reasons: string[]): Promise<void> {
    if (this.isRollbackInProgress) {
      console.warn('Rollback already in progress, ignoring new trigger');
      return;
    }

    this.isRollbackInProgress = true;
    const rollbackReason = `Automated rollback triggered: ${reasons.join(', ')}`;
    
    console.error(`🚨 ${rollbackReason}`);

    // Send alerts to monitoring systems
    Sentry.captureMessage(`Automated Rollback Initiated: ${rollbackReason}`, 'error');
    tracer.dogstatsd?.increment('rollback.initiated', 1, [`reasons:${reasons.join(',')}`]);

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
        tracer.dogstatsd?.increment('rollback.success', 1);
      } else {
        throw new Error('Rollback execution failed');
      }

    } catch (error) {
      console.error('❌ Rollback failed:', error);
      Sentry.captureException(error);
      tracer.dogstatsd?.increment('rollback.failure', 1);
      
      // Alert about rollback failure
      await this.alertRollbackFailure(error as Error, rollbackReason);
    } finally {
      this.isRollbackInProgress = false;
    }
  }

  private async executePreRollbackHooks(): Promise<void> {
    console.log('🔄 Executing pre-rollback hooks...');
    
    // Save current application state
    await this.saveApplicationState();
    
    // Notify external systems
    await this.notifyExternalSystems('pre-rollback');
    
    // Drain traffic if using load balancer
    await this.drainTraffic();
  }

  private async executeRollback(): Promise<boolean> {
    return new Promise((resolve) => {
      console.log('🔄 Executing rollback command...');
      
      if (!this.currentConfig?.rollbackCommand) {
        console.error('No rollback command configured');
        resolve(false);
        return;
      }

      const rollbackProcess = spawn('bash', ['-c', this.currentConfig.rollbackCommand], {
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
        } else {
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

  private async executePostRollbackHooks(): Promise<void> {
    console.log('🔄 Executing post-rollback hooks...');
    
    // Restore traffic
    await this.restoreTraffic();
    
    // Notify external systems
    await this.notifyExternalSystems('post-rollback');
    
    // Clear caches if needed
    await this.clearCaches();
  }

  private async performHealthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(this.currentConfig!.healthCheckUrl, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  private async saveApplicationState(): Promise<void> {
    try {
      const state = {
        timestamp: new Date(),
        metrics: monitoringService.getCurrentMetrics(),
        version: this.currentConfig?.version,
        rollbackHistory: this.rollbackHistory
      };

      await fs.writeFile(
        path.join(process.cwd(), 'rollback-state.json'),
        JSON.stringify(state, null, 2)
      );
      
      console.log('📄 Application state saved');
    } catch (error) {
      console.error('Failed to save application state:', error);
    }
  }

  private async notifyExternalSystems(phase: 'pre-rollback' | 'post-rollback'): Promise<void> {
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
      } catch (error) {
        console.error('Failed to notify external systems:', error);
      }
    }
  }

  private async drainTraffic(): Promise<void> {
    console.log('🚦 Draining traffic...');
    // Implement traffic draining logic for your load balancer
    await this.wait(5000); // Wait 5 seconds for requests to complete
  }

  private async restoreTraffic(): Promise<void> {
    console.log('🚦 Restoring traffic...');
    // Implement traffic restoration logic
    await this.wait(2000);
  }

  private async clearCaches(): Promise<void> {
    console.log('🗑️ Clearing caches...');
    // Implement cache clearing logic if needed
  }

  private async alertRollbackFailure(error: Error, reason: string): Promise<void> {
    const alertMessage = `CRITICAL: Automated rollback failed!\nReason: ${reason}\nError: ${error.message}`;
    
    console.error('🚨 CRITICAL: Automated rollback failed!');
    
    // Send critical alert to Sentry
    Sentry.captureException(error, {
      tags: { rollback_failure: true },
      extra: { rollback_reason: reason }
    });

    // Send critical alert to DataDog
    tracer.dogstatsd?.increment('rollback.critical_failure', 1);

    // If you have PagerDuty or similar, trigger here
    // await this.triggerPagerDuty(alertMessage);
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods for configuration and monitoring
  updateConfig(config: Partial<RollbackConfig>): void {
    if (this.currentConfig) {
      this.currentConfig = { ...this.currentConfig, ...config };
    }
  }

  getRollbackHistory(): typeof this.rollbackHistory {
    return [...this.rollbackHistory];
  }

  getStatus() {
    type RollbackHistoryItem = {
      timestamp: Date;
      reason: string;
      success: boolean;
      version?: string;
    };
    
    return {
      isRollbackInProgress: this.isRollbackInProgress,
      currentVersion: this.currentConfig?.version,
      lastRollback: this.rollbackHistory.length > 0 ? this.rollbackHistory[this.rollbackHistory.length - 1] : null as RollbackHistoryItem | null,
      triggers: this.currentConfig?.triggers || []
    };
  }

  // Manual rollback trigger
  async manualRollback(reason: string): Promise<boolean> {
    if (this.isRollbackInProgress) {
      throw new Error('Rollback already in progress');
    }

    await this.initiateRollback([`manual_trigger: ${reason}`]);
    return true;
  }
}

export const enhancedRollbackSystem = EnhancedRollbackSystem.getInstance();
