import { Customer, DistributionType, QueueStatus, PriorityFlags, Prescription, PaymentInfo, EstimatedTime } from '../types';
export declare class CustomerService {
    static create(customerData: {
        or_number?: string;
        name: string;
        contact_number: string;
        email: string;
        age: number;
        address: string;
        occupation?: string;
        distribution_info: DistributionType;
        sales_agent_id: number;
        doctor_assigned?: string;
        prescription: Prescription;
        grade_type: string;
        lens_type: string;
        frame_code?: string;
        estimated_time: EstimatedTime;
        payment_info: PaymentInfo;
        remarks?: string;
        priority_flags: PriorityFlags;
        create_initial_transaction?: boolean;
    }): Promise<Customer>;
    static findById(id: number): Promise<Customer | null>;
    static findByOrNumber(orNumber: string): Promise<Customer | null>;
    static list(filters?: {
        status?: QueueStatus;
        salesAgentId?: number;
        startDate?: Date;
        endDate?: Date;
        searchTerm?: string;
    }, limit?: number, offset?: number, sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<{
        customers: Customer[];
        total: number;
    }>;
    static countRegisteredToday(): Promise<number>;
    static update(id: number, updates: Partial<Customer>): Promise<Customer>;
    static updateStatus(id: number, status: QueueStatus): Promise<Customer>;
    static delete(id: number): Promise<void>;
    static calculatePriorityScore(priorityFlags: PriorityFlags): Promise<number>;
    /**
     * Creates an initial unpaid transaction with the customer's payment amount
     * This ensures the customer appears in the sales page transaction list
     */
    private static createInitialTransaction;
    private static generateTokenNumber;
    private static generateORNumber;
    static formatTokenNumber(tokenNumber: number): string;
    private static formatCustomer;
    static getQueueStatistics(): Promise<{
        total: number;
        waiting: number;
        serving: number;
        completed: number;
        cancelled: number;
        averageWaitTime: number;
    }>;
    static getSalesAgentStatistics(salesAgentId: number): Promise<{
        total: number;
        waiting: number;
        serving: number;
        completed: number;
        cancelled: number;
        todayTotal: number;
        thisWeekTotal: number;
        thisMonthTotal: number;
    }>;
    static estimatedTimeToMinutes(estimatedTime: EstimatedTime): number;
    static minutesToEstimatedTime(minutes: number): EstimatedTime;
}
//# sourceMappingURL=customer.d.ts.map