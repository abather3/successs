"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedSMSService = void 0;
const database_1 = require("../config/database");
class EnhancedSMSService {
    /**
     * Send queue position update to customer
     */
    static async sendQueuePositionUpdate(customerId, phoneNumber, customerName, queuePosition, estimatedWaitMinutes) {
        const template = await this.getTemplate('queue_position');
        const message = this.replaceVariables(template.templateContent, {
            CustomerName: customerName,
            QueuePosition: queuePosition.toString(),
            EstimatedWait: estimatedWaitMinutes.toString()
        });
        const notification = {
            customerId,
            phoneNumber,
            message,
            notificationType: 'queue_position',
            status: 'pending',
            queuePosition,
            estimatedWaitMinutes
        };
        return await this.saveAndSendNotification(notification);
    }
    /**
     * Send ready to serve notification
     */
    static async sendReadyToServeNotification(customerId, phoneNumber, customerName, tokenNumber, counterName) {
        const template = await this.getTemplate('ready_to_serve');
        const message = this.replaceVariables(template.templateContent, {
            CustomerName: customerName,
            TokenNumber: tokenNumber,
            CounterName: counterName
        });
        const notification = {
            customerId,
            phoneNumber,
            message,
            notificationType: 'ready_to_serve',
            status: 'pending'
        };
        return await this.saveAndSendNotification(notification);
    }
    /**
     * Send delay notification
     */
    static async sendDelayNotification(customerId, phoneNumber, customerName, newEstimatedWait) {
        const template = await this.getTemplate('delay_notification');
        const message = this.replaceVariables(template.templateContent, {
            CustomerName: customerName,
            EstimatedWait: newEstimatedWait.toString()
        });
        const notification = {
            customerId,
            phoneNumber,
            message,
            notificationType: 'delay_notification',
            status: 'pending',
            estimatedWaitMinutes: newEstimatedWait
        };
        return await this.saveAndSendNotification(notification);
    }
    /**
     * Send customer ready notification (for pickup orders)
     */
    static async sendCustomerReadyNotification(customerId, phoneNumber, customerName, orderNumber) {
        const template = await this.getTemplate('customer_ready');
        const message = this.replaceVariables(template.templateContent, {
            CustomerName: customerName,
            OrderNumber: orderNumber || 'N/A'
        });
        const notification = {
            customerId,
            phoneNumber,
            message,
            notificationType: 'customer_ready',
            status: 'pending'
        };
        return await this.saveAndSendNotification(notification);
    }
    /**
     * Send pickup reminder notification
     */
    static async sendPickupReminderNotification(customerId, phoneNumber, customerName, orderNumber) {
        const template = await this.getTemplate('pickup_reminder');
        const message = this.replaceVariables(template.templateContent, {
            CustomerName: customerName,
            OrderNumber: orderNumber || 'N/A'
        });
        const notification = {
            customerId,
            phoneNumber,
            message,
            notificationType: 'pickup_reminder',
            status: 'pending'
        };
        return await this.saveAndSendNotification(notification);
    }
    /**
     * Send delivery ready notification
     */
    static async sendDeliveryReadyNotification(customerId, phoneNumber, customerName, orderNumber, estimatedDeliveryTime) {
        const template = await this.getTemplate('delivery_ready');
        const message = this.replaceVariables(template.templateContent, {
            CustomerName: customerName,
            OrderNumber: orderNumber || 'N/A',
            EstimatedDeliveryTime: estimatedDeliveryTime || 'Soon'
        });
        const notification = {
            customerId,
            phoneNumber,
            message,
            notificationType: 'delivery_ready',
            status: 'pending'
        };
        return await this.saveAndSendNotification(notification);
    }
    /**
     * Send bulk queue position updates to all waiting customers
     */
    static async sendBulkQueueUpdates(customers) {
        const template = await this.getTemplate('queue_position');
        const notifications = [];
        for (const customer of customers) {
            const message = this.replaceVariables(template.templateContent, {
                CustomerName: customer.customerName,
                QueuePosition: customer.queuePosition.toString(),
                EstimatedWait: customer.estimatedWait.toString()
            });
            const notification = {
                customerId: customer.customerId,
                phoneNumber: customer.phoneNumber,
                message,
                notificationType: 'queue_position',
                status: 'pending',
                queuePosition: customer.queuePosition,
                estimatedWaitMinutes: customer.estimatedWait
            };
            notifications.push(await this.saveAndSendNotification(notification));
        }
        return notifications;
    }
    /**
     * Save notification to database and attempt to send
     */
    static async saveAndSendNotification(notification) {
        // Save to database first
        const insertQuery = `
      INSERT INTO sms_notifications (
        customer_id, phone_number, message, notification_type,
        status, queue_position, estimated_wait_minutes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, created_at
    `;
        const result = await database_1.pool.query(insertQuery, [
            notification.customerId,
            notification.phoneNumber,
            notification.message,
            notification.notificationType,
            notification.status,
            notification.queuePosition,
            notification.estimatedWaitMinutes
        ]);
        notification.id = result.rows[0].id;
        // Attempt to send SMS
        try {
            await this.sendSMS(notification);
            await this.updateNotificationStatus(notification.id, 'sent');
            notification.status = 'sent';
            notification.sentAt = new Date();
        }
        catch (error) {
            console.error('Failed to send SMS:', error);
            await this.updateNotificationStatus(notification.id, 'failed', error instanceof Error ? error.message : 'Unknown error');
            notification.status = 'failed';
            notification.deliveryStatus = error instanceof Error ? error.message : 'Unknown error';
        }
        return notification;
    }
    /**
     * Send SMS using configured provider
     */
    static async sendSMS(notification) {
        // If SMS is not enabled, just log the SMS
        if (process.env.SMS_ENABLED !== 'true') {
            console.log(`\n🔔 ===== SMS NOTIFICATION (DISABLED) =====`);
            console.log(`📱 To: ${notification.phoneNumber}`);
            console.log(`💬 Message: ${notification.message}`);
            console.log(`🏷️  Type: ${notification.notificationType}`);
            console.log(`⏰ Time: ${new Date().toLocaleString()}`);
            console.log(`===============================\n`);
            return;
        }
        const provider = process.env.SMS_PROVIDER;
        switch (provider) {
            case 'twilio':
                await this.sendTwilioSMS(notification);
                break;
            case 'clicksend':
                await this.sendClicksendSMS(notification);
                break;
            case 'vonage':
                await this.sendVonageSMS(notification);
                break;
            case 'generic':
                await this.sendGenericSMS(notification);
                break;
            default:
                throw new Error('SMS provider not configured. Set SMS_PROVIDER in environment variables.');
        }
    }
    /**
     * Send SMS via Twilio
     */
    static async sendTwilioSMS(notification) {
        try {
            const twilio = require('twilio');
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            await client.messages.create({
                body: notification.message,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: notification.phoneNumber
            });
            console.log(`✅ Twilio SMS sent to ${notification.phoneNumber}`);
        }
        catch (error) {
            console.error('❌ Twilio SMS failed:', error);
            throw error;
        }
    }
    /**
     * Send SMS via Clicksend
     */
    static async sendClicksendSMS(notification) {
        try {
            console.log(`🔄 Sending SMS via Clicksend to ${notification.phoneNumber}`);
            console.log(`📧 Username: ${process.env.CLICKSEND_USERNAME}`);
            console.log(`🔑 API Key: ${process.env.CLICKSEND_API_KEY ? '***' + process.env.CLICKSEND_API_KEY.slice(-4) : 'NOT SET'}`);
            const response = await fetch('https://rest.clicksend.com/v3/sms/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + Buffer.from(`${process.env.CLICKSEND_USERNAME}:${process.env.CLICKSEND_API_KEY}`).toString('base64')
                },
                body: JSON.stringify({
                    messages: [{
                            body: notification.message,
                            to: notification.phoneNumber,
                            from: process.env.SMS_FROM || 'EscaShop'
                        }]
                })
            });
            const responseData = await response.json();
            console.log('📄 Clicksend Response:', responseData);
            if (!response.ok) {
                console.error('❌ Clicksend API Error Details:', {
                    status: response.status,
                    statusText: response.statusText,
                    data: responseData
                });
                throw new Error(`Clicksend API error: ${response.status} - ${JSON.stringify(responseData)}`);
            }
            console.log(`✅ Clicksend SMS sent to ${notification.phoneNumber}`);
        }
        catch (error) {
            console.error('❌ Clicksend SMS failed:', error);
            throw error;
        }
    }
    /**
     * Send SMS via Vonage (formerly Nexmo)
     */
    static async sendVonageSMS(notification) {
        try {
            const { Vonage } = require('@vonage/server-sdk');
            const vonage = new Vonage({
                apiKey: process.env.VONAGE_API_KEY,
                apiSecret: process.env.VONAGE_API_SECRET
            });
            const from = process.env.SMS_FROM || 'EscaShop';
            const to = notification.phoneNumber;
            const text = notification.message;
            console.log(`🔄 Sending SMS via Vonage to ${to}`);
            console.log(`🔑 API Key: ${process.env.VONAGE_API_KEY ? '***' + process.env.VONAGE_API_KEY.slice(-4) : 'NOT SET'}`);
            const response = await vonage.sms.send({
                to,
                from,
                text
            });
            console.log('📄 Vonage Response:', response);
            // Check if the message was sent successfully
            if (response.messages && response.messages.length > 0) {
                const message = response.messages[0];
                if (message.status === '0') {
                    console.log(`✅ Vonage SMS sent to ${to}`);
                }
                else {
                    console.error('❌ Vonage SMS Error:', {
                        status: message.status,
                        errorText: message['error-text']
                    });
                    throw new Error(`Vonage SMS failed: ${message.status} - ${message['error-text']}`);
                }
            }
            else {
                throw new Error('Vonage SMS failed: No response messages');
            }
        }
        catch (error) {
            console.error('❌ Vonage SMS failed:', error);
            throw error;
        }
    }
    /**
     * Send SMS via generic API
     */
    static async sendGenericSMS(notification) {
        try {
            const response = await fetch(process.env.SMS_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.SMS_API_KEY}`,
                    'X-API-Key': process.env.SMS_API_KEY || ''
                },
                body: JSON.stringify({
                    to: notification.phoneNumber,
                    message: notification.message,
                    from: process.env.SMS_FROM || 'EscaShop'
                })
            });
            if (!response.ok) {
                throw new Error(`Generic SMS API error: ${response.status}`);
            }
            console.log(`✅ Generic SMS sent to ${notification.phoneNumber}`);
        }
        catch (error) {
            console.error('❌ Generic SMS failed:', error);
            throw error;
        }
    }
    /**
     * Update notification status
     */
    static async updateNotificationStatus(notificationId, status, deliveryStatus) {
        const query = `
      UPDATE sms_notifications 
      SET status = $1::varchar, delivery_status = $2::text, 
          sent_at = CASE WHEN $1 = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END,
          delivered_at = CASE WHEN $1 = 'delivered' THEN CURRENT_TIMESTAMP ELSE delivered_at END
      WHERE id = $3
    `;
        await database_1.pool.query(query, [status, deliveryStatus || null, notificationId]);
    }
    /**
     * Get SMS template by name
     */
    static async getTemplate(templateName) {
        const query = `
      SELECT name as "templateName", template_content as "templateContent", 
             variables, is_active as "isActive"
      FROM sms_templates 
      WHERE name = $1 AND is_active = true
    `;
        const result = await database_1.pool.query(query, [templateName]);
        if (result.rows.length === 0) {
            throw new Error(`SMS template '${templateName}' not found`);
        }
        return result.rows[0];
    }
    /**
     * Replace variables in template with actual values
     */
    static replaceVariables(template, variables) {
        let message = template;
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `[${key}]`;
            message = message.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        }
        return message;
    }
    /**
     * Get all SMS templates
     */
    static async getTemplates() {
        const query = `
      SELECT id, name as "templateName", template_content as "templateContent",
             variables, is_active as "isActive"
      FROM sms_templates 
      ORDER BY name
    `;
        const result = await database_1.pool.query(query);
        return result.rows;
    }
    /**
     * Update SMS template
     */
    static async updateTemplate(templateName, templateContent) {
        const query = `
      UPDATE sms_templates 
      SET template_content = $1, updated_at = CURRENT_TIMESTAMP
      WHERE name = $2
    `;
        await database_1.pool.query(query, [templateContent, templateName]);
    }
    /**
     * Get SMS statistics
     */
    static async getSMSStats(dateRange) {
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const query = `
      SELECT 
        COUNT(*) as total_sent,
        COUNT(*) FILTER (WHERE status = 'delivered') as total_delivered,
        COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
        COUNT(*) FILTER (WHERE DATE(created_at) = $1) as today_sent,
        COUNT(*) FILTER (WHERE DATE(created_at) >= $2) as week_sent,
        COUNT(*) FILTER (WHERE DATE(created_at) >= $3) as month_sent
      FROM sms_notifications
      WHERE status IN ('sent', 'delivered', 'failed')
      ${dateRange ? 'AND DATE(created_at) BETWEEN $4 AND $5' : ''}
    `;
        const params = [today, weekAgo, monthAgo];
        if (dateRange) {
            params.push(dateRange.start, dateRange.end);
        }
        const result = await database_1.pool.query(query, params);
        const stats = result.rows[0];
        const deliveryRate = stats.total_sent > 0
            ? (stats.total_delivered / stats.total_sent) * 100
            : 0;
        return {
            totalSent: parseInt(stats.total_sent),
            totalDelivered: parseInt(stats.total_delivered),
            totalFailed: parseInt(stats.total_failed),
            deliveryRate: Math.round(deliveryRate * 100) / 100,
            todaySent: parseInt(stats.today_sent),
            weekSent: parseInt(stats.week_sent),
            monthSent: parseInt(stats.month_sent)
        };
    }
    /**
     * Get SMS notification history for a customer
     */
    static async getCustomerNotificationHistory(customerId) {
        const query = `
      SELECT 
        id, customer_id as "customerId", phone_number as "phoneNumber",
        message, notification_type as "notificationType", status,
        delivery_status as "deliveryStatus", queue_position as "queuePosition",
        estimated_wait_minutes as "estimatedWaitMinutes",
        sent_at as "sentAt", delivered_at as "deliveredAt", created_at
      FROM sms_notifications
      WHERE customer_id = $1
      ORDER BY created_at DESC
    `;
        const result = await database_1.pool.query(query, [customerId]);
        return result.rows;
    }
    /**
     * Get recent SMS notifications with pagination
     */
    static async getRecentNotifications(page = 1, limit = 50) {
        const offset = (page - 1) * limit;
        const countQuery = `SELECT COUNT(*) FROM sms_notifications`;
        const countResult = await database_1.pool.query(countQuery);
        const totalCount = parseInt(countResult.rows[0].count);
        const query = `
      SELECT 
        id, customer_id as "customerId", phone_number as "phoneNumber",
        message, notification_type as "notificationType", status,
        delivery_status as "deliveryStatus", queue_position as "queuePosition",
        estimated_wait_minutes as "estimatedWaitMinutes",
        sent_at as "sentAt", delivered_at as "deliveredAt", created_at
      FROM sms_notifications
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
        const result = await database_1.pool.query(query, [limit, offset]);
        return {
            notifications: result.rows,
            totalCount,
            totalPages: Math.ceil(totalCount / limit)
        };
    }
    /**
     * Retry failed SMS notifications
     */
    static async retryFailedNotifications(maxRetries = 5) {
        const query = `
      SELECT id, customer_id as "customerId", phone_number as "phoneNumber",
             message, notification_type as "notificationType"
      FROM sms_notifications
      WHERE status = 'failed' 
      AND (retry_count IS NULL OR retry_count < $1)
      ORDER BY created_at DESC
      LIMIT 10
    `;
        const result = await database_1.pool.query(query, [maxRetries]);
        let successCount = 0;
        for (const notification of result.rows) {
            try {
                await this.sendSMS(notification);
                await this.updateNotificationStatus(notification.id, 'sent');
                successCount++;
            }
            catch (error) {
                // Increment retry count
                await database_1.pool.query('UPDATE sms_notifications SET retry_count = COALESCE(retry_count, 0) + 1 WHERE id = $1', [notification.id]);
            }
        }
        return successCount;
    }
}
exports.EnhancedSMSService = EnhancedSMSService;
//# sourceMappingURL=EnhancedSMSService.js.map