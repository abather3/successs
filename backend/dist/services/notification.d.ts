import { NotificationLog, NotificationStatus, SMSTemplate } from '../types';
export declare class NotificationService {
    static sendSMS(phoneNumber: string, message: string, customerId?: number): Promise<NotificationLog>;
    static sendCustomerReadyNotification(customerId: number, customerName: string, phoneNumber: string): Promise<void>;
    static sendDelayNotification(customerId: number, customerName: string, phoneNumber: string, estimatedTime: number): Promise<void>;
    static sendPickupReminder(customerId: number, customerName: string, phoneNumber: string): Promise<void>;
    private static sendSMSViaTelco;
    private static logNotification;
    static getSMSTemplate(name: string): Promise<SMSTemplate | null>;
    static createSMSTemplate(templateData: {
        name: string;
        template: string;
        variables: string[];
    }): Promise<SMSTemplate>;
    static updateSMSTemplate(id: number, updates: {
        name?: string;
        template?: string;
        variables?: string[];
        is_active?: boolean;
    }): Promise<SMSTemplate>;
    static listSMSTemplates(): Promise<SMSTemplate[]>;
    static getNotificationLogs(filters?: {
        customerId?: number;
        status?: NotificationStatus;
        startDate?: Date;
        endDate?: Date;
    }, limit?: number, offset?: number): Promise<{
        logs: NotificationLog[];
        total: number;
    }>;
    static initializeDefaultTemplates(): Promise<void>;
}
//# sourceMappingURL=notification.d.ts.map