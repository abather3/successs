"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretsManager = exports.SecretsManager = void 0;
exports.getDBConnectionString = getDBConnectionString;
exports.getJWTSecret = getJWTSecret;
exports.getJWTRefreshSecret = getJWTRefreshSecret;
exports.getSMSAPIKey = getSMSAPIKey;
exports.getEmailPassword = getEmailPassword;
exports.getTwilioAuthToken = getTwilioAuthToken;
exports.getClicksendAPIKey = getClicksendAPIKey;
exports.getVonageAPISecret = getVonageAPISecret;
exports.getGoogleSheetsAPIKey = getGoogleSheetsAPIKey;
const fs_1 = require("fs");
// HashiCorp Vault Provider
class HashiCorpVaultProvider {
    constructor(config) {
        this.config = config;
        this.token = null;
        this.vaultUrl = config.url;
        this.namespace = config.namespace || 'admin';
        this.mountPath = config.mountPath || 'secret';
    }
    async initialize() {
        try {
            if (this.config.token) {
                this.token = this.config.token;
            }
            else if (this.config.roleId && this.config.secretId) {
                // AppRole authentication
                await this.authenticateWithAppRole();
            }
            else {
                // Try to read token from file (common in Kubernetes/Docker environments)
                try {
                    const tokenPath = process.env.VAULT_TOKEN_PATH || '/vault/secrets/token';
                    this.token = (0, fs_1.readFileSync)(tokenPath, 'utf8').trim();
                }
                catch (error) {
                    throw new Error('No authentication method available for Vault');
                }
            }
        }
        catch (error) {
            console.error('Failed to initialize Vault provider:', error);
            throw error;
        }
    }
    async authenticateWithAppRole() {
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
        const data = await response.json();
        this.token = data.auth.client_token;
    }
    async getSecret(key) {
        if (!this.token) {
            await this.initialize();
        }
        try {
            const response = await fetch(`${this.vaultUrl}/v1/${this.mountPath}/data/${key}`, {
                headers: {
                    'X-Vault-Token': this.token,
                    'X-Vault-Namespace': this.namespace,
                },
            });
            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new Error(`Failed to retrieve secret: ${response.statusText}`);
            }
            const data = await response.json();
            return data.data?.data?.value || null;
        }
        catch (error) {
            console.error(`Error retrieving secret ${key}:`, error);
            return null;
        }
    }
}
// AWS Secrets Manager Provider
class AWSSecretsManagerProvider {
    constructor(config) {
        this.config = config;
        this.region = config.region;
    }
    async initialize() {
        try {
            // In a real implementation, you would use AWS SDK
            // This is a placeholder for AWS SDK initialization
            console.log('AWS Secrets Manager provider initialized');
        }
        catch (error) {
            console.error('Failed to initialize AWS Secrets Manager provider:', error);
            throw error;
        }
    }
    async getSecret(key) {
        try {
            // Placeholder for AWS SDK implementation
            // In real implementation, you would use:
            // const client = new SecretsManagerClient({ region: this.region });
            // const command = new GetSecretValueCommand({ SecretId: key });
            // const response = await client.send(command);
            // return response.SecretString || null;
            console.log(`Would retrieve secret ${key} from AWS Secrets Manager`);
            return null;
        }
        catch (error) {
            console.error(`Error retrieving secret ${key} from AWS:`, error);
            return null;
        }
    }
}
// Environment fallback provider
class EnvironmentProvider {
    async initialize() {
        // No initialization needed for environment variables
    }
    async getSecret(key) {
        return process.env[key] || null;
    }
}
// Main Secrets Manager class
class SecretsManager {
    constructor() {
        this.providers = [];
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.cacheTimestamps = new Map();
        this.initializeProviders();
    }
    initializeProviders() {
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
    async initialize() {
        for (const provider of this.providers) {
            try {
                await provider.initialize();
            }
            catch (error) {
                console.error('Failed to initialize provider:', error);
            }
        }
    }
    async getSecret(key) {
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
            }
            catch (error) {
                console.error(`Provider failed to retrieve secret ${key}:`, error);
            }
        }
        return null;
    }
    getCachedSecret(key) {
        const timestamp = this.cacheTimestamps.get(key);
        if (timestamp && Date.now() - timestamp < this.cacheTimeout) {
            return this.cache.get(key) || null;
        }
        return null;
    }
    setCachedSecret(key, value) {
        this.cache.set(key, value);
        this.cacheTimestamps.set(key, Date.now());
    }
    // Helper method to get required secrets with validation
    async getRequiredSecret(key) {
        const value = await this.getSecret(key);
        if (!value) {
            throw new Error(`Required secret '${key}' not found in any provider`);
        }
        return value;
    }
    // Method to refresh cache for a specific key
    async refreshSecret(key) {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
        return await this.getSecret(key);
    }
    // Method to clear all cached secrets
    clearCache() {
        this.cache.clear();
        this.cacheTimestamps.clear();
    }
}
exports.SecretsManager = SecretsManager;
// Singleton instance
exports.secretsManager = new SecretsManager();
// Helper functions for common secrets
async function getDBConnectionString() {
    return await exports.secretsManager.getRequiredSecret('DATABASE_URL');
}
async function getJWTSecret() {
    return await exports.secretsManager.getRequiredSecret('JWT_SECRET');
}
async function getJWTRefreshSecret() {
    return await exports.secretsManager.getRequiredSecret('JWT_REFRESH_SECRET');
}
async function getSMSAPIKey() {
    return await exports.secretsManager.getRequiredSecret('SMS_API_KEY');
}
async function getEmailPassword() {
    return await exports.secretsManager.getRequiredSecret('EMAIL_PASSWORD');
}
async function getTwilioAuthToken() {
    return await exports.secretsManager.getRequiredSecret('TWILIO_AUTH_TOKEN');
}
async function getClicksendAPIKey() {
    return await exports.secretsManager.getRequiredSecret('CLICKSEND_API_KEY');
}
async function getVonageAPISecret() {
    return await exports.secretsManager.getRequiredSecret('VONAGE_API_SECRET');
}
async function getGoogleSheetsAPIKey() {
    return await exports.secretsManager.getRequiredSecret('GOOGLE_SHEETS_API_KEY');
}
//# sourceMappingURL=secretsManager.js.map