import { readFileSync } from 'fs';
import { join } from 'path';

// Types for different secret providers
interface SecretProvider {
  getSecret(key: string): Promise<string | null>;
  initialize(): Promise<void>;
}

interface VaultConfig {
  url: string;
  token?: string;
  roleId?: string;
  secretId?: string;
  namespace?: string;
  mountPath?: string;
}

interface AWSSecretsConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
}

// HashiCorp Vault Provider
class HashiCorpVaultProvider implements SecretProvider {
  private vaultUrl: string;
  private token: string | null = null;
  private namespace: string;
  private mountPath: string;

  constructor(private config: VaultConfig) {
    this.vaultUrl = config.url;
    this.namespace = config.namespace || 'admin';
    this.mountPath = config.mountPath || 'secret';
  }

  async initialize(): Promise<void> {
    try {
      if (this.config.token) {
        this.token = this.config.token;
      } else if (this.config.roleId && this.config.secretId) {
        // AppRole authentication
        await this.authenticateWithAppRole();
      } else {
        // Try to read token from file (common in Kubernetes/Docker environments)
        try {
          const tokenPath = process.env.VAULT_TOKEN_PATH || '/vault/secrets/token';
          this.token = readFileSync(tokenPath, 'utf8').trim();
        } catch (error) {
          throw new Error('No authentication method available for Vault');
        }
      }
    } catch (error) {
      console.error('Failed to initialize Vault provider:', error);
      throw error;
    }
  }

  private async authenticateWithAppRole(): Promise<void> {
    const response = await fetch(`${this.vaultUrl}/v1/auth/approle/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vault-Namespace': this.namespace,
      },
      body: JSON.stringify({
        role_id: this.config.roleId,
        secret_id: this.config.secretId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Vault authentication failed: ${response.statusText}`);
    }

      const data = await response.json() as any;
      this.token = data.auth.client_token;
  }

  async getSecret(key: string): Promise<string | null> {
    if (!this.token) {
      await this.initialize();
    }

    try {
      const response = await fetch(`${this.vaultUrl}/v1/${this.mountPath}/data/${key}`, {
        headers: {
          'X-Vault-Token': this.token!,
          'X-Vault-Namespace': this.namespace,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to retrieve secret: ${response.statusText}`);
      }

      const data = await response.json() as any;
      return data.data?.data?.value || null;
    } catch (error) {
      console.error(`Error retrieving secret ${key}:`, error);
      return null;
    }
  }
}

// AWS Secrets Manager Provider
class AWSSecretsManagerProvider implements SecretProvider {
  private region: string;
  private credentials: any;

  constructor(private config: AWSSecretsConfig) {
    this.region = config.region;
  }

  async initialize(): Promise<void> {
    try {
      // In a real implementation, you would use AWS SDK
      // This is a placeholder for AWS SDK initialization
      console.log('AWS Secrets Manager provider initialized');
    } catch (error) {
      console.error('Failed to initialize AWS Secrets Manager provider:', error);
      throw error;
    }
  }

  async getSecret(key: string): Promise<string | null> {
    try {
      // Placeholder for AWS SDK implementation
      // In real implementation, you would use:
      // const client = new SecretsManagerClient({ region: this.region });
      // const command = new GetSecretValueCommand({ SecretId: key });
      // const response = await client.send(command);
      // return response.SecretString || null;
      
      console.log(`Would retrieve secret ${key} from AWS Secrets Manager`);
      return null;
    } catch (error) {
      console.error(`Error retrieving secret ${key} from AWS:`, error);
      return null;
    }
  }
}

// Environment fallback provider
class EnvironmentProvider implements SecretProvider {
  async initialize(): Promise<void> {
    // No initialization needed for environment variables
  }

  async getSecret(key: string): Promise<string | null> {
    return process.env[key] || null;
  }
}

// Main Secrets Manager class
export class SecretsManager {
  private providers: SecretProvider[] = [];
  private cache: Map<string, string> = new Map();
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamps: Map<string, number> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize providers based on configuration
    if (process.env.VAULT_URL) {
      const vaultProvider = new HashiCorpVaultProvider({
        url: process.env.VAULT_URL,
        token: process.env.VAULT_TOKEN,
        roleId: process.env.VAULT_ROLE_ID,
        secretId: process.env.VAULT_SECRET_ID,
        namespace: process.env.VAULT_NAMESPACE,
        mountPath: process.env.VAULT_MOUNT_PATH,
      });
      this.providers.push(vaultProvider);
    }

    if (process.env.AWS_SECRETS_REGION) {
      const awsProvider = new AWSSecretsManagerProvider({
        region: process.env.AWS_SECRETS_REGION,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      });
      this.providers.push(awsProvider);
    }

    // Always add environment provider as fallback
    this.providers.push(new EnvironmentProvider());
  }

  async initialize(): Promise<void> {
    for (const provider of this.providers) {
      try {
        await provider.initialize();
      } catch (error) {
        console.error('Failed to initialize provider:', error);
      }
    }
  }

  async getSecret(key: string): Promise<string | null> {
    // Check cache first
    const cachedValue = this.getCachedSecret(key);
    if (cachedValue) {
      return cachedValue;
    }

    // Try each provider in order
    for (const provider of this.providers) {
      try {
        const value = await provider.getSecret(key);
        if (value) {
          this.setCachedSecret(key, value);
          return value;
        }
      } catch (error) {
        console.error(`Provider failed to retrieve secret ${key}:`, error);
      }
    }

    return null;
  }

  private getCachedSecret(key: string): string | null {
    const timestamp = this.cacheTimestamps.get(key);
    if (timestamp && Date.now() - timestamp < this.cacheTimeout) {
      return this.cache.get(key) || null;
    }
    return null;
  }

  private setCachedSecret(key: string, value: string): void {
    this.cache.set(key, value);
    this.cacheTimestamps.set(key, Date.now());
  }

  // Helper method to get required secrets with validation
  async getRequiredSecret(key: string): Promise<string> {
    const value = await this.getSecret(key);
    if (!value) {
      throw new Error(`Required secret '${key}' not found in any provider`);
    }
    return value;
  }

  // Method to refresh cache for a specific key
  async refreshSecret(key: string): Promise<string | null> {
    this.cache.delete(key);
    this.cacheTimestamps.delete(key);
    return await this.getSecret(key);
  }

  // Method to clear all cached secrets
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }
}

// Singleton instance
export const secretsManager = new SecretsManager();

// Helper functions for common secrets
export async function getDBConnectionString(): Promise<string> {
  return await secretsManager.getRequiredSecret('DATABASE_URL');
}

export async function getJWTSecret(): Promise<string> {
  return await secretsManager.getRequiredSecret('JWT_SECRET');
}

export async function getJWTRefreshSecret(): Promise<string> {
  return await secretsManager.getRequiredSecret('JWT_REFRESH_SECRET');
}

export async function getSMSAPIKey(): Promise<string> {
  return await secretsManager.getRequiredSecret('SMS_API_KEY');
}

export async function getEmailPassword(): Promise<string> {
  return await secretsManager.getRequiredSecret('EMAIL_PASSWORD');
}

export async function getTwilioAuthToken(): Promise<string> {
  return await secretsManager.getRequiredSecret('TWILIO_AUTH_TOKEN');
}

export async function getClicksendAPIKey(): Promise<string> {
  return await secretsManager.getRequiredSecret('CLICKSEND_API_KEY');
}

export async function getVonageAPISecret(): Promise<string> {
  return await secretsManager.getRequiredSecret('VONAGE_API_SECRET');
}

export async function getGoogleSheetsAPIKey(): Promise<string> {
  return await secretsManager.getRequiredSecret('GOOGLE_SHEETS_API_KEY');
}
