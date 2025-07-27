import { pool } from '../config/database';
import { authenticator } from 'otplib';
import crypto from 'crypto';
import QRCode from 'qrcode';

export interface MfaConfig {
  enabled: boolean;
  issuer: string;
  windowSize: number;
  backupCodesCount: number;
}

export interface TotpSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
  otpAuthUrl: string;
}

export class MfaService {
  private static config: MfaConfig = {
    enabled: true,
    issuer: 'EscaShop',
    windowSize: 1,
    backupCodesCount: 10
  };

  // TOTP Methods
  static async enableTotp(userId: number, userEmail: string): Promise<TotpSetup> {
    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(userEmail, this.config.issuer, secret);
    const qrCode = await QRCode.toDataURL(otpAuthUrl);
    
    // Generate backup codes
    const backupCodes = this.generateBackupCodes(this.config.backupCodesCount);
    
    // Store in database (not activated yet)
    const query = `
      INSERT INTO user_mfa (user_id, type, secret, backup_codes, enabled, created_at)
      VALUES ($1, 'totp', $2, $3, false, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, type) 
      DO UPDATE SET secret = $2, backup_codes = $3, enabled = false, updated_at = CURRENT_TIMESTAMP
    `;
    
    await pool.query(query, [userId, secret, JSON.stringify(backupCodes)]);
    
    return {
      secret,
      qrCode,
      backupCodes,
      otpAuthUrl
    };
  }

  static async verifyTotpSetup(userId: number, token: string): Promise<boolean> {
    const query = `
      SELECT secret 
      FROM user_mfa 
      WHERE user_id = $1 AND type = 'totp' AND enabled = false
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return false;
    }
    
    const secret = result.rows[0].secret;
    const isValid = authenticator.verify({
      token,
      secret
    });
    
    if (isValid) {
      // Activate TOTP
      const updateQuery = `
        UPDATE user_mfa 
        SET enabled = true, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = $1 AND type = 'totp'
      `;
      
      await pool.query(updateQuery, [userId]);
    }
    
    return isValid;
  }

  static async verifyTotp(userId: number, token: string): Promise<boolean> {
    const query = `
      SELECT secret 
      FROM user_mfa 
      WHERE user_id = $1 AND type = 'totp' AND enabled = true
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return false;
    }
    
    const secret = result.rows[0].secret;
    return authenticator.verify({
      token,
      secret
    });
  }

  static async verifyBackupCode(userId: number, code: string): Promise<boolean> {
    const query = `
      SELECT backup_codes 
      FROM user_mfa 
      WHERE user_id = $1 AND type = 'totp' AND enabled = true
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return false;
    }
    
    const backupCodes = JSON.parse(result.rows[0].backup_codes);
    const codeIndex = backupCodes.indexOf(code);
    
    if (codeIndex === -1) {
      return false;
    }
    
    // Remove used backup code
    backupCodes.splice(codeIndex, 1);
    
    const updateQuery = `
      UPDATE user_mfa 
      SET backup_codes = $2, updated_at = CURRENT_TIMESTAMP 
      WHERE user_id = $1 AND type = 'totp'
    `;
    
    await pool.query(updateQuery, [userId, JSON.stringify(backupCodes)]);
    
    return true;
  }

  static async generateNewBackupCodes(userId: number): Promise<string[]> {
    const backupCodes = this.generateBackupCodes(this.config.backupCodesCount);
    
    const query = `
      UPDATE user_mfa 
      SET backup_codes = $2, updated_at = CURRENT_TIMESTAMP 
      WHERE user_id = $1 AND type = 'totp' AND enabled = true
    `;
    
    await pool.query(query, [userId, JSON.stringify(backupCodes)]);
    
    return backupCodes;
  }

  // WebAuthn Methods
  static async registerWebAuthnCredential(userId: number, credentialData: {
    credentialId: string;
    publicKey: string;
    counter: number;
    aaguid: string;
    name: string;
  }): Promise<void> {
    const query = `
      INSERT INTO webauthn_credentials (
        user_id, 
        credential_id, 
        public_key, 
        counter, 
        aaguid, 
        name, 
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    `;
    
    await pool.query(query, [
      userId,
      credentialData.credentialId,
      credentialData.publicKey,
      credentialData.counter,
      credentialData.aaguid,
      credentialData.name
    ]);
  }

  static async getWebAuthnCredentials(userId: number): Promise<Array<{
    id: number;
    credentialId: string;
    publicKey: string;
    counter: number;
    aaguid: string;
    name: string;
    lastUsed: Date | null;
  }>> {
    const query = `
      SELECT id, credential_id, public_key, counter, aaguid, name, last_used
      FROM webauthn_credentials 
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query, [userId]);
    return result.rows.map(row => ({
      id: row.id,
      credentialId: row.credential_id,
      publicKey: row.public_key,
      counter: row.counter,
      aaguid: row.aaguid,
      name: row.name,
      lastUsed: row.last_used
    }));
  }

  static async updateWebAuthnCounter(credentialId: string, counter: number): Promise<void> {
    const query = `
      UPDATE webauthn_credentials 
      SET counter = $2, last_used = CURRENT_TIMESTAMP 
      WHERE credential_id = $1
    `;
    
    await pool.query(query, [credentialId, counter]);
  }

  static async removeWebAuthnCredential(userId: number, credentialId: string): Promise<void> {
    const query = `
      DELETE FROM webauthn_credentials 
      WHERE user_id = $1 AND credential_id = $2
    `;
    
    await pool.query(query, [userId, credentialId]);
  }

  // General MFA Methods
  static async getUserMfaStatus(userId: number): Promise<{
    totpEnabled: boolean;
    webAuthnEnabled: boolean;
    backupCodesRemaining: number;
    webAuthnCredentials: number;
  }> {
    const totpQuery = `
      SELECT enabled, backup_codes 
      FROM user_mfa 
      WHERE user_id = $1 AND type = 'totp'
    `;
    
    const webAuthnQuery = `
      SELECT COUNT(*) as credential_count 
      FROM webauthn_credentials 
      WHERE user_id = $1
    `;
    
    const [totpResult, webAuthnResult] = await Promise.all([
      pool.query(totpQuery, [userId]),
      pool.query(webAuthnQuery, [userId])
    ]);
    
    const totpEnabled = totpResult.rows.length > 0 && totpResult.rows[0].enabled;
    const backupCodes = totpResult.rows.length > 0 && totpResult.rows[0].backup_codes 
      ? JSON.parse(totpResult.rows[0].backup_codes) 
      : [];
    
    return {
      totpEnabled,
      webAuthnEnabled: parseInt(webAuthnResult.rows[0].credential_count) > 0,
      backupCodesRemaining: backupCodes.length,
      webAuthnCredentials: parseInt(webAuthnResult.rows[0].credential_count)
    };
  }

  static async disableTotp(userId: number): Promise<void> {
    const query = `
      DELETE FROM user_mfa 
      WHERE user_id = $1 AND type = 'totp'
    `;
    
    await pool.query(query, [userId]);
  }

  static async disableAllMfa(userId: number): Promise<void> {
    const queries = [
      `DELETE FROM user_mfa WHERE user_id = $1`,
      `DELETE FROM webauthn_credentials WHERE user_id = $1`
    ];
    
    for (const query of queries) {
      await pool.query(query, [userId]);
    }
  }

  static async requiresMfa(userId: number): Promise<boolean> {
    const status = await this.getUserMfaStatus(userId);
    return status.totpEnabled || status.webAuthnEnabled;
  }

  // Helper Methods
  private static generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(5).toString('hex').toUpperCase();
      codes.push(code);
    }
    
    return codes;
  }

  static getConfig(): MfaConfig {
    return { ...this.config };
  }

  static updateConfig(newConfig: Partial<MfaConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
