import { Transaction, PaymentSettlement, PaymentMode, PaymentStatus } from '../types';
interface ApiResponse<T> {
    data?: T;
    error?: string;
    message?: string;
}
interface TransactionWithPaymentFields extends Transaction {
    customer_name?: string;
    sales_agent_name?: string;
    cashier_name?: string;
    paid_amount: number;
    balance_amount: number;
    payment_status: PaymentStatus;
}
interface TransactionListResponse {
    transactions: TransactionWithPaymentFields[];
    pagination: {
        current_page: number;
        per_page: number;
        total: number;
        total_pages: number;
    };
}
interface SettlementPayload {
    amount: number;
    payment_mode: PaymentMode;
    cashier_id: number;
}
interface SettlementResponse {
    transaction: TransactionWithPaymentFields;
    settlements: PaymentSettlement[];
}
export declare class TransactionApi {
    private baseUrl;
    private headers;
    constructor(baseUrl?: string, authToken?: string);
    /**
     * Set authentication token for API requests
     */
    setAuthToken(token: string): void;
    /**
     * Generic fetch wrapper with error handling
     */
    private request;
    /**
     * Get list of transactions with payment fields included
     */
    getTransactions(filters?: {
        startDate?: Date;
        endDate?: Date;
        paymentMode?: PaymentMode;
        salesAgentId?: number;
        cashierId?: number;
        customerId?: number;
        page?: number;
        limit?: number;
    }): Promise<ApiResponse<TransactionListResponse>>;
    /**
     * Get a single transaction by ID with payment fields
     */
    getTransaction(id: number): Promise<ApiResponse<TransactionWithPaymentFields>>;
    /**
     * Create a new transaction
     */
    createTransaction(transactionData: {
        customer_id: number;
        or_number: string;
        amount: number;
        payment_mode: PaymentMode;
        sales_agent_id: number;
        cashier_id?: number;
    }): Promise<ApiResponse<Transaction>>;
    /**
     * Update a transaction
     */
    updateTransaction(id: number, updates: {
        amount?: number;
        payment_mode?: PaymentMode;
        cashier_id?: number;
    }): Promise<ApiResponse<Transaction>>;
    /**
     * Delete a transaction
     */
    deleteTransaction(id: number): Promise<ApiResponse<void>>;
    /**
     * Create a settlement for a transaction
     */
    createSettlement(txId: number, payload: SettlementPayload): Promise<ApiResponse<SettlementResponse>>;
    /**
     * Get all settlements for a transaction
     */
    getSettlements(txId: number): Promise<ApiResponse<PaymentSettlement[]>>;
    /**
     * Get daily transaction summary
     */
    getDailySummary(date?: Date): Promise<ApiResponse<{
        totalAmount: number;
        totalTransactions: number;
        paymentModeBreakdown: Record<PaymentMode, {
            amount: number;
            count: number;
        }>;
        salesAgentBreakdown: Array<{
            agent_name: string;
            amount: number;
            count: number;
        }>;
    }>>;
    /**
     * Get monthly transaction report
     */
    getMonthlyReport(year: number, month: number): Promise<ApiResponse<{
        dailyBreakdown: Array<{
            date: string;
            amount: number;
            transactions: number;
        }>;
        totalAmount: number;
        totalTransactions: number;
        topSalesAgents: Array<{
            agent_name: string;
            amount: number;
            transactions: number;
        }>;
    }>>;
    /**
     * Get weekly transaction report
     */
    getWeeklyReport(startDate: Date, endDate: Date): Promise<ApiResponse<{
        startDate: string;
        endDate: string;
        summary: any;
        paymentStats: Array<{
            payment_mode: PaymentMode;
            total_amount: number;
            transaction_count: number;
            percentage: number;
        }>;
    }>>;
    /**
     * Export transactions
     */
    exportTransactions(options: {
        format: 'excel' | 'pdf' | 'csv';
        startDate?: Date;
        endDate?: Date;
        paymentMode?: PaymentMode;
        salesAgentId?: number;
        cashierId?: number;
    }): Promise<ApiResponse<{
        format: string;
        exportedAt: string;
        totalRecords: number;
        data: Transaction[];
    }>>;
    /**
     * Generate daily report
     */
    generateDailyReport(reportData: {
        date?: Date;
        expenses?: Array<{
            description: string;
            amount: number;
        }>;
        funds?: Array<{
            description: string;
            amount: number;
        }>;
        pettyCashStart?: number;
        pettyCashEnd?: number;
    }): Promise<ApiResponse<any>>;
    /**
     * Get saved daily report
     */
    getSavedDailyReport(date: string): Promise<ApiResponse<any>>;
}
export declare const transactionApi: TransactionApi;
export {};
//# sourceMappingURL=TransactionApi.d.ts.map