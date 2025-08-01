"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityService = void 0;
const database_1 = require("../config/database");
class ActivityService {
    static async log(activityData) {
        const { user_id, action, details, ip_address, user_agent } = activityData;
        // Handle non-IP strings by converting them to a valid IP address
        let sanitizedIpAddress = ip_address;
        if (ip_address && !this.isValidIP(ip_address)) {
            sanitizedIpAddress = '0.0.0.0'; // Default for non-IP values like 'system', 'scheduler'
        }
        const query = `
      INSERT INTO activity_logs (user_id, action, details, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
        const values = [user_id, action, JSON.stringify(details), sanitizedIpAddress, user_agent];
        const result = await database_1.pool.query(query, values);
        return result.rows[0];
    }
    /**
     * Check if a string is a valid IP address (IPv4 or IPv6)
     */
    static isValidIP(ip) {
        // IPv4 regex pattern
        const ipv4Pattern = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
        // IPv6 regex pattern (simplified)
        const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
    }
    static async getByUserId(userId, limit = 50, offset = 0) {
        const query = `
      SELECT al.*, u.full_name as user_full_name
      FROM activity_logs al
      JOIN users u ON al.user_id = u.id
      WHERE al.user_id = $1
      ORDER BY al.created_at DESC
      LIMIT $2 OFFSET $3
    `;
        const result = await database_1.pool.query(query, [userId, limit, offset]);
        return result.rows;
    }
    static async getAll(limit = 50, offset = 0, filters = {}) {
        let query = `
      SELECT al.*, u.full_name as user_full_name
      FROM activity_logs al
      JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
        const values = [];
        let paramCount = 1;
        if (filters.action) {
            query += ` AND al.action ILIKE $${paramCount}`;
            values.push(`%${filters.action}%`);
            paramCount++;
        }
        if (filters.startDate) {
            query += ` AND al.created_at >= $${paramCount}`;
            values.push(filters.startDate);
            paramCount++;
        }
        if (filters.endDate) {
            query += ` AND al.created_at <= $${paramCount}`;
            values.push(filters.endDate);
            paramCount++;
        }
        query += ` ORDER BY al.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        values.push(limit, offset);
        const result = await database_1.pool.query(query, values);
        return result.rows;
    }
    static async deleteOldLogs(retentionDays = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        const query = `
      DELETE FROM activity_logs 
      WHERE created_at < $1
    `;
        const result = await database_1.pool.query(query, [cutoffDate]);
        return result.rowCount || 0;
    }
}
exports.ActivityService = ActivityService;
//# sourceMappingURL=activity.js.map