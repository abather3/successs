import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export interface DependencyVersion {
  name: string;
  version: string;
  channel: 'stable' | 'beta' | 'alpha' | 'canary';
  isActive: boolean;
  fallbackVersion?: string;
  compatibilityMatrix: Record<string, string[]>;
  healthCheckUrl?: string;
  rollbackThreshold?: number;
}

export interface VersionConfig {
  dependencies: Record<string, DependencyVersion>;
  activeProfile: string;
  profiles: Record<string, {
    name: string;
    description: string;
    environment: string;
    dependencyOverrides: Record<string, string>;
  }>;
}

export class DependencyVersionManager extends EventEmitter {
  private config: VersionConfig;
  private configPath: string;
  private lockFilePath: string;

  constructor(
    configPath: string = './config/dependency-versions.json',
    lockFilePath: string = './config/dependency-versions.lock'
  ) {
    super();
    this.configPath = path.resolve(configPath);
    this.lockFilePath = path.resolve(lockFilePath);
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.loadConfiguration();
    this.setupFileWatcher();
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(configData);
      console.log(`Loaded dependency configuration - Active profile: ${this.config.activeProfile}`);
    } catch (error) {
      console.log('No dependency configuration found, creating default');
      await this.createDefaultConfiguration();
    }
  }

  private async createDefaultConfiguration(): Promise<void> {
    const defaultConfig: VersionConfig = {
      activeProfile: 'production',
      dependencies: {
        'react': {
          name: 'react',
          version: '19.1.0',
          channel: 'stable',
          isActive: true,
          fallbackVersion: '18.2.0',
          compatibilityMatrix: {
            'react-dom': ['19.1.0', '18.2.0'],
            'react-router-dom': ['7.6.3', '6.2.0']
          },
          rollbackThreshold: 3
        },
        'express': {
          name: 'express',
          version: '4.18.2',
          channel: 'stable',
          isActive: true,
          fallbackVersion: '4.17.1',
          compatibilityMatrix: {
            'cors': ['2.8.5'],
            'helmet': ['7.0.0', '6.0.0']
          },
          healthCheckUrl: '/api/health',
          rollbackThreshold: 2
        },
        'pg': {
          name: 'pg',
          version: '8.16.3',
          channel: 'stable',
          isActive: true,
          fallbackVersion: '8.7.1',
          compatibilityMatrix: {
            '@types/pg': ['8.10.2']
          },
          rollbackThreshold: 1
        },
        'socket.io': {
          name: 'socket.io',
          version: '4.8.1',
          channel: 'stable',
          isActive: true,
          fallbackVersion: '4.7.0',
          compatibilityMatrix: {
            'socket.io-client': ['4.8.1', '4.7.0']
          },
          healthCheckUrl: '/socket.io/health',
          rollbackThreshold: 2
        }
      },
      profiles: {
        'development': {
          name: 'Development',
          description: 'Latest versions for development and testing',
          environment: 'development',
          dependencyOverrides: {
            'react': '19.1.0',
            'express': '4.18.2',
            'socket.io': '4.8.1'
          }
        },
        'staging': {
          name: 'Staging',
          description: 'Pre-production versions for testing',
          environment: 'staging',
          dependencyOverrides: {
            'react': '19.1.0',
            'express': '4.18.2',
            'socket.io': '4.8.1'
          }
        },
        'production': {
          name: 'Production',
          description: 'Stable versions for production environment',
          environment: 'production',
          dependencyOverrides: {
            'react': '19.1.0',
            'express': '4.18.2',
            'socket.io': '4.8.1'
          }
        },
        'fallback': {
          name: 'Fallback',
          description: 'Previous stable versions for emergency rollback',
          environment: 'production',
          dependencyOverrides: {
            'react': '18.2.0',
            'express': '4.17.1',
            'socket.io': '4.7.0'
          }
        }
      }
    };

    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(defaultConfig, null, 2));
    this.config = defaultConfig;
  }

  private setupFileWatcher(): void {
    // Watch for configuration changes
    fs.watch(this.configPath).then((watcher: any) => {
      watcher.on('change', async () => {
        try {
          await this.loadConfiguration();
          this.emit('configurationChanged', this.config);
        } catch (error) {
          console.error('Failed to reload dependency configuration:', error);
        }
      });
    }).catch(() => {
      // File doesn't exist yet, ignore
    });
  }

  public async switchProfile(profileName: string): Promise<boolean> {
    if (!this.config.profiles[profileName]) {
      throw new Error(`Profile '${profileName}' not found`);
    }

    console.log(`Switching to dependency profile: ${profileName}`);
    
    try {
      // Create backup of current state
      await this.createLockFile();

      const profile = this.config.profiles[profileName];
      const oldProfile = this.config.activeProfile;
      
      // Update dependency versions based on profile
      for (const [depName, version] of Object.entries(profile.dependencyOverrides)) {
        if (this.config.dependencies[depName]) {
          this.config.dependencies[depName].version = version;
        }
      }

      this.config.activeProfile = profileName;
      
      await this.saveConfiguration();
      
      // Generate new package.json files
      await this.updatePackageFiles();
      
      console.log(`Successfully switched from '${oldProfile}' to '${profileName}' profile`);
      this.emit('profileSwitched', { from: oldProfile, to: profileName, profile });
      
      return true;
    } catch (error) {
      console.error('Failed to switch dependency profile:', error);
      this.emit('profileSwitchFailed', { profile: profileName, error });
      return false;
    }
  }

  public async rollbackDependency(dependencyName: string): Promise<boolean> {
    const dependency = this.config.dependencies[dependencyName];
    if (!dependency || !dependency.fallbackVersion) {
      throw new Error(`Cannot rollback dependency '${dependencyName}' - no fallback version defined`);
    }

    console.log(`Rolling back ${dependencyName} from ${dependency.version} to ${dependency.fallbackVersion}`);

    try {
      const oldVersion = dependency.version;
      dependency.version = dependency.fallbackVersion;
      
      await this.saveConfiguration();
      await this.updatePackageFiles();
      
      console.log(`Successfully rolled back ${dependencyName}`);
      this.emit('dependencyRolledBack', { 
        name: dependencyName, 
        from: oldVersion, 
        to: dependency.fallbackVersion 
      });
      
      return true;
    } catch (error) {
      console.error(`Failed to rollback dependency ${dependencyName}:`, error);
      return false;
    }
  }

  public async updateDependency(
    dependencyName: string, 
    version: string, 
    channel: 'stable' | 'beta' | 'alpha' | 'canary' = 'stable'
  ): Promise<boolean> {
    if (!this.config.dependencies[dependencyName]) {
      throw new Error(`Dependency '${dependencyName}' not found in configuration`);
    }

    console.log(`Updating ${dependencyName} to version ${version} (${channel})`);

    try {
      // Validate compatibility
      const isCompatible = await this.validateCompatibility(dependencyName, version);
      if (!isCompatible) {
        throw new Error(`Version ${version} of ${dependencyName} is not compatible with current dependencies`);
      }

      const dependency = this.config.dependencies[dependencyName];
      const oldVersion = dependency.version;
      
      // Set previous version as fallback
      dependency.fallbackVersion = oldVersion;
      dependency.version = version;
      dependency.channel = channel;
      
      await this.saveConfiguration();
      await this.updatePackageFiles();
      
      console.log(`Successfully updated ${dependencyName} from ${oldVersion} to ${version}`);
      this.emit('dependencyUpdated', { 
        name: dependencyName, 
        from: oldVersion, 
        to: version,
        channel 
      });
      
      return true;
    } catch (error) {
      console.error(`Failed to update dependency ${dependencyName}:`, error);
      return false;
    }
  }

  private async validateCompatibility(dependencyName: string, version: string): Promise<boolean> {
    const dependency = this.config.dependencies[dependencyName];
    if (!dependency.compatibilityMatrix) {
      return true; // No compatibility constraints
    }

    // Check if all dependent packages support this version
    for (const [depName, supportedVersions] of Object.entries(dependency.compatibilityMatrix)) {
      const currentDep = this.config.dependencies[depName];
      if (currentDep && !supportedVersions.includes(currentDep.version)) {
        console.warn(`Compatibility issue: ${depName}@${currentDep.version} may not work with ${dependencyName}@${version}`);
        return false;
      }
    }

    return true;
  }

  private async updatePackageFiles(): Promise<void> {
    await Promise.all([
      this.updateBackendPackageJson(),
      this.updateFrontendPackageJson()
    ]);
  }

  private async updateBackendPackageJson(): Promise<void> {
    const packagePath = path.resolve('./backend/package.json');
    
    try {
      const packageData = await fs.readFile(packagePath, 'utf-8');
      const packageJson = JSON.parse(packageData);

      // Update backend dependencies
      const backendDeps = ['express', 'pg', 'socket.io', 'cors', 'helmet'];
      
      for (const depName of backendDeps) {
        const dependency = this.config.dependencies[depName];
        if (dependency && packageJson.dependencies[depName]) {
          packageJson.dependencies[depName] = `^${dependency.version}`;
        }
      }

      // Add dependency management metadata
      packageJson.dependencyManagement = {
        profile: this.config.activeProfile,
        managedBy: 'DependencyVersionManager',
        lastUpdated: new Date().toISOString()
      };

      await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2));
      console.log('Updated backend package.json');
    } catch (error) {
      console.error('Failed to update backend package.json:', error);
    }
  }

  private async updateFrontendPackageJson(): Promise<void> {
    const packagePath = path.resolve('./frontend/package.json');
    
    try {
      const packageData = await fs.readFile(packagePath, 'utf-8');
      const packageJson = JSON.parse(packageData);

      // Update frontend dependencies
      const frontendDeps = ['react', 'react-dom', 'react-router-dom', 'socket.io-client'];
      
      for (const depName of frontendDeps) {
        const dependency = this.config.dependencies[depName];
        if (dependency && packageJson.dependencies[depName]) {
          packageJson.dependencies[depName] = `^${dependency.version}`;
        }
      }

      // Add dependency management metadata
      packageJson.dependencyManagement = {
        profile: this.config.activeProfile,
        managedBy: 'DependencyVersionManager',
        lastUpdated: new Date().toISOString()
      };

      await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2));
      console.log('Updated frontend package.json');
    } catch (error) {
      console.error('Failed to update frontend package.json:', error);
    }
  }

  private async createLockFile(): Promise<void> {
    const lockData = {
      timestamp: new Date().toISOString(),
      activeProfile: this.config.activeProfile,
      dependencies: { ...this.config.dependencies }
    };

    await fs.writeFile(this.lockFilePath, JSON.stringify(lockData, null, 2));
  }

  public async restoreFromLockFile(): Promise<boolean> {
    try {
      const lockData = await fs.readFile(this.lockFilePath, 'utf-8');
      const lock = JSON.parse(lockData);

      console.log(`Restoring dependency state from ${lock.timestamp}`);
      
      this.config.activeProfile = lock.activeProfile;
      this.config.dependencies = lock.dependencies;
      
      await this.saveConfiguration();
      await this.updatePackageFiles();
      
      console.log('Successfully restored dependency state');
      this.emit('stateRestored', lock);
      
      return true;
    } catch (error) {
      console.error('Failed to restore from lock file:', error);
      return false;
    }
  }

  private async saveConfiguration(): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  public getDependencyVersion(name: string): string | null {
    const dependency = this.config.dependencies[name];
    return dependency ? dependency.version : null;
  }

  public getCurrentProfile(): string {
    return this.config.activeProfile;
  }

  public getAvailableProfiles(): string[] {
    return Object.keys(this.config.profiles);
  }

  public getDependencies(): Record<string, DependencyVersion> {
    return { ...this.config.dependencies };
  }

  public async createProfile(
    name: string, 
    description: string, 
    environment: string,
    dependencyOverrides: Record<string, string>
  ): Promise<void> {
    this.config.profiles[name] = {
      name,
      description,
      environment,
      dependencyOverrides
    };

    await this.saveConfiguration();
    console.log(`Created new profile: ${name}`);
    this.emit('profileCreated', { name, profile: this.config.profiles[name] });
  }

  public async deleteProfile(name: string): Promise<void> {
    if (name === this.config.activeProfile) {
      throw new Error('Cannot delete active profile');
    }

    if (!this.config.profiles[name]) {
      throw new Error(`Profile '${name}' not found`);
    }

    delete this.config.profiles[name];
    await this.saveConfiguration();
    
    console.log(`Deleted profile: ${name}`);
    this.emit('profileDeleted', { name });
  }

  // Health check integration
  public async performHealthChecks(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [name, dependency] of Object.entries(this.config.dependencies)) {
      if (dependency.healthCheckUrl) {
        try {
          const response = await fetch(`http://localhost:5000${dependency.healthCheckUrl}`, {
            method: 'GET',
            timeout: 5000
          });
          results[name] = response.ok;
        } catch (error) {
          results[name] = false;
        }
      } else {
        results[name] = true; // Assume healthy if no health check defined
      }
    }

    return results;
  }
}

export const dependencyVersionManager = new DependencyVersionManager();
