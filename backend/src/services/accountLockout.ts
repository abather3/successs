import { pool } from '../config/database';

export interface LockoutConfig {
  maxAttempts: number;
  lockoutDuration: number; // in minutes
  progressiveBackoff: boolean;
  backoffMultiplier: number;
  resetTime: number; // in minutes
}

export class AccountLockoutService {
  private static config: LockoutConfig = {
    maxAttempts: 5,
    lockoutDuration: 30, // 30 minutes
    progressiveBackoff: true,
    backoffMultiplier: 2,
    resetTime: 60 // 1 hour
  };

  static async recordFailedAttempt(email: string, ipAddress: string): Promise<void> {
    const query = `
      INSERT INTO failed_login_attempts (email, ip_address, attempt_time)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
    `;
    
    await pool.query(query, [email, ipAddress]);
  }

  static async checkAccountLockout(email: string): Promise<{
    isLocked: boolean;
    remainingTime: number;
    attemptCount: number;
    nextAttemptAllowed: Date | null;
  }> {
    // Clean up old attempts first
    await this.cleanupOldAttempts(email);

    const query = `
      SELECT COUNT(*) as attempt_count, MAX(attempt_time) as last_attempt
      FROM failed_login_attempts 
      WHERE email = $1 
      AND attempt_time > CURRENT_TIMESTAMP - INTERVAL '${this.config.resetTime} minutes'
    `;
    
    const result = await pool.query(query, [email]);
    const attemptCount = parseInt(result.rows[0].attempt_count);
    const lastAttempt = result.rows[0].last_attempt;
    
    if (attemptCount >= this.config.maxAttempts) {
      const lockoutDuration = this.calculateLockoutDuration(attemptCount);
      const unlockTime = new Date(lastAttempt.getTime() + lockoutDuration * 60000);
      const now = new Date();
      
      if (now < unlockTime) {
        return {
          isLocked: true,
          remainingTime: Math.ceil((unlockTime.getTime() - now.getTime()) / 60000),
          attemptCount,
          nextAttemptAllowed: unlockTime
        };
      } else {
        // Lock period expired, clear failed attempts
        await this.clearFailedAttempts(email);
        return {
          isLocked: false,
          remainingTime: 0,
          attemptCount: 0,
          nextAttemptAllowed: null
        };
      }
    }
    
    return {
      isLocked: false,
      remainingTime: 0,
      attemptCount,
      nextAttemptAllowed: null
    };
  }

  static async checkIpLockout(ipAddress: string): Promise<{
    isLocked: boolean;
    remainingTime: number;
    attemptCount: number;
  }> {
    const query = `
      SELECT COUNT(*) as attempt_count, MAX(attempt_time) as last_attempt
      FROM failed_login_attempts 
      WHERE ip_address = $1 
      AND attempt_time > CURRENT_TIMESTAMP - INTERVAL '${this.config.resetTime} minutes'
    `;
    
    const result = await pool.query(query, [ipAddress]);
    const attemptCount = parseInt(result.rows[0].attempt_count);
    const lastAttempt = result.rows[0].last_attempt;
    
    // IP lockout threshold is higher than account lockout
    const ipMaxAttempts = this.config.maxAttempts * 3;
    
    if (attemptCount >= ipMaxAttempts && lastAttempt) {
      const lockoutDuration = this.config.lockoutDuration * 2; // Double duration for IP lockout
      const unlockTime = new Date(lastAttempt.getTime() + lockoutDuration * 60000);
      const now = new Date();
      
      if (now < unlockTime) {
        return {
          isLocked: true,
          remainingTime: Math.ceil((unlockTime.getTime() - now.getTime()) / 60000),
          attemptCount
        };
      }
    }
    
    return {
      isLocked: false,
      remainingTime: 0,
      attemptCount
    };
  }

  static async clearFailedAttempts(email: string): Promise<void> {
    const query = `
      DELETE FROM failed_login_attempts 
      WHERE email = $1
    `;
    
    await pool.query(query, [email]);
  }

  static async clearIpFailedAttempts(ipAddress: string): Promise<void> {
    const query = `
      DELETE FROM failed_login_attempts 
      WHERE ip_address = $1
    `;
    
    await pool.query(query, [ipAddress]);
  }

  private static calculateLockoutDuration(attemptCount: number): number {
    if (!this.config.progressiveBackoff) {
      return this.config.lockoutDuration;
    }
    
    const baseExponent = attemptCount - this.config.maxAttempts;
    const multiplier = Math.pow(this.config.backoffMultiplier, baseExponent);
    const duration = this.config.lockoutDuration * multiplier;
    
    // Cap at 24 hours
    return Math.min(duration, 24 * 60);
  }

  private static async cleanupOldAttempts(email: string): Promise<void> {
    const query = `
      DELETE FROM failed_login_attempts 
      WHERE email = $1 
      AND attempt_time < CURRENT_TIMESTAMP - INTERVAL '${this.config.resetTime} minutes'
    `;
    
    await pool.query(query, [email]);
  }

  static async getFailedAttempts(email: string): Promise<Array<{
    ip_address: string;
    attempt_time: Date;
    user_agent?: string;
  }>> {
    const query = `
      SELECT ip_address, attempt_time, user_agent
      FROM failed_login_attempts 
      WHERE email = $1 
      ORDER BY attempt_time DESC 
      LIMIT 10
    `;
    
    const result = await pool.query(query, [email]);
    return result.rows;
  }

  static async unlockAccount(email: string): Promise<void> {
    await this.clearFailedAttempts(email);
    
    // Log the unlock action
    const query = `
      INSERT INTO security_events (event_type, email, details, created_at)
      VALUES ('account_unlocked', $1, $2, CURRENT_TIMESTAMP)
    `;
    
    await pool.query(query, [email, JSON.stringify({ unlocked_by: 'admin' })]);
  }

  static getConfig(): LockoutConfig {
    return { ...this.config };
  }

  static updateConfig(newConfig: Partial<LockoutConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
