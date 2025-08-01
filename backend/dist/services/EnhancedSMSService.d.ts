export interface SMSNotification {
    id?: number;
    customerId: number;
    phoneNumber: string;
    message: string;
    notificationType: 'queue_position' | 'ready_to_serve' | 'delay_notification' | 'customer_ready' | 'pickup_reminder' | 'delivery_ready';
    status: 'pending' | 'sent' | 'delivered' | 'failed';
    deliveryStatus?: string;
    queuePosition?: number;
    estimatedWaitMinutes?: number;
    sentAt?: Date;
    deliveredAt?: Date;
}
export interface SMSTemplate {
    id?: number;
    templateName: string;
    templateContent: string;
    variables: string[];
    isActive: boolean;
}
export interface SMSStats {
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
    deliveryRate: number;
    todaySent: number;
    weekSent: number;
    monthSent: number;
}
export declare class EnhancedSMSService {
    /**
     * Send queue position update to customer
     */
    static sendQueuePositionUpdate(customerId: number, phoneNumber: string, customerName: string, queuePosition: number, estimatedWaitMinutes: number): Promise<SMSNotification>;
    /**
     * Send ready to serve notification
     */
    static sendReadyToServeNotification(customerId: number, phoneNumber: string, customerName: string, tokenNumber: string, counterName: string): Promise<SMSNotification>;
    /**
     * Send delay notification
     */
    static sendDelayNotification(customerId: number, phoneNumber: string, customerName: string, newEstimatedWait: number): Promise<SMSNotification>;
    /**
     * Send customer ready notification (for pickup orders)
     */
    static sendCustomerReadyNotification(customerId: number, phoneNumber: string, customerName: string, orderNumber?: string): Promise<SMSNotification>;
    /**
     * Send pickup reminder notification
     */
    static sendPickupReminderNotification(customerId: number, phoneNumber: string, customerName: string, orderNumber?: string): Promise<SMSNotification>;
    /**
     * Send delivery ready notification
     */
    static sendDeliveryReadyNotification(customerId: number, phoneNumber: string, customerName: string, orderNumber?: string, estimatedDeliveryTime?: string): Promise<SMSNotification>;
    /**
     * Send bulk queue position updates to all waiting customers
     */
    static sendBulkQueueUpdates(customers: Array<{
        customerId: number;
        phoneNumber: string;
        customerName: string;
        queuePosition: number;
        estimatedWait: number;
    }>): Promise<SMSNotification[]>;
    /**
     * Save notification to database and attempt to send
     */
    private static saveAndSendNotification;
    /**
     * Send SMS using configured provider
     */
    private static sendSMS;
    /**
     * Send SMS via Twilio
     */
    private static sendTwilioSMS;
    /**
     * Send SMS via Clicksend
     */
    private static sendClicksendSMS;
    /**
     * Send SMS via Vonage (formerly Nexmo)
     */
    private static sendVonageSMS;
    /**
     * Send SMS via generic API
     */
    private static sendGenericSMS;
    /**
     * Update notification status
     */
    private static updateNotificationStatus;
    /**
     * Get SMS template by name
     */
    private static getTemplate;
    /**
     * Replace variables in template with actual values
     */
    private static replaceVariables;
    /**
     * Get all SMS templates
     */
    static getTemplates(): Promise<SMSTemplate[]>;
    /**
     * Update SMS template
     */
    static updateTemplate(templateName: string, templateContent: string): Promise<void>;
    /**
     * Get SMS statistics
     */
    static getSMSStats(dateRange?: {
        start: string;
        end: string;
    }): Promise<SMSStats>;
    /**
     * Get SMS notification history for a customer
     */
    static getCustomerNotificationHistory(customerId: number): Promise<SMSNotification[]>;
    /**
     * Get recent SMS notifications with pagination
     */
    static getRecentNotifications(page?: number, limit?: number): Promise<{
        notifications: SMSNotification[];
        totalCount: number;
        totalPages: number;
    }>;
    /**
     * Retry failed SMS notifications
     */
    static retryFailedNotifications(maxRetries?: number): Promise<number>;
}
//# sourceMappingURL=EnhancedSMSService.d.ts.map