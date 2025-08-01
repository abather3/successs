import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { AutomatedRollbackSystem, RollbackConfig } from '../rollback/AutomatedRollbackSystem';

export type Environment = 'blue' | 'green';

export interface DeploymentStatus {
  environment: Environment;
  version: string;
  isActive: boolean;
  isHealthy: boolean;
  lastHealthCheck: Date;
  deployedAt: Date;
}

export interface TrafficSplit {
  blue: number;
  green: number;
}

export class BlueGreenDeploymentManager extends EventEmitter {
  private rollbackSystem: AutomatedRollbackSystem;
  private currentActiveEnvironment: Environment = 'blue';
  private deploymentStatus: Map<Environment, DeploymentStatus> = new Map();
  private trafficSplit: TrafficSplit = { blue: 100, green: 0 };
  private switchInProgress = false;

  constructor(
    private configPath: string = './config/deployment-config.json',
    rollbackSystem?: AutomatedRollbackSystem
  ) {
    super();
    this.rollbackSystem = rollbackSystem || new AutomatedRollbackSystem();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.loadConfiguration();
    this.setupHealthMonitoring();
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(configData);

      this.currentActiveEnvironment = config.activeEnvironment || 'blue';
      this.trafficSplit = config.trafficSplit || { blue: 100, green: 0 };

      // Initialize deployment status
      this.deploymentStatus.set('blue', {
        environment: 'blue',
        version: config.blueVersion || '1.0.0',
        isActive: this.currentActiveEnvironment === 'blue',
        isHealthy: false,
        lastHealthCheck: new Date(),
        deployedAt: new Date(config.blueDeployedAt || Date.now())
      });

      this.deploymentStatus.set('green', {
        environment: 'green',
        version: config.greenVersion || '1.0.0',
        isActive: this.currentActiveEnvironment === 'green',
        isHealthy: false,
        lastHealthCheck: new Date(),
        deployedAt: new Date(config.greenDeployedAt || Date.now())
      });

      console.log(`Loaded deployment configuration - Active: ${this.currentActiveEnvironment}`);
    } catch (error) {
      console.log('No deployment configuration found, creating default');
      await this.createDefaultConfiguration();
    }
  }

  private async createDefaultConfiguration(): Promise<void> {
    const defaultConfig = {
      activeEnvironment: 'blue',
      trafficSplit: { blue: 100, green: 0 },
      blueVersion: '1.0.0',
      greenVersion: '1.0.0',
      blueDeployedAt: new Date().toISOString(),
      greenDeployedAt: new Date().toISOString(),
      healthCheckInterval: 30000,
      switchTimeout: 300000 // 5 minutes
    };

    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(defaultConfig, null, 2));
    await this.loadConfiguration();
  }

  private setupHealthMonitoring(): void {
    // Check health of both environments every 30 seconds
    setInterval(async () => {
      await this.checkEnvironmentHealth('blue');
      await this.checkEnvironmentHealth('green');
    }, 30000);
  }

  private async checkEnvironmentHealth(environment: Environment): Promise<boolean> {
    const port = environment === 'blue' ? 5002 : 5001;
    const frontendPort = environment === 'blue' ? 3002 : 3001;

    try {
      // Check backend health
      const backendResponse = await fetch(`http://localhost:${port}/health`, {
        method: 'GET',
        timeout: 5000
      });

      // Check frontend health
      const frontendResponse = await fetch(`http://localhost:${frontendPort}/health`, {
        method: 'GET',
        timeout: 5000
      });

      const isHealthy = backendResponse.ok && frontendResponse.ok;
      
      const status = this.deploymentStatus.get(environment)!;
      status.isHealthy = isHealthy;
      status.lastHealthCheck = new Date();
      this.deploymentStatus.set(environment, status);

      if (!isHealthy && status.isActive) {
        console.warn(`Active environment ${environment} is unhealthy, considering switch`);
        this.emit('environmentUnhealthy', environment);
      }

      return isHealthy;
    } catch (error) {
      console.error(`Health check failed for ${environment}:`, error);
      const status = this.deploymentStatus.get(environment)!;
      status.isHealthy = false;
      status.lastHealthCheck = new Date();
      this.deploymentStatus.set(environment, status);
      return false;
    }
  }

  public async deployToEnvironment(
    environment: Environment,
    version: string,
    dockerImage?: string,
    gitCommit?: string
  ): Promise<boolean> {
    console.log(`Deploying version ${version} to ${environment} environment`);

    try {
      // Stop the environment if running
      await this.stopEnvironment(environment);

      // Build and start new version
      await this.startEnvironment(environment, version, dockerImage, gitCommit);

      // Wait for startup
      await new Promise(resolve => setTimeout(resolve, 30000));

      // Check health
      const isHealthy = await this.checkEnvironmentHealth(environment);

      if (isHealthy) {
        // Update deployment status
        const status = this.deploymentStatus.get(environment)!;
        status.version = version;
        status.deployedAt = new Date();
        this.deploymentStatus.set(environment, status);

        await this.saveConfiguration();
        
        console.log(`Successfully deployed ${version} to ${environment}`);
        this.emit('deploymentCompleted', { environment, version, success: true });
        return true;
      } else {
        console.error(`Deployment to ${environment} failed health checks`);
        this.emit('deploymentCompleted', { environment, version, success: false });
        return false;
      }
    } catch (error) {
      console.error(`Deployment to ${environment} failed:`, error);
      this.emit('deploymentFailed', { environment, version, error });
      return false;
    }
  }

  private async stopEnvironment(environment: Environment): Promise<void> {
    const services = [
      `escashop_${environment}_backend`,
      `escashop_${environment}_frontend`
    ];

    for (const service of services) {
      try {
        await this.executeCommand(`docker stop ${service}`);
        await this.executeCommand(`docker rm ${service}`);
      } catch (error) {
        console.warn(`Failed to stop ${service}:`, error);
      }
    }
  }

  private async startEnvironment(
    environment: Environment,
    version: string,
    dockerImage?: string,
    gitCommit?: string
  ): Promise<void> {
    const backendPort = environment === 'blue' ? 5002 : 5001;
    const frontendPort = environment === 'blue' ? 3002 : 3001;

    // Start backend
    const backendCommand = dockerImage
      ? `docker run -d --name escashop_${environment}_backend -p ${backendPort}:${backendPort} --network escashop_network ${dockerImage}:${version}`
      : `docker-compose -f docker-compose.blue-green.yml up -d ${environment}_backend`;

    await this.executeCommand(backendCommand);

    // Start frontend
    const frontendCommand = dockerImage
      ? `docker run -d --name escashop_${environment}_frontend -p ${frontendPort}:${frontendPort} --network escashop_network ${dockerImage}-frontend:${version}`
      : `docker-compose -f docker-compose.blue-green.yml up -d ${environment}_frontend`;

    await this.executeCommand(frontendCommand);
  }

  public async performBlueGreenSwitch(targetEnvironment?: Environment): Promise<boolean> {
    if (this.switchInProgress) {
      console.log('Switch already in progress');
      return false;
    }

    this.switchInProgress = true;
    const target = targetEnvironment || (this.currentActiveEnvironment === 'blue' ? 'green' : 'blue');

    console.log(`Switching traffic from ${this.currentActiveEnvironment} to ${target}`);

    try {
      // Check if target environment is healthy
      const isTargetHealthy = await this.checkEnvironmentHealth(target);
      if (!isTargetHealthy) {
        throw new Error(`Target environment ${target} is not healthy`);
      }

      // Gradual traffic switch (canary deployment)
      await this.performCanarySwitch(target);

      // Final switch
      await this.completeSwitch(target);

      console.log(`Successfully switched to ${target} environment`);
      this.emit('switchCompleted', { from: this.currentActiveEnvironment, to: target });
      
      return true;
    } catch (error) {
      console.error('Blue-green switch failed:', error);
      this.emit('switchFailed', { target, error });
      return false;
    } finally {
      this.switchInProgress = false;
    }
  }

  private async performCanarySwitch(targetEnvironment: Environment): Promise<void> {
    const steps = [
      { blue: 90, green: 10 },
      { blue: 70, green: 30 },
      { blue: 50, green: 50 },
      { blue: 30, green: 70 },
      { blue: 10, green: 90 }
    ];

    for (const step of steps) {
      console.log(`Setting traffic split - Blue: ${step.blue}%, Green: ${step.green}%`);
      
      await this.updateTrafficSplit(step);
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
      
      // Check health during canary
      const isHealthy = await this.checkEnvironmentHealth(targetEnvironment);
      if (!isHealthy) {
        throw new Error(`Target environment became unhealthy during canary at ${step.green}%`);
      }

      this.emit('canaryProgress', step);
    }
  }

  private async updateTrafficSplit(split: TrafficSplit): Promise<void> {
    this.trafficSplit = split;
    
    // Update load balancer configuration
    await this.updateLoadBalancerConfig(split);
    
    await this.saveConfiguration();
  }

  private async updateLoadBalancerConfig(split: TrafficSplit): Promise<void> {
    // Generate nginx configuration for traffic splitting
    const nginxConfig = `
events {
    worker_connections 1024;
}

http {
    upstream backend_blue {
        server localhost:5002;
    }
    
    upstream backend_green {
        server localhost:5001;
    }
    
    upstream frontend_blue {
        server localhost:3002;
    }
    
    upstream frontend_green {
        server localhost:3001;
    }

    # Split configuration
    split_clients $remote_addr $backend_pool {
        ${split.blue}% backend_blue;
        * backend_green;
    }
    
    split_clients $remote_addr $frontend_pool {
        ${split.blue}% frontend_blue;
        * frontend_green;
    }

    server {
        listen 80;
        
        location /api/ {
            proxy_pass http://$backend_pool;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
        
        location / {
            proxy_pass http://$frontend_pool;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
`;

    await fs.writeFile('./nginx/nginx-blue-green.conf', nginxConfig);
    
    // Reload nginx
    try {
      await this.executeCommand('docker exec escashop_nginx nginx -s reload');
    } catch (error) {
      console.warn('Failed to reload nginx:', error);
    }
  }

  private async completeSwitch(targetEnvironment: Environment): Promise<void> {
    // Final traffic switch
    const finalSplit = targetEnvironment === 'green' 
      ? { blue: 0, green: 100 }
      : { blue: 100, green: 0 };

    await this.updateTrafficSplit(finalSplit);

    // Update active environment
    const oldActive = this.currentActiveEnvironment;
    this.currentActiveEnvironment = targetEnvironment;

    // Update deployment status
    const oldStatus = this.deploymentStatus.get(oldActive)!;
    const newStatus = this.deploymentStatus.get(targetEnvironment)!;
    
    oldStatus.isActive = false;
    newStatus.isActive = true;
    
    this.deploymentStatus.set(oldActive, oldStatus);
    this.deploymentStatus.set(targetEnvironment, newStatus);

    await this.saveConfiguration();
  }

  public async emergencyRollback(): Promise<boolean> {
    console.log('Performing emergency rollback');
    
    const inactiveEnvironment = this.currentActiveEnvironment === 'blue' ? 'green' : 'blue';
    const inactiveStatus = this.deploymentStatus.get(inactiveEnvironment)!;
    
    // Check if inactive environment is healthy
    const isHealthy = await this.checkEnvironmentHealth(inactiveEnvironment);
    
    if (isHealthy) {
      // Immediate switch to inactive environment
      console.log(`Emergency switch to ${inactiveEnvironment}`);
      return await this.performBlueGreenSwitch(inactiveEnvironment);
    } else {
      // Use traditional rollback system
      console.log('Both environments unhealthy, using traditional rollback');
      return await this.rollbackSystem.triggerRollback('Emergency rollback - both environments unhealthy');
    }
  }

  private async executeCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      
      exec(command, (error: any, stdout: string, stderr: string) => {
        if (error) {
          reject(error);
          return;
        }
        
        if (stderr) console.warn(stderr);
        resolve(stdout);
      });
    });
  }

  private async saveConfiguration(): Promise<void> {
    const config = {
      activeEnvironment: this.currentActiveEnvironment,
      trafficSplit: this.trafficSplit,
      blueVersion: this.deploymentStatus.get('blue')?.version || '1.0.0',
      greenVersion: this.deploymentStatus.get('green')?.version || '1.0.0',
      blueDeployedAt: this.deploymentStatus.get('blue')?.deployedAt?.toISOString(),
      greenDeployedAt: this.deploymentStatus.get('green')?.deployedAt?.toISOString(),
      healthCheckInterval: 30000,
      switchTimeout: 300000
    };

    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }

  // Getters for status information
  public getActiveEnvironment(): Environment {
    return this.currentActiveEnvironment;
  }

  public getDeploymentStatus(): Map<Environment, DeploymentStatus> {
    return new Map(this.deploymentStatus);
  }

  public getTrafficSplit(): TrafficSplit {
    return { ...this.trafficSplit };
  }

  public isSwitchInProgress(): boolean {
    return this.switchInProgress;
  }
}

export const blueGreenManager = new BlueGreenDeploymentManager();
