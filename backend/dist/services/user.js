"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const argon2_1 = __importDefault(require("argon2"));
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../config/database");
const config_1 = require("../config/config");
const types_1 = require("../types");
const email_1 = require("./email");
class UserService {
    static async create(userData) {
        const { email, fullName, role } = userData;
        // Check if user already exists
        const existingUser = await this.findByEmail(email);
        if (existingUser) {
            throw new Error('User with this email already exists');
        }
        // Generate temporary password
        const tempPassword = await this.generateTemporaryPassword();
        const hashedPassword = await argon2_1.default.hash(tempPassword, {
            type: argon2_1.default.argon2id,
            memoryCost: 2 ** 16, // 64 MiB
            timeCost: 3,
            parallelism: 1
        });
        const query = `
      INSERT INTO users (email, full_name, password_hash, role, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, full_name, role, status, created_at, updated_at
    `;
        const values = [email, fullName, hashedPassword, role, types_1.UserStatus.ACTIVE];
        const result = await database_1.pool.query(query, values);
        // TODO: Send email with temporary password
        console.log(`Temporary password for ${email}: ${tempPassword}`);
        return result.rows[0];
    }
    static async findById(id) {
        const query = `
      SELECT id, email, full_name, role, status, created_at, updated_at
      FROM users 
      WHERE id = $1
    `;
        const result = await database_1.pool.query(query, [id]);
        return result.rows[0] || null;
    }
    static async findByEmail(email) {
        const query = `
      SELECT id, email, full_name, role, status, created_at, updated_at
      FROM users 
      WHERE email = $1
    `;
        const result = await database_1.pool.query(query, [email]);
        return result.rows[0] || null;
    }
    static async findByEmailWithPassword(email) {
        const query = `
      SELECT id, email, full_name, role, status, password_hash, created_at, updated_at
      FROM users 
      WHERE email = $1
    `;
        const result = await database_1.pool.query(query, [email]);
        return result.rows[0] || null;
    }
    static async updatePassword(id, newPassword) {
        const hashedPassword = await argon2_1.default.hash(newPassword, {
            type: argon2_1.default.argon2id,
            memoryCost: 2 ** 16, // 64 MiB
            timeCost: 3,
            parallelism: 1
        });
        const query = `
      UPDATE users 
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
        await database_1.pool.query(query, [hashedPassword, id]);
    }
    static async update(id, updates) {
        const setClause = [];
        const values = [];
        let paramCount = 1;
        Object.entries(updates).forEach(([key, value]) => {
            if (value !== undefined) {
                setClause.push(`${key} = $${paramCount}`);
                values.push(value);
                paramCount++;
            }
        });
        if (setClause.length === 0) {
            throw new Error('No valid updates provided');
        }
        values.push(id);
        const query = `
      UPDATE users 
      SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING id, email, full_name, role, status, created_at, updated_at
    `;
        const result = await database_1.pool.query(query, values);
        if (result.rows.length === 0) {
            throw new Error('User not found');
        }
        return result.rows[0];
    }
    static async list(filters = {}) {
        let query = `
      SELECT id, email, full_name, role, status, created_at, updated_at
      FROM users 
      WHERE 1=1
    `;
        const values = [];
        let paramCount = 1;
        if (filters.role) {
            query += ` AND role = $${paramCount}`;
            values.push(filters.role);
            paramCount++;
        }
        if (filters.status) {
            query += ` AND status = $${paramCount}`;
            values.push(filters.status);
            paramCount++;
        }
        if (filters.excludeRole) {
            query += ` AND role != $${paramCount}`;
            values.push(filters.excludeRole);
            paramCount++;
        }
        query += ` ORDER BY created_at DESC`;
        const result = await database_1.pool.query(query, values);
        return result.rows;
    }
    static async validatePassword(email, password) {
        const userWithPassword = await this.findByEmailWithPassword(email);
        if (!userWithPassword) {
            return null;
        }
        const isValidPassword = await argon2_1.default.verify(userWithPassword.password_hash, password);
        if (!isValidPassword) {
            return null;
        }
        // Return user without password hash
        const { password_hash, ...user } = userWithPassword;
        return user;
    }
    static async getUserDependencies(id) {
        const salesTransactionsQuery = `
      SELECT COUNT(*) as count FROM transactions 
      WHERE sales_agent_id = $1
    `;
        const salesResult = await database_1.pool.query(salesTransactionsQuery, [id]);
        const salesTransactionCount = parseInt(salesResult.rows[0].count, 10);
        const cashierTransactionsQuery = `
      SELECT COUNT(*) as count FROM transactions 
      WHERE cashier_id = $1
    `;
        const cashierResult = await database_1.pool.query(cashierTransactionsQuery, [id]);
        const cashierTransactionCount = parseInt(cashierResult.rows[0].count, 10);
        const canDelete = salesTransactionCount === 0;
        const warnings = [];
        if (salesTransactionCount > 0) {
            warnings.push(`User has ${salesTransactionCount} transactions as sales agent. Cannot delete as it would remove transaction records.`);
        }
        if (cashierTransactionCount > 0) {
            warnings.push(`User has ${cashierTransactionCount} transactions as cashier. These will lose cashier reference.`);
        }
        warnings.push('User\'s activity logs will be permanently deleted.');
        return {
            salesTransactions: salesTransactionCount,
            cashierTransactions: cashierTransactionCount,
            canDelete,
            warnings
        };
    }
    static async delete(id) {
        // First, check if the user exists
        const user = await this.findById(id);
        if (!user) {
            throw new Error('User not found');
        }
        // Check if user has transactions as sales agent (would cascade delete transactions)
        const salesTransactionsQuery = `
      SELECT COUNT(*) as count FROM transactions 
      WHERE sales_agent_id = $1
    `;
        const salesResult = await database_1.pool.query(salesTransactionsQuery, [id]);
        const salesTransactionCount = parseInt(salesResult.rows[0].count, 10);
        if (salesTransactionCount > 0) {
            throw new Error(`Cannot delete user: User has ${salesTransactionCount} transactions as sales agent. Deletion would remove transaction records.`);
        }
        // Check if user has transactions as cashier (will set cashier_id to NULL, which is safe)
        const cashierTransactionsQuery = `
      SELECT COUNT(*) as count FROM transactions 
      WHERE cashier_id = $1
    `;
        const cashierResult = await database_1.pool.query(cashierTransactionsQuery, [id]);
        const cashierTransactionCount = parseInt(cashierResult.rows[0].count, 10);
        // Proceed with deletion
        // Note: activity_logs will be cascade deleted (acceptable for audit purposes)
        // cashier_id in transactions will be set to NULL (safe)
        const deleteQuery = `DELETE FROM users WHERE id = $1`;
        const result = await database_1.pool.query(deleteQuery, [id]);
        if (result.rowCount === 0) {
            throw new Error('User not found');
        }
        console.log(`User deleted: ${user.email} (ID: ${id}). Cashier transactions affected: ${cashierTransactionCount}`);
    }
    static async generateTemporaryPassword() {
        // Generate a random 12-character password
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }
    static async triggerPasswordReset(id) {
        const user = await this.findById(id);
        if (!user) {
            throw new Error('User not found');
        }
        // Generate a secure reset token
        const resetToken = crypto_1.default.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
        // Store the reset token in the database
        const query = `
      UPDATE users 
      SET reset_token = $1, reset_token_expiry = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `;
        await database_1.pool.query(query, [resetToken, resetTokenExpiry, id]);
        // Send password reset email
        await email_1.EmailService.sendPasswordResetEmail(user.email, resetToken, user.full_name);
        return { resetToken };
    }
    static async resetPasswordWithToken(token, newPassword) {
        if (newPassword.length < config_1.config.PASSWORD_MIN_LENGTH) {
            throw new Error(`Password must be at least ${config_1.config.PASSWORD_MIN_LENGTH} characters long`);
        }
        // Find user by reset token and check if it's still valid
        const query = `
      SELECT id, full_name, email, reset_token_expiry
      FROM users 
      WHERE reset_token = $1 AND reset_token_expiry > CURRENT_TIMESTAMP
    `;
        const result = await database_1.pool.query(query, [token]);
        if (result.rows.length === 0) {
            throw new Error('Invalid or expired reset token');
        }
        const user = result.rows[0];
        const hashedPassword = await argon2_1.default.hash(newPassword, {
            type: argon2_1.default.argon2id,
            memoryCost: 2 ** 16, // 64 MiB
            timeCost: 3,
            parallelism: 1
        });
        // Update password and clear reset token
        const updateQuery = `
      UPDATE users 
      SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
        await database_1.pool.query(updateQuery, [hashedPassword, user.id]);
        return true;
    }
    static async requestPasswordReset(email) {
        const user = await this.findByEmail(email);
        if (!user) {
            // Don't reveal whether email exists for security
            return true;
        }
        await this.triggerPasswordReset(user.id);
        return true;
    }
}
exports.UserService = UserService;
//# sourceMappingURL=user.js.map