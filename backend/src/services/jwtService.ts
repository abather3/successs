import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import crypto from 'crypto';
import { config } from '../config/config';

export interface JwtKeyConfig {
  algorithm: string;
  keyId: string;
  publicKey: string;
  privateKey: string;
  isActive: boolean;
  expiresAt: Date;
}

export interface JwtPayload {
  userId: number;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
  jti?: string;
  kid?: string;
}

export class JwtService {
  private static keys: Map<string, JwtKeyConfig> = new Map();
  private static activeKeyId: string = '';
  
  // Initialize with default key if no KMS is configured
  static async initialize(): Promise<void> {
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
    } catch (error) {
      console.error('Failed to initialize JWT service:', error);
      // Fallback to environment variables
      this.activeKeyId = 'default';
      this.keys.set('default', {
        algorithm: 'HS256',
        keyId: 'default',
        publicKey: config.JWT_SECRET,
        privateKey: config.JWT_SECRET,
        isActive: true,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
      });
    }
  }

  static async signToken(payload: Omit<JwtPayload, 'iat' | 'exp' | 'jti' | 'kid'>, options?: {
    expiresIn?: string;
    audience?: string;
    issuer?: string;
  }): Promise<string> {
    const activeKey = this.keys.get(this.activeKeyId);
    if (!activeKey) {
      throw new Error('No active JWT key found');
    }

    const jwtPayload: JwtPayload = {
      ...payload,
      jti: crypto.randomUUID(), // JWT ID for revocation
      kid: activeKey.keyId
    };

    const signOptions: jwt.SignOptions = {
      algorithm: activeKey.algorithm as jwt.Algorithm,
      expiresIn: (options?.expiresIn || config.JWT_EXPIRES_IN) as any,
      audience: options?.audience,
      issuer: options?.issuer || 'escashop'
    };

    return jwt.sign(jwtPayload, activeKey.privateKey, signOptions);
  }

  static async verifyToken(token: string): Promise<JwtPayload> {
    // Decode header to get kid
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      throw new Error('Invalid token format');
    }

    const kid = decoded.header.kid || this.activeKeyId;
    const key = this.keys.get(kid);
    
    if (!key) {
      throw new Error(`Key with ID ${kid} not found`);
    }

    try {
      const payload = jwt.verify(token, key.publicKey, {
        algorithms: [key.algorithm as jwt.Algorithm]
      }) as JwtPayload;

      // Check if token is revoked
      if (payload.jti && await this.isTokenRevoked(payload.jti)) {
        throw new Error('Token has been revoked');
      }

      return payload;
    } catch (error) {
      // Map JWT errors to custom error codes
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error(JSON.stringify({ code: 'TOKEN_EXPIRED', message: error.message }));
      } else if (error instanceof jwt.NotBeforeError) {
        throw new Error(JSON.stringify({ code: 'TOKEN_INVALID', message: error.message }));
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error(JSON.stringify({ code: 'TOKEN_INVALID', message: error.message }));
      }
      throw new Error(`Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async revokeToken(jti: string): Promise<void> {
    const query = `
      INSERT INTO revoked_tokens (jti, revoked_at)
      VALUES ($1, CURRENT_TIMESTAMP)
      ON CONFLICT (jti) DO NOTHING
    `;
    
    await pool.query(query, [jti]);
  }

  static async isTokenRevoked(jti: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM revoked_tokens WHERE jti = $1
    `;
    
    const result = await pool.query(query, [jti]);
    return result.rows.length > 0;
  }

  static async generateNewKeyPair(): Promise<string> {
    const keyId = crypto.randomUUID();
    const algorithm = 'RS256';
    
    // Generate RSA key pair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
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

    const keyConfig: JwtKeyConfig = {
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

  static async rotateKeys(): Promise<void> {
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

  static async getPublicKeys(): Promise<{ [kid: string]: string }> {
    const publicKeys: { [kid: string]: string } = {};
    
    for (const [keyId, key] of this.keys) {
      publicKeys[keyId] = key.publicKey;
    }
    
    return publicKeys;
  }

  static async getActiveKeyId(): Promise<string> {
    return this.activeKeyId;
  }

  private static async loadKeysFromDatabase(): Promise<void> {
    const query = `
      SELECT key_id, algorithm, public_key, private_key, is_active, expires_at
      FROM jwt_keys
      WHERE expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query);
    
    for (const row of result.rows) {
      const keyConfig: JwtKeyConfig = {
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

  private static async storeKey(keyConfig: JwtKeyConfig): Promise<void> {
    const query = `
      INSERT INTO jwt_keys (key_id, algorithm, public_key, private_key, is_active, expires_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    `;
    
    await pool.query(query, [
      keyConfig.keyId,
      keyConfig.algorithm,
      keyConfig.publicKey,
      keyConfig.privateKey,
      keyConfig.isActive,
      keyConfig.expiresAt
    ]);
  }

  private static async updateKeyStatus(keyId: string, isActive: boolean): Promise<void> {
    const query = `
      UPDATE jwt_keys 
      SET is_active = $2, updated_at = CURRENT_TIMESTAMP
      WHERE key_id = $1
    `;
    
    await pool.query(query, [keyId, isActive]);
  }

  private static async cleanupExpiredKeys(): Promise<void> {
    // Keep expired keys for grace period (7 days) to allow token validation
    const gracePeriod = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    
    const query = `
      DELETE FROM jwt_keys 
      WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '${gracePeriod} milliseconds'
    `;
    
    await pool.query(query);
    
    // Remove from memory cache
    for (const [keyId, key] of this.keys) {
      if (key.expiresAt.getTime() < Date.now() - gracePeriod) {
        this.keys.delete(keyId);
      }
    }
  }

  // KMS Integration Methods (placeholder for actual KMS implementation)
  static async fetchKeyFromKMS(keyId: string): Promise<JwtKeyConfig | null> {
    // This would integrate with AWS KMS, Azure Key Vault, etc.
    // For now, return null to indicate no KMS integration
    return null;
  }

  static async storeKeyInKMS(keyConfig: JwtKeyConfig): Promise<void> {
    // This would store the key in KMS
    // For now, we just store in database
    await this.storeKey(keyConfig);
  }

  // Utility method to schedule key rotation
  static scheduleKeyRotation(intervalHours: number = 24 * 30): void { // Default: 30 days
    setInterval(async () => {
      try {
        await this.rotateKeys();
        console.log('JWT keys rotated successfully');
      } catch (error) {
        console.error('Failed to rotate JWT keys:', error);
      }
    }, intervalHours * 60 * 60 * 1000);
  }
}
