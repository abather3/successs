"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config/config");
class JwtService {
    // Initialize with default key if no KMS is configured
    static async initialize() {
        try {
            await this.loadKeysFromDatabase();
            if (this.keys.size === 0) {
                // Generate initial key pair if none exist
                await this.generateNewKeyPair();
            }
            // Set active key
            const activeKey = Array.from(this.keys.values()).find(key => key.isActive);
            if (activeKey) {
                this.activeKeyId = activeKey.keyId;
            }
        }
        catch (error) {
            console.error('Failed to initialize JWT service:', error);
            // Fallback to environment variables
            this.activeKeyId = 'default';
            this.keys.set('default', {
                algorithm: 'HS256',
                keyId: 'default',
                publicKey: config_1.config.JWT_SECRET,
                privateKey: config_1.config.JWT_SECRET,
                isActive: true,
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
            });
        }
    }
    static async signToken(payload, options) {
        const activeKey = this.keys.get(this.activeKeyId);
        if (!activeKey) {
            throw new Error('No active JWT key found');
        }
        const jwtPayload = {
            ...payload,
            jti: crypto_1.default.randomUUID(), // JWT ID for revocation
            kid: activeKey.keyId
        };
        const signOptions = {
            algorithm: activeKey.algorithm,
            expiresIn: (options?.expiresIn || config_1.config.JWT_EXPIRES_IN),
            audience: options?.audience,
            issuer: options?.issuer || 'escashop'
        };
        return jsonwebtoken_1.default.sign(jwtPayload, activeKey.privateKey, signOptions);
    }
    static async verifyToken(token) {
        // Decode header to get kid
        const decoded = jsonwebtoken_1.default.decode(token, { complete: true });
        if (!decoded || typeof decoded === 'string') {
            throw new Error('Invalid token format');
        }
        const kid = decoded.header.kid || this.activeKeyId;
        const key = this.keys.get(kid);
        if (!key) {
            throw new Error(`Key with ID ${kid} not found`);
        }
        try {
            const payload = jsonwebtoken_1.default.verify(token, key.publicKey, {
                algorithms: [key.algorithm]
            });
            // Check if token is revoked
            if (payload.jti && await this.isTokenRevoked(payload.jti)) {
                throw new Error('Token has been revoked');
            }
            return payload;
        }
        catch (error) {
            // Map JWT errors to custom error codes
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                throw new Error(JSON.stringify({ code: 'TOKEN_EXPIRED', message: error.message }));
            }
            else if (error instanceof jsonwebtoken_1.default.NotBeforeError) {
                throw new Error(JSON.stringify({ code: 'TOKEN_INVALID', message: error.message }));
            }
            else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                throw new Error(JSON.stringify({ code: 'TOKEN_INVALID', message: error.message }));
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Token verification failed: ${errorMessage}`);
        }
    }
    static async revokeToken(jti) {
        const query = `
      INSERT INTO revoked_tokens (jti, revoked_at)
      VALUES ($1, CURRENT_TIMESTAMP)
      ON CONFLICT (jti) DO NOTHING
    `;
        await database_1.pool.query(query, [jti]);
    }
    static async isTokenRevoked(jti) {
        const query = `
      SELECT 1 FROM revoked_tokens WHERE jti = $1
    `;
        const result = await database_1.pool.query(query, [jti]);
        return result.rows.length > 0;
    }
    static async generateNewKeyPair() {
        const keyId = crypto_1.default.randomUUID();
        const algorithm = 'RS256';
        // Generate RSA key pair
        const { publicKey, privateKey } = crypto_1.default.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });
        const keyConfig = {
            algorithm,
            keyId,
            publicKey,
            privateKey,
            isActive: false,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
        };
        // Store in database
        await this.storeKey(keyConfig);
        // Add to memory cache
        this.keys.set(keyId, keyConfig);
        return keyId;
    }
    static async rotateKeys() {
        // Generate new key pair
        const newKeyId = await this.generateNewKeyPair();
        // Deactivate current active key
        if (this.activeKeyId) {
            const currentKey = this.keys.get(this.activeKeyId);
            if (currentKey) {
                currentKey.isActive = false;
                await this.updateKeyStatus(this.activeKeyId, false);
            }
        }
        // Activate new key
        const newKey = this.keys.get(newKeyId);
        if (newKey) {
            newKey.isActive = true;
            await this.updateKeyStatus(newKeyId, true);
            this.activeKeyId = newKeyId;
        }
        // Clean up expired keys
        await this.cleanupExpiredKeys();
    }
    static async getPublicKeys() {
        const publicKeys = {};
        for (const [keyId, key] of this.keys) {
            publicKeys[keyId] = key.publicKey;
        }
        return publicKeys;
    }
    static async getActiveKeyId() {
        return this.activeKeyId;
    }
    static async loadKeysFromDatabase() {
        const query = `
      SELECT key_id, algorithm, public_key, private_key, is_active, expires_at
      FROM jwt_keys
      WHERE expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
    `;
        const result = await database_1.pool.query(query);
        for (const row of result.rows) {
            const keyConfig = {
                algorithm: row.algorithm,
                keyId: row.key_id,
                publicKey: row.public_key,
                privateKey: row.private_key,
                isActive: row.is_active,
                expiresAt: row.expires_at
            };
            this.keys.set(row.key_id, keyConfig);
        }
    }
    static async storeKey(keyConfig) {
        const query = `
      INSERT INTO jwt_keys (key_id, algorithm, public_key, private_key, is_active, expires_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    `;
        await database_1.pool.query(query, [
            keyConfig.keyId,
            keyConfig.algorithm,
            keyConfig.publicKey,
            keyConfig.privateKey,
            keyConfig.isActive,
            keyConfig.expiresAt
        ]);
    }
    static async updateKeyStatus(keyId, isActive) {
        const query = `
      UPDATE jwt_keys 
      SET is_active = $2, updated_at = CURRENT_TIMESTAMP
      WHERE key_id = $1
    `;
        await database_1.pool.query(query, [keyId, isActive]);
    }
    static async cleanupExpiredKeys() {
        // Keep expired keys for grace period (7 days) to allow token validation
        const gracePeriod = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        const query = `
      DELETE FROM jwt_keys 
      WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '${gracePeriod} milliseconds'
    `;
        await database_1.pool.query(query);
        // Remove from memory cache
        for (const [keyId, key] of this.keys) {
            if (key.expiresAt.getTime() < Date.now() - gracePeriod) {
                this.keys.delete(keyId);
            }
        }
    }
    // KMS Integration Methods (placeholder for actual KMS implementation)
    static async fetchKeyFromKMS(keyId) {
        // This would integrate with AWS KMS, Azure Key Vault, etc.
        // For now, return null to indicate no KMS integration
        return null;
    }
    static async storeKeyInKMS(keyConfig) {
        // This would store the key in KMS
        // For now, we just store in database
        await this.storeKey(keyConfig);
    }
    // Utility method to schedule key rotation
    static scheduleKeyRotation(intervalHours = 24 * 30) {
        setInterval(async () => {
            try {
                await this.rotateKeys();
                console.log('JWT keys rotated successfully');
            }
            catch (error) {
                console.error('Failed to rotate JWT keys:', error);
            }
        }, intervalHours * 60 * 60 * 1000);
    }
}
exports.JwtService = JwtService;
JwtService.keys = new Map();
JwtService.activeKeyId = '';
//# sourceMappingURL=jwtService.js.map