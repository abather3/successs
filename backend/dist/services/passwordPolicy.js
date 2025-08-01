"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordPolicyService = void 0;
const database_1 = require("../config/database");
const config_1 = require("../config/config");
class PasswordPolicyService {
    static validateComplexity(password) {
        const errors = [];
        if (password.length < this.policy.minLength) {
            errors.push(`Password must be at least ${this.policy.minLength} characters long`);
        }
        if (this.policy.requireUppercase && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        if (this.policy.requireLowercase && !/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        if (this.policy.requireNumbers && !/[0-9]/.test(password)) {
            errors.push('Password must contain at least one number');
        }
        if (this.policy.requireSymbols && !/[^A-Za-z0-9]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }
        // Check complexity score
        const score = this.calculateComplexityScore(password);
        if (score < this.policy.complexityScore) {
            errors.push(`Password complexity score is ${score}, minimum required is ${this.policy.complexityScore}`);
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
    static calculateComplexityScore(password) {
        let score = 0;
        // Length bonus
        score += Math.min(password.length, 25);
        // Character variety bonus
        if (/[a-z]/.test(password))
            score += 1;
        if (/[A-Z]/.test(password))
            score += 1;
        if (/[0-9]/.test(password))
            score += 1;
        if (/[^A-Za-z0-9]/.test(password))
            score += 1;
        // Complexity patterns
        if (password.length >= 8)
            score += 1;
        if (password.length >= 12)
            score += 1;
        if (password.length >= 16)
            score += 1;
        // Penalty for common patterns
        if (/(.)\1{2,}/.test(password))
            score -= 1; // Repeated characters
        if (/123|abc|qwe|asd|zxc/i.test(password))
            score -= 2; // Common sequences
        return Math.max(0, score);
    }
    static async checkPasswordHistory(userId, newPasswordHash) {
        const query = `
      SELECT password_hash 
      FROM password_history 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
        const result = await database_1.pool.query(query, [userId, this.policy.preventReuse]);
        // In a real implementation, you would need to hash the new password with the same salt
        // as the stored passwords to compare them. For now, we'll check if the hash exists.
        return !result.rows.some(row => row.password_hash === newPasswordHash);
    }
    static async storePasswordHistory(userId, passwordHash) {
        // Store the password hash in history
        const insertQuery = `
      INSERT INTO password_history (user_id, password_hash, created_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
    `;
        await database_1.pool.query(insertQuery, [userId, passwordHash]);
        // Clean up old password history beyond the policy limit
        const cleanupQuery = `
      DELETE FROM password_history 
      WHERE user_id = $1 
      AND id NOT IN (
        SELECT id FROM password_history 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2
      )
    `;
        await database_1.pool.query(cleanupQuery, [userId, this.policy.preventReuse]);
    }
    static async checkPasswordAge(userId) {
        const query = `
      SELECT password_updated_at 
      FROM users 
      WHERE id = $1
    `;
        const result = await database_1.pool.query(query, [userId]);
        if (result.rows.length === 0) {
            return { expired: false, daysOld: 0 };
        }
        const passwordUpdatedAt = result.rows[0].password_updated_at;
        const now = new Date();
        const daysOld = Math.floor((now.getTime() - passwordUpdatedAt.getTime()) / (1000 * 60 * 60 * 24));
        return {
            expired: daysOld > this.policy.maxAge,
            daysOld
        };
    }
    static async updatePasswordTimestamp(userId) {
        const query = `
      UPDATE users 
      SET password_updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `;
        await database_1.pool.query(query, [userId]);
    }
    static getPolicy() {
        return { ...this.policy };
    }
    static updatePolicy(newPolicy) {
        this.policy = { ...this.policy, ...newPolicy };
    }
}
exports.PasswordPolicyService = PasswordPolicyService;
PasswordPolicyService.policy = {
    minLength: config_1.config.PASSWORD_MIN_LENGTH,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: true,
    preventReuse: 5, // Prevent reuse of last 5 passwords
    maxAge: 90, // 90 days
    complexityScore: 8
};
//# sourceMappingURL=passwordPolicy.js.map