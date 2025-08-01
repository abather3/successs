export interface CustomerNotificationData {
    customer: {
        id: number;
        name: string;
        or_number: string;
        token_number: number;
        contact_number?: string;
        priority_flags: {
            senior_citizen: boolean;
            pregnant: boolean;
            pwd: boolean;
        };
        payment_info?: {
            amount: number;
            mode: string;
        };
    };
    created_by: {
        id: number;
        name: string;
        role: string;
    };
}
export interface CustomerNotification {
    id: string;
    notification_id: string;
    type: 'customer_registration';
    title: string;
    message: string;
    customer_data: any;
    created_by_id: number;
    created_by_name: string;
    created_by_role: string;
    target_role: string;
    target_user_id?: number;
    is_read: boolean;
    read_at?: Date;
    read_by_user_id?: number;
    expires_at: Date;
    created_at: Date;
    actions: NotificationAction[];
}
export interface NotificationAction {
    action_type: string;
    label: string;
    is_primary: boolean;
}
export declare class CustomerNotificationService {
    /**
     * Create a new customer registration notification
     * ISOLATED: Does not interfere with queue management
     */
    static createCustomerRegistrationNotification(data: CustomerNotificationData): Promise<CustomerNotification>;
    /**
     * Get active notifications for a specific role
     * ISOLATED: Only returns customer registration notifications
     */
    static getActiveNotifications(targetRole: string, userId?: number): Promise<CustomerNotification[]>;
    /**
     * Mark notification as read
     * ISOLATED: Only affects customer notifications
     */
    static markAsRead(notificationId: string, userId: number): Promise<void>;
    /**
     * Get notification analytics including response times
     * ISOLATED: Only customer notification analytics
     */
    static getNotificationAnalytics(targetRole?: string): Promise<{
        total_notifications: number;
        total_active: number;
        total_unread: number;
        total_read: number;
        expires_soon: number;
        avg_response_time_minutes: number;
        created_today: number;
        read_today: number;
    }>;
    /**
     * Get notification statistics (legacy method for backward compatibility)
     * ISOLATED: Only customer notification stats
     */
    static getNotificationStats(targetRole?: string): Promise<{
        total_active: number;
        total_unread: number;
        expires_soon: number;
    }>;
    /**
     * Get notification history with pagination and filtering
     * ISOLATED: Only customer notifications with support for search and filtering
     */
    static getNotificationHistory(filters: {
        page: number;
        search: string;
        startDate: string;
        endDate: string;
        priority_type: string;
        action: string;
    }): Promise<{
        notifications: any[];
        currentPage: number;
        totalPages: number;
        totalRecords: number;
        perPage: number;
    }>;
    /**
     * Clean up expired notifications (manual cleanup)
     * ISOLATED: Only affects customer notifications
     */
    static cleanupExpiredNotifications(): Promise<number>;
    /**
     * Get notification by ID
     * ISOLATED: Only customer notifications
     */
    static getNotificationById(notificationId: string): Promise<CustomerNotification | null>;
    /**
     * REAL-TIME ANALYTICS: Trigger stats update via WebSocket
     * This method emits updated notification statistics to all connected clients
     */
    private static triggerStatsUpdate;
    /**
     * REAL-TIME ANALYTICS: Manual trigger for stats update (public method)
     * Can be called externally to force a stats update
     */
    static triggerManualStatsUpdate(targetRole?: string): void;
}
//# sourceMappingURL=CustomerNotificationService.d.ts.map