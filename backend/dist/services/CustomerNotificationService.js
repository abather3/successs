"use strict";
// ISOLATED CUSTOMER NOTIFICATION SERVICE
// This service is completely separate from queue management and SMS notifications
// Uses different database tables, WebSocket channels, and event types
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerNotificationService = void 0;
const database_1 = require("../config/database");
const uuid_1 = require("uuid");
class CustomerNotificationService {
    /**
     * Create a new customer registration notification
     * ISOLATED: Does not interfere with queue management
     */
    static async createCustomerRegistrationNotification(data) {
        const client = await database_1.pool.connect();
        try {
            await client.query('BEGIN');
            const notificationId = (0, uuid_1.v4)();
            const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
            // Determine priority type for display
            const priorityType = data.customer.priority_flags.senior_citizen ? 'Senior Citizen' :
                data.customer.priority_flags.pregnant ? 'Pregnant' :
                    data.customer.priority_flags.pwd ? 'PWD' :
                        'Regular Customer';
            const title = '👥 New Customer Registration';
            const message = `${data.customer.name} (${priorityType}) has been registered by ${data.created_by.name}. OR: ${data.customer.or_number}`;
            // Insert notification record
            const notificationQuery = `
        INSERT INTO customer_notifications (
          notification_id, type, title, message, customer_data,
          created_by_id, created_by_name, created_by_role,
          target_role, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
            const notificationResult = await client.query(notificationQuery, [
                notificationId,
                'customer_registration',
                title,
                message,
                JSON.stringify({
                    id: data.customer.id,
                    name: data.customer.name,
                    or_number: data.customer.or_number,
                    token_number: data.customer.token_number,
                    contact_number: data.customer.contact_number,
                    priority_type: priorityType,
                    priority_flags: data.customer.priority_flags,
                    payment_amount: data.customer.payment_info?.amount || 0,
                    payment_mode: data.customer.payment_info?.mode
                }),
                data.created_by.id,
                data.created_by.name,
                data.created_by.role,
                'cashier',
                expiresAt
            ]);
            // Insert notification actions
            const actions = [
                { action_type: 'view_customer', label: 'View Details', is_primary: false },
                { action_type: 'start_transaction', label: 'Process Transaction', is_primary: true }
            ];
            for (const action of actions) {
                await client.query(`
          INSERT INTO customer_notification_actions (notification_id, action_type, label, is_primary)
          VALUES ($1, $2, $3, $4)
        `, [notificationId, action.action_type, action.label, action.is_primary]);
            }
            await client.query('COMMIT');
            const notification = {
                ...notificationResult.rows[0],
                actions
            };
            console.log(`[CUSTOMER_NOTIFICATION] Created notification ${notificationId} for customer ${data.customer.name}`);
            // REAL-TIME ANALYTICS: Trigger stats update after notification creation
            this.triggerStatsUpdate(data.created_by.role || 'cashier');
            return notification;
        }
        catch (error) {
            await client.query('ROLLBACK');
            console.error('[CUSTOMER_NOTIFICATION] Error creating notification:', error);
            throw error;
        }
        finally {
            client.release();
        }
    }
    /**
     * Get active notifications for a specific role
     * ISOLATED: Only returns customer registration notifications
     */
    static async getActiveNotifications(targetRole, userId) {
        const query = `
      SELECT 
        cn.*,
        COALESCE(
          json_agg(
            json_build_object(
              'action_type', cna.action_type,
              'label', cna.label,
              'is_primary', cna.is_primary
            ) ORDER BY cna.is_primary DESC, cna.id
          ) FILTER (WHERE cna.id IS NOT NULL), 
          '[]'::json
        ) as actions
      FROM customer_notifications cn
      LEFT JOIN customer_notification_actions cna ON cn.notification_id = cna.notification_id
      WHERE cn.target_role = $1
        AND cn.expires_at > NOW()
        AND cn.is_read = FALSE
        ${userId ? 'AND (cn.target_user_id IS NULL OR cn.target_user_id = $2)' : ''}
      GROUP BY cn.id
      ORDER BY cn.created_at DESC
      LIMIT 50
    `;
        const params = userId ? [targetRole, userId] : [targetRole];
        const result = await database_1.pool.query(query, params);
        return result.rows;
    }
    /**
     * Mark notification as read
     * ISOLATED: Only affects customer notifications
     */
    static async markAsRead(notificationId, userId) {
        const query = `
      UPDATE customer_notifications 
      SET is_read = TRUE, read_at = CURRENT_TIMESTAMP, read_by_user_id = $2
      WHERE notification_id = $1 AND is_read = FALSE
    `;
        const result = await database_1.pool.query(query, [notificationId, userId]);
        if (result.rowCount && result.rowCount > 0) {
            console.log(`[CUSTOMER_NOTIFICATION] Marked notification ${notificationId} as read by user ${userId}`);
            // REAL-TIME ANALYTICS: Trigger stats update after marking as read
            this.triggerStatsUpdate('cashier');
        }
    }
    /**
     * Get notification analytics including response times
     * ISOLATED: Only customer notification analytics
     */
    static async getNotificationAnalytics(targetRole = 'cashier') {
        const query = `
      SELECT 
        COUNT(*) as total_notifications,
        COUNT(*) FILTER (WHERE expires_at > NOW()) as total_active,
        COUNT(*) FILTER (WHERE is_read = FALSE AND expires_at > NOW()) as total_unread,
        COUNT(*) FILTER (WHERE is_read = TRUE) as total_read,
        COUNT(*) FILTER (WHERE expires_at < NOW() + INTERVAL '1 hour' AND is_read = FALSE AND expires_at > NOW()) as expires_soon,
        COALESCE(AVG(
          EXTRACT(EPOCH FROM (read_at - created_at)) / 60
        ) FILTER (WHERE read_at IS NOT NULL), 0) as avg_response_time_minutes,
        COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE) as created_today,
        COUNT(*) FILTER (WHERE read_at::date = CURRENT_DATE) as read_today
      FROM customer_notifications
      WHERE target_role = $1
    `;
        const result = await database_1.pool.query(query, [targetRole]);
        return result.rows[0];
    }
    /**
     * Get notification statistics (legacy method for backward compatibility)
     * ISOLATED: Only customer notification stats
     */
    static async getNotificationStats(targetRole = 'cashier') {
        const query = `
      SELECT 
        COUNT(*) as total_active,
        COUNT(*) FILTER (WHERE is_read = FALSE) as total_unread,
        COUNT(*) FILTER (WHERE expires_at < NOW() + INTERVAL '1 hour' AND is_read = FALSE) as expires_soon
      FROM customer_notifications
      WHERE target_role = $1 AND expires_at > NOW()
    `;
        const result = await database_1.pool.query(query, [targetRole]);
        return result.rows[0];
    }
    /**
     * Get notification history with pagination and filtering
     * ISOLATED: Only customer notifications with support for search and filtering
     */
    static async getNotificationHistory(filters) {
        const perPage = 20;
        const offset = (filters.page - 1) * perPage;
        let whereConditions = ['1 = 1'];
        let params = [];
        let paramIndex = 1;
        // Search filter (customer name, OR number, or message)
        if (filters.search.trim()) {
            whereConditions.push(`(
        cn.message ILIKE $${paramIndex} OR 
        cn.customer_data->>'name' ILIKE $${paramIndex} OR
        cn.customer_data->>'or_number' ILIKE $${paramIndex}
      )`);
            params.push(`%${filters.search.trim()}%`);
            paramIndex++;
        }
        // Date range filters
        if (filters.startDate) {
            whereConditions.push(`cn.created_at >= $${paramIndex}`);
            params.push(new Date(filters.startDate));
            paramIndex++;
        }
        if (filters.endDate) {
            whereConditions.push(`cn.created_at <= $${paramIndex}`);
            params.push(new Date(filters.endDate + ' 23:59:59'));
            paramIndex++;
        }
        // Priority type filter
        if (filters.priority_type) {
            whereConditions.push(`cn.customer_data->>'priority_type' = $${paramIndex}`);
            params.push(filters.priority_type);
            paramIndex++;
        }
        // Action filter (check if action exists in notification actions)
        if (filters.action) {
            whereConditions.push(`EXISTS (
        SELECT 1 FROM customer_notification_actions cna2 
        WHERE cna2.notification_id = cn.notification_id 
        AND cna2.action_type = $${paramIndex}
      )`);
            params.push(filters.action);
            paramIndex++;
        }
        const whereClause = whereConditions.join(' AND ');
        // Count total records
        const countQuery = `
      SELECT COUNT(*) as total
      FROM customer_notifications cn
      WHERE ${whereClause}
    `;
        const countResult = await database_1.pool.query(countQuery, params);
        const totalRecords = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(totalRecords / perPage);
        // Get paginated notifications with actions and transaction links
        const query = `
      SELECT 
        cn.*,
        COALESCE(
          json_agg(
            json_build_object(
              'action_type', cna.action_type,
              'label', cna.label,
              'is_primary', cna.is_primary
            ) ORDER BY cna.is_primary DESC, cna.id
          ) FILTER (WHERE cna.id IS NOT NULL), 
          '[]'::json
        ) as actions,
        -- Check for linked transaction based on customer OR number
        t.id as transaction_id,
        t.amount as transaction_amount,
        t.payment_status as transaction_status
      FROM customer_notifications cn
      LEFT JOIN customer_notification_actions cna ON cn.notification_id = cna.notification_id
      LEFT JOIN transactions t ON t.or_number = cn.customer_data->>'or_number'
      WHERE ${whereClause}
      GROUP BY cn.id, t.id, t.amount, t.payment_status
      ORDER BY cn.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
        params.push(perPage, offset);
        const result = await database_1.pool.query(query, params);
        return {
            notifications: result.rows,
            currentPage: filters.page,
            totalPages,
            totalRecords,
            perPage
        };
    }
    /**
     * Clean up expired notifications (manual cleanup)
     * ISOLATED: Only affects customer notifications
     */
    static async cleanupExpiredNotifications() {
        const query = `
      DELETE FROM customer_notifications 
      WHERE expires_at < NOW() - INTERVAL '1 day'
      RETURNING id
    `;
        const result = await database_1.pool.query(query);
        const deletedCount = result.rowCount || 0;
        if (deletedCount > 0) {
            console.log(`[CUSTOMER_NOTIFICATION] Cleaned up ${deletedCount} expired notifications`);
        }
        return deletedCount;
    }
    /**
     * Get notification by ID
     * ISOLATED: Only customer notifications
     */
    static async getNotificationById(notificationId) {
        const query = `
      SELECT 
        cn.*,
        COALESCE(
          json_agg(
            json_build_object(
              'action_type', cna.action_type,
              'label', cna.label,
              'is_primary', cna.is_primary
            ) ORDER BY cna.is_primary DESC, cna.id
          ) FILTER (WHERE cna.id IS NOT NULL), 
          '[]'::json
        ) as actions
      FROM customer_notifications cn
      LEFT JOIN customer_notification_actions cna ON cn.notification_id = cna.notification_id
      WHERE cn.notification_id = $1
      GROUP BY cn.id
    `;
        const result = await database_1.pool.query(query, [notificationId]);
        return result.rows[0] || null;
    }
    /**
     * REAL-TIME ANALYTICS: Trigger stats update via WebSocket
     * This method emits updated notification statistics to all connected clients
     */
    static triggerStatsUpdate(targetRole = 'cashier') {
        // Use setTimeout to avoid blocking the main operation
        setTimeout(async () => {
            try {
                // Import WebSocketService to avoid circular dependency
                const { WebSocketService } = await Promise.resolve().then(() => __importStar(require('./websocket')));
                // Emit notification stats update for the target role
                await WebSocketService.emitNotificationStatsUpdate(targetRole);
                // Also emit for all roles if this is a significant change
                if (targetRole === 'cashier') {
                    // Cashier notifications are the primary use case, so update all relevant roles
                    await WebSocketService.emitNotificationStatsUpdate('admin');
                }
            }
            catch (error) {
                console.error(`[REAL_TIME_ANALYTICS] Error triggering stats update for role ${targetRole}:`, error);
            }
        }, 0); // Execute on next tick to avoid blocking
    }
    /**
     * REAL-TIME ANALYTICS: Manual trigger for stats update (public method)
     * Can be called externally to force a stats update
     */
    static triggerManualStatsUpdate(targetRole = 'cashier') {
        this.triggerStatsUpdate(targetRole);
    }
}
exports.CustomerNotificationService = CustomerNotificationService;
//# sourceMappingURL=CustomerNotificationService.js.map