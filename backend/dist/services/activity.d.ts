import { ActivityLog } from '../types';
export declare class ActivityService {
    static log(activityData: {
        user_id: number;
        action: string;
        details: Record<string, any>;
        ip_address?: string;
        user_agent?: string;
    }): Promise<ActivityLog>;
    /**
     * Check if a string is a valid IP address (IPv4 or IPv6)
     */
    private static isValidIP;
    static getByUserId(userId: number, limit?: number, offset?: number): Promise<ActivityLog[]>;
    static getAll(limit?: number, offset?: number, filters?: {
        action?: string;
        startDate?: Date;
        endDate?: Date;
    }): Promise<ActivityLog[]>;
    static deleteOldLogs(retentionDays?: number): Promise<number>;
}
//# sourceMappingURL=activity.d.ts.map