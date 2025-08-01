import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description: string;
  dependencies?: string[];
  rolloutPercentage?: number;
  environments?: string[];
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureFlagConfig {
  flags: Record<string, FeatureFlag>;
  version: string;
  lastUpdated: Date;
}

export class FeatureFlagManager extends EventEmitter {
  private flags: Map<string, FeatureFlag> = new Map();
  private configPath: string;
  private watchFileHandle?: fs.FileHandle;
  private refreshInterval?: NodeJS.Timeout;

  constructor(configPath: string = './config/feature-flags.json') {
    super();
    this.configPath = path.resolve(configPath);
    this.initializeFlags();
  }

  private async initializeFlags(): Promise<void> {
    try {
      await this.loadFlags();
      this.setupFileWatcher();
      this.setupPeriodicRefresh();
    } catch (error) {
      console.error('Failed to initialize feature flags:', error);
      // Create default config if not exists
      await this.createDefaultConfig();
    }
  }

  private async loadFlags(): Promise<void> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const config: FeatureFlagConfig = JSON.parse(configData);
      
      this.flags.clear();
      Object.entries(config.flags).forEach(([name, flag]) => {
        this.flags.set(name, {
          ...flag,
          createdAt: new Date(flag.createdAt),
          updatedAt: new Date(flag.updatedAt),
          expiresAt: flag.expiresAt ? new Date(flag.expiresAt) : undefined
        });
      });

      this.emit('flagsUpdated', this.flags);
    } catch (error) {
      console.error('Failed to load feature flags:', error);
      throw error;
    }
  }

  private async createDefaultConfig(): Promise<void> {
    const defaultConfig: FeatureFlagConfig = {
      version: '1.0.0',
      lastUpdated: new Date(),
      flags: {
        'legacy-express-middleware': {
          name: 'legacy-express-middleware',
          enabled: false,
          description: 'Use legacy Express middleware version',
          dependencies: ['express@4.18.2'],
          environments: ['production'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        'new-react-components': {
          name: 'new-react-components',
          enabled: false,
          description: 'Enable new React component architecture',
          dependencies: ['react@19.1.0'],
          rolloutPercentage: 10,
          environments: ['development', 'staging'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        'enhanced-database-pooling': {
          name: 'enhanced-database-pooling',
          enabled: false,
          description: 'Use enhanced database connection pooling',
          dependencies: ['pg@8.16.3'],
          environments: ['staging', 'production'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        'websocket-v2': {
          name: 'websocket-v2',
          enabled: false,
          description: 'Enable WebSocket v2 implementation',
          dependencies: ['socket.io@4.8.1'],
          rolloutPercentage: 0,
          environments: ['development'],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      }
    };

    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(defaultConfig, null, 2));
    await this.loadFlags();
  }

  private setupFileWatcher(): void {
    // Watch for file changes and reload
    const watcher = fs.watch(this.configPath);
    watcher.on('change', async () => {
      try {
        await this.loadFlags();
        console.log('Feature flags reloaded from file change');
      } catch (error) {
        console.error('Failed to reload feature flags:', error);
      }
    });
  }

  private setupPeriodicRefresh(): void {
    // Refresh flags every 30 seconds
    this.refreshInterval = setInterval(async () => {
      try {
        await this.loadFlags();
      } catch (error) {
        console.error('Failed to refresh feature flags:', error);
      }
    }, 30000);
  }

  public isEnabled(flagName: string, userId?: string, environment?: string): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) {
      console.warn(`Feature flag '${flagName}' not found`);
      return false;
    }

    // Check if flag is expired
    if (flag.expiresAt && flag.expiresAt < new Date()) {
      return false;
    }

    // Check environment restriction
    if (flag.environments && environment && !flag.environments.includes(environment)) {
      return false;
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && userId) {
      const hash = this.hashUserId(userId + flagName);
      const percentage = hash % 100;
      if (percentage >= flag.rolloutPercentage) {
        return false;
      }
    }

    return flag.enabled;
  }

  public async setFlag(flagName: string, enabled: boolean): Promise<void> {
    const flag = this.flags.get(flagName);
    if (!flag) {
      throw new Error(`Feature flag '${flagName}' not found`);
    }

    flag.enabled = enabled;
    flag.updatedAt = new Date();
    this.flags.set(flagName, flag);

    await this.saveFlags();
    this.emit('flagChanged', flagName, enabled);
  }

  public async createFlag(flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>): Promise<void> {
    const newFlag: FeatureFlag = {
      ...flag,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.flags.set(flag.name, newFlag);
    await this.saveFlags();
    this.emit('flagCreated', flag.name);
  }

  public getFlag(flagName: string): FeatureFlag | undefined {
    return this.flags.get(flagName);
  }

  public getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  private async saveFlags(): Promise<void> {
    const config: FeatureFlagConfig = {
      version: '1.0.0',
      lastUpdated: new Date(),
      flags: Object.fromEntries(this.flags.entries())
    };

    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }

  private hashUserId(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  public async cleanup(): Promise<void> {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    if (this.watchFileHandle) {
      await this.watchFileHandle.close();
    }
  }
}

export const featureFlagManager = new FeatureFlagManager();
