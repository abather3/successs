import { QueueItem, Customer, QueueStatus, Counter } from '../types';
export declare class QueueService {
    static getQueue(statusFilter?: string): Promise<QueueItem[]>;
    /**
     * Get queue for display monitors - excludes processing records
     * Only returns customers in 'waiting' and 'serving' status for public display
     */
    static getDisplayQueue(): Promise<QueueItem[]>;
    static callNext(counterId: number): Promise<Customer | null>;
    static callSpecificCustomer(customerId: number, counterId: number): Promise<Customer | null>;
    static completeService(customerId: number, counterId: number): Promise<Customer>;
    static cancelService(customerId: number, reason?: string): Promise<Customer>;
    static getPosition(customerId: number): Promise<number | null>;
    static getEstimatedWaitTime(customerId: number): Promise<number>;
    static updatePriority(customerId: number, priorityBoost?: number): Promise<Customer>;
    static getQueueStatistics(): Promise<{
        totalWaiting: number;
        averageWaitTime: number;
        longestWaitTime: number;
        priorityCustomers: number;
    }>;
    private static calculatePriorityScore;
    private static calculateEstimatedWaitTime;
    static reorderQueue(customerIds: number[]): Promise<QueueItem[]>;
    static changeStatus(customerId: number, nextStatus: QueueStatus, userId?: number, userRole?: string): Promise<Customer>;
    private static isValidStatusTransition;
    /**
     * Check RBAC permissions for status transitions
     * @param userRole - The role of the user making the transition
     * @param currentStatus - Current status of the customer
     * @param nextStatus - Desired next status
     * @returns true if transition is allowed for the user role
     */
    private static isTransitionAllowedForRole;
    private static recordQueueEventWithTimestamps;
    static resetQueue(adminId: number, reason?: string): Promise<{
        cancelled: number;
        completed: number;
        message: string;
    }>;
}
export declare class CounterService {
    static list(): Promise<Counter[]>;
    static create(name: string): Promise<Counter>;
    static update(id: number, updates: {
        name?: string;
        is_active?: boolean;
    }): Promise<Counter>;
    static delete(id: number): Promise<void>;
    static findById(id: number): Promise<Counter | null>;
}
//# sourceMappingURL=queue.d.ts.map