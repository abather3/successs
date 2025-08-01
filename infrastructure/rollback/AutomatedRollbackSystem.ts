import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export interface HealthCheck {
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'HEAD';
  timeout: number;
  expectedStatus: number[];
  retries: number;
  retryDelay: number;
}

export interface RollbackConfig {
  version: string;
  dockerImage?: string;
  gitCommit?: string;
  environment: string;
  services: string[];
  preRollbackCommands?: string[];
  postRollbackCommands?: string[];
}

export interface DeploymentRecord {
  id: string;
  version: string;
  timestamp: Date;
  status: 'success' | 'failed' | 'rolled_back';
  healthChecks: Record<string, boolean>;
  rollbackConfig: RollbackConfig;
}

export class AutomatedRollbackSystem extends EventEmitter {
  private healthChecks: Map<string, HealthCheck> = new Map();
  private deploymentHistory: DeploymentRecord[] = [];
  private currentDeployment?: DeploymentRecord;
  private monitoringInterval?: NodeJS.Timeout;
  private rollbackInProgress = false;

  constructor(
    private configPath: string = './config/rollback-config.json',
    private deploymentHistoryPath: string = './data/deployment-history.json'
  ) {
    super();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.loadConfiguration();
    await this.loadDeploymentHistory();
    this.startHealthMonitoring();
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(configData);

      // Load health checks
      config.healthChecks?.forEach((check: HealthCheck) => {
        this.healthChecks.set(check.name, check);
      });

      console.log(`Loaded ${this.healthChecks.size} health checks`);
    } catch (error) {
      console.error('Failed to load rollback configuration:', error);
      await this.createDefaultConfiguration();
    }
  }

  private async createDefaultConfiguration(): Promise<void> {
    const defaultConfig = {
      healthChecks: [
        {
          name: 'backend-health',
          url: 'http://localhost:5000/health',
          method: 'GET',
          timeout: 5000,
          expectedStatus: [200],
          retries: 3,
          retryDelay: 2000
        },
        {
          name: 'frontend-health',
          url: 'http://localhost:3000/health',
          method: 'GET',
          timeout: 5000,
          expectedStatus: [200],
          retries: 3,
          retryDelay: 2000
        },
        {
          name: 'database-health',
          url: 'http://localhost:5432',
          method: 'HEAD',
          timeout: 3000,
          expectedStatus: [200, 404], // 404 is acceptable for basic connectivity
          retries: 2,
          retryDelay: 1000
        }
      ],
      rollbackThresholds: {
        consecutiveFailures: 3,
        failureRate: 0.7,
        timeWindow: 300000 // 5 minutes
      }
    };

    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(defaultConfig, null, 2));
    await this.loadConfiguration();
  }

  private async loadDeploymentHistory(): Promise<void> {
    try {
      const historyData = await fs.readFile(this.deploymentHistoryPath, 'utf-8');
      const history = JSON.parse(historyData);
      
      this.deploymentHistory = history.map((record: any) => ({
        ...record,
        timestamp: new Date(record.timestamp)
      }));

      // Find current deployment
      this.currentDeployment = this.deploymentHistory
        .filter(d => d.status === 'success')
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    } catch (error) {
      console.log('No deployment history found, starting fresh');
      this.deploymentHistory = [];
    }
  }

  public async recordDeployment(rollbackConfig: RollbackConfig): Promise<string> {
    const deploymentId = `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const deployment: DeploymentRecord = {
      id: deploymentId,
      version: rollbackConfig.version,
      timestamp: new Date(),
      status: 'success', // Will be updated based on health checks
      healthChecks: {},
      rollbackConfig
    };

    // Perform initial health checks
    const healthResults = await this.performHealthChecks();
    deployment.healthChecks = healthResults;

    const allHealthy = Object.values(healthResults).every(result => result);
    deployment.status = allHealthy ? 'success' : 'failed';

    this.deploymentHistory.push(deployment);
    this.currentDeployment = deployment;

    await this.saveDeploymentHistory();

    if (!allHealthy) {
      console.warn('Deployment failed initial health checks, triggering rollback');
      await this.triggerRollback('Initial health check failure');
    }

    this.emit('deploymentRecorded', deployment);
    return deploymentId;
  }

  private startHealthMonitoring(): void {
    // Monitor health every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      if (this.rollbackInProgress) {
        return;
      }

      try {
        const healthResults = await this.performHealthChecks();
        const healthyServices = Object.values(healthResults).filter(healthy => healthy).length;
        const totalServices = Object.keys(healthResults).length;
        const healthPercentage = totalServices > 0 ? healthyServices / totalServices : 1;

        console.log(`Health check results: ${healthyServices}/${totalServices} services healthy (${Math.round(healthPercentage * 100)}%)`);

        // Check if rollback is needed
        if (this.shouldTriggerRollback(healthResults)) {
          await this.triggerRollback('Health check failure threshold exceeded');
        }

        this.emit('healthCheck', healthResults);
      } catch (error) {
        console.error('Health monitoring error:', error);
      }
    }, 30000);
  }

  private async performHealthChecks(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, check] of this.healthChecks) {
      try {
        const isHealthy = await this.performSingleHealthCheck(check);
        results[name] = isHealthy;
      } catch (error) {
        console.error(`Health check ${name} failed:`, error);
        results[name] = false;
      }
    }

    return results;
  }

  private async performSingleHealthCheck(check: HealthCheck): Promise<boolean> {
    for (let attempt = 0; attempt <= check.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), check.timeout);

        const response = await fetch(check.url, {
          method: check.method,
          signal: controller.signal,
          headers: {
            'User-Agent': 'EscaShop-HealthCheck/1.0'
          }
        });

        clearTimeout(timeoutId);

        if (check.expectedStatus.includes(response.status)) {
          return true;
        }

        console.warn(`Health check ${check.name} returned unexpected status: ${response.status}`);
      } catch (error) {
        console.warn(`Health check ${check.name} attempt ${attempt + 1} failed:`, error);
        
        if (attempt < check.retries) {
          await new Promise(resolve => setTimeout(resolve, check.retryDelay));
        }
      }
    }

    return false;
  }

  private shouldTriggerRollback(healthResults: Record<string, boolean>): boolean {
    const unhealthyServices = Object.entries(healthResults)
      .filter(([_, healthy]) => !healthy)
      .map(([name, _]) => name);

    // Trigger rollback if more than 50% of services are unhealthy
    const healthPercentage = Object.values(healthResults).filter(h => h).length / Object.keys(healthResults).length;
    
    if (healthPercentage < 0.5) {
      console.warn(`Health percentage ${Math.round(healthPercentage * 100)}% below threshold, rollback needed`);
      return true;
    }

    // Critical services check
    const criticalServices = ['backend-health', 'database-health'];
    const criticalServicesFailed = criticalServices.some(service => 
      healthResults[service] === false
    );

    if (criticalServicesFailed) {
      console.warn('Critical services failed, rollback needed');
      return true;
    }

    return false;
  }

  public async triggerRollback(reason: string): Promise<boolean> {
    if (this.rollbackInProgress) {
      console.log('Rollback already in progress, skipping');
      return false;
    }

    this.rollbackInProgress = true;
    console.log(`Triggering rollback: ${reason}`);

    try {
      // Find the last successful deployment to rollback to
      const lastSuccessfulDeployment = this.deploymentHistory
        .filter(d => d.status === 'success' && d.id !== this.currentDeployment?.id)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

      if (!lastSuccessfulDeployment) {
        throw new Error('No successful deployment found to rollback to');
      }

      console.log(`Rolling back to deployment ${lastSuccessfulDeployment.id} (${lastSuccessfulDeployment.version})`);

      // Execute rollback
      await this.executeRollback(lastSuccessfulDeployment.rollbackConfig);

      // Update current deployment status
      if (this.currentDeployment) {
        this.currentDeployment.status = 'rolled_back';
        await this.saveDeploymentHistory();
      }

      // Verify rollback success
      const postRollbackHealth = await this.performHealthChecks();
      const rollbackSuccessful = Object.values(postRollbackHealth).every(healthy => healthy);

      if (rollbackSuccessful) {
        console.log('Rollback completed successfully');
        this.currentDeployment = lastSuccessfulDeployment;
        this.emit('rollbackCompleted', { reason, success: true, deployment: lastSuccessfulDeployment });
      } else {
        console.error('Rollback completed but health checks still failing');
        this.emit('rollbackCompleted', { reason, success: false, deployment: lastSuccessfulDeployment });
      }

      return rollbackSuccessful;
    } catch (error) {
      console.error('Rollback failed:', error);
      this.emit('rollbackFailed', { reason, error });
      return false;
    } finally {
      this.rollbackInProgress = false;
    }
  }

  private async executeRollback(config: RollbackConfig): Promise<void> {
    console.log(`Executing rollback to version ${config.version}`);

    // Execute pre-rollback commands
    if (config.preRollbackCommands) {
      for (const command of config.preRollbackCommands) {
        console.log(`Executing pre-rollback command: ${command}`);
        await this.executeCommand(command);
      }
    }

    // Rollback services
    for (const service of config.services) {
      await this.rollbackService(service, config);
    }

    // Execute post-rollback commands
    if (config.postRollbackCommands) {
      for (const command of config.postRollbackCommands) {
        console.log(`Executing post-rollback command: ${command}`);
        await this.executeCommand(command);
      }
    }

    // Wait for services to stabilize
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  private async rollbackService(serviceName: string, config: RollbackConfig): Promise<void> {
    console.log(`Rolling back service: ${serviceName}`);

    if (config.dockerImage) {
      // Docker-based rollback
      const rollbackCommands = [
        `docker stop escashop_${serviceName}`,
        `docker rm escashop_${serviceName}`,
        `docker run -d --name escashop_${serviceName} ${config.dockerImage}:${config.version}`
      ];

      for (const command of rollbackCommands) {
        await this.executeCommand(command);
      }
    } else if (config.gitCommit) {
      // Git-based rollback
      const rollbackCommands = [
        `git checkout ${config.gitCommit}`,
        `npm install`,
        `npm run build`,
        `pm2 restart ${serviceName}`
      ];

      for (const command of rollbackCommands) {
        await this.executeCommand(command);
      }
    }
  }

  private async executeCommand(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      
      exec(command, (error: any, stdout: string, stderr: string) => {
        if (error) {
          console.error(`Command failed: ${command}`, error);
          reject(error);
          return;
        }
        
        if (stdout) console.log(stdout);
        if (stderr) console.warn(stderr);
        resolve();
      });
    });
  }

  private async saveDeploymentHistory(): Promise<void> {
    await fs.mkdir(path.dirname(this.deploymentHistoryPath), { recursive: true });
    await fs.writeFile(
      this.deploymentHistoryPath,
      JSON.stringify(this.deploymentHistory, null, 2)
    );
  }

  public getDeploymentHistory(): DeploymentRecord[] {
    return [...this.deploymentHistory];
  }

  public getCurrentDeployment(): DeploymentRecord | undefined {
    return this.currentDeployment;
  }

  public async manualRollback(deploymentId: string): Promise<boolean> {
    const targetDeployment = this.deploymentHistory.find(d => d.id === deploymentId);
    if (!targetDeployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    if (targetDeployment.status !== 'success') {
      throw new Error(`Cannot rollback to deployment ${deploymentId} with status ${targetDeployment.status}`);
    }

    return this.triggerRollback(`Manual rollback to ${deploymentId}`);
  }

  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }
}

export const rollbackSystem = new AutomatedRollbackSystem();
