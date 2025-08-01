"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const database_1 = require("../config/database");
const config_1 = require("../config/config");
const types_1 = require("../types");
class NotificationService {
    static async sendSMS(phoneNumber, message, customerId) {
        try {
            // Simulate SMS sending - replace with actual SMS service
            const response = await this.sendSMSViaTelco(phoneNumber, message);
            const notificationLog = await this.logNotification({
                customer_id: customerId,
                message,
                status: response.success ? types_1.NotificationStatus.SENT : types_1.NotificationStatus.FAILED,
                delivery_status: response.status
            });
            return notificationLog;
        }
        catch (error) {
            console.error('SMS sending failed:', error);
            const notificationLog = await this.logNotification({
                customer_id: customerId,
                message,
                status: types_1.NotificationStatus.FAILED,
                delivery_status: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    static async sendCustomerReadyNotification(customerId, customerName, phoneNumber) {
        const template = await this.getSMSTemplate('customer_ready');
        if (!template) {
            throw new Error('SMS template not found');
        }
        const message = template.template
            .replace('{{customer_name}}', customerName)
            .replace('{{shop_name}}', 'EscaShop');
        await this.sendSMS(phoneNumber, message, customerId);
    }
    static async sendDelayNotification(customerId, customerName, phoneNumber, estimatedTime) {
        const template = await this.getSMSTemplate('delay_notification');
        if (!template) {
            throw new Error('SMS template not found');
        }
        const message = template.template
            .replace('{{customer_name}}', customerName)
            .replace('{{estimated_time}}', estimatedTime.toString())
            .replace('{{shop_name}}', 'EscaShop');
        await this.sendSMS(phoneNumber, message, customerId);
    }
    static async sendPickupReminder(customerId, customerName, phoneNumber) {
        const template = await this.getSMSTemplate('pickup_reminder');
        if (!template) {
            throw new Error('SMS template not found');
        }
        const message = template.template
            .replace('{{customer_name}}', customerName)
            .replace('{{shop_name}}', 'EscaShop');
        await this.sendSMS(phoneNumber, message, customerId);
    }
    static async sendSMSViaTelco(phoneNumber, message) {
        // Placeholder for actual SMS service integration
        // This would typically integrate with services like Twilio, Semaphore, etc.
        if (!config_1.config.SMS_API_KEY || !config_1.config.SMS_API_URL) {
            console.warn('SMS service not configured');
            return { success: false, status: 'SMS service not configured' };
        }
        try {
            // Example integration - replace with actual SMS service
            const response = await fetch(config_1.config.SMS_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config_1.config.SMS_API_KEY}`
                },
                body: JSON.stringify({
                    to: phoneNumber,
                    message: message,
                    from: config_1.config.SMS_FROM
                })
            });
            if (response.ok) {
                return { success: true, status: 'sent' };
            }
            else {
                const errorData = await response.text();
                return { success: false, status: `HTTP ${response.status}: ${errorData}` };
            }
        }
        catch (error) {
            console.error('SMS API error:', error);
            return { success: false, status: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
    static async logNotification(data) {
        const query = `
      INSERT INTO notification_logs (customer_id, message, status, delivery_status, sent_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      RETURNING *
    `;
        const values = [
            data.customer_id || null,
            data.message,
            data.status,
            data.delivery_status || null
        ];
        const result = await database_1.pool.query(query, values);
        return result.rows[0];
    }
    static async getSMSTemplate(name) {
        const query = `
      SELECT * FROM sms_templates
      WHERE name = $1 AND is_active = true
    `;
        const result = await database_1.pool.query(query, [name]);
        if (result.rows.length === 0) {
            return null;
        }
        const row = result.rows[0];
        return {
            ...row,
            variables: JSON.parse(row.variables)
        };
    }
    static async createSMSTemplate(templateData) {
        const { name, template, variables } = templateData;
        const query = `
      INSERT INTO sms_templates (name, template, variables, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING *
    `;
        const values = [name, template, JSON.stringify(variables)];
        const result = await database_1.pool.query(query, values);
        const row = result.rows[0];
        return {
            ...row,
            variables: JSON.parse(row.variables)
        };
    }
    static async updateSMSTemplate(id, updates) {
        const setClause = [];
        const values = [];
        let paramCount = 1;
        Object.entries(updates).forEach(([key, value]) => {
            if (value !== undefined) {
                if (key === 'variables') {
                    setClause.push(`${key} = $${paramCount}`);
                    values.push(JSON.stringify(value));
                }
                else {
                    setClause.push(`${key} = $${paramCount}`);
                    values.push(value);
                }
                paramCount++;
            }
        });
        if (setClause.length === 0) {
            throw new Error('No valid updates provided');
        }
        values.push(id);
        const query = `
      UPDATE sms_templates 
      SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `;
        const result = await database_1.pool.query(query, values);
        if (result.rows.length === 0) {
            throw new Error('SMS template not found');
        }
        const row = result.rows[0];
        return {
            ...row,
            variables: JSON.parse(row.variables)
        };
    }
    static async listSMSTemplates() {
        const query = `
      SELECT * FROM sms_templates
      ORDER BY name
    `;
        const result = await database_1.pool.query(query);
        return result.rows.map((row) => ({
            ...row,
            variables: JSON.parse(row.variables)
        }));
    }
    static async getNotificationLogs(filters = {}, limit = 50, offset = 0) {
        let query = `
      SELECT nl.*, c.name as customer_name
      FROM notification_logs nl
      LEFT JOIN customers c ON nl.customer_id = c.id
      WHERE 1=1
    `;
        let countQuery = `
      SELECT COUNT(*) as total
      FROM notification_logs nl
      WHERE 1=1
    `;
        const values = [];
        let paramCount = 1;
        if (filters.customerId) {
            const customerCondition = ` AND nl.customer_id = $${paramCount}`;
            query += customerCondition;
            countQuery += customerCondition;
            values.push(filters.customerId);
            paramCount++;
        }
        if (filters.status) {
            const statusCondition = ` AND nl.status = $${paramCount}`;
            query += statusCondition;
            countQuery += statusCondition;
            values.push(filters.status);
            paramCount++;
        }
        if (filters.startDate) {
            const startDateCondition = ` AND nl.sent_at >= $${paramCount}`;
            query += startDateCondition;
            countQuery += startDateCondition;
            values.push(filters.startDate);
            paramCount++;
        }
        if (filters.endDate) {
            const endDateCondition = ` AND nl.sent_at <= $${paramCount}`;
            query += endDateCondition;
            countQuery += endDateCondition;
            values.push(filters.endDate);
            paramCount++;
        }
        query += ` ORDER BY nl.sent_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        values.push(limit, offset);
        const [logsResult, countResult] = await Promise.all([
            database_1.pool.query(query, values),
            database_1.pool.query(countQuery, values.slice(0, paramCount - 1))
        ]);
        return {
            logs: logsResult.rows,
            total: parseInt(countResult.rows[0].total)
        };
    }
    static async initializeDefaultTemplates() {
        const defaultTemplates = [
            {
                name: 'customer_ready',
                template: 'Hi {{customer_name}}, your eyeglasses are ready for pickup at {{shop_name}}. Thank you!',
                variables: ['customer_name', 'shop_name']
            },
            {
                name: 'delay_notification',
                template: 'Hi {{customer_name}}, there will be a slight delay in your order. New estimated time: {{estimated_time}} minutes. We apologize for the inconvenience. - {{shop_name}}',
                variables: ['customer_name', 'estimated_time', 'shop_name']
            },
            {
                name: 'pickup_reminder',
                template: 'Hi {{customer_name}}, friendly reminder that your eyeglasses are ready for pickup at {{shop_name}}. Please visit us during business hours.',
                variables: ['customer_name', 'shop_name']
            },
            {
                name: 'appointment_confirmation',
                template: 'Hi {{customer_name}}, your appointment at {{shop_name}} is confirmed for {{appointment_date}} at {{appointment_time}}.',
                variables: ['customer_name', 'shop_name', 'appointment_date', 'appointment_time']
            },
            {
                name: 'delivery_ready',
                template: 'Hi {{customer_name}}, your eyeglasses order is now ready for delivery via {{delivery_method}}. Our delivery partner will contact you soon. - {{shop_name}}',
                variables: ['customer_name', 'delivery_method', 'shop_name']
            }
        ];
        for (const template of defaultTemplates) {
            try {
                const existing = await this.getSMSTemplate(template.name);
                if (!existing) {
                    await this.createSMSTemplate(template);
                    console.log(`Created default SMS template: ${template.name}`);
                }
            }
            catch (error) {
                console.error(`Failed to create SMS template ${template.name}:`, error);
            }
        }
    }
}
exports.NotificationService = NotificationService;
//# sourceMappingURL=notification.js.map