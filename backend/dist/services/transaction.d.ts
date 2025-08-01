import { Transaction, PaymentMode, DailyReport, Expense, Fund } from '../types';
import * as pg from 'pg';
export declare class TransactionService {
    static create(transactionData: {
        customer_id: number;
        or_number: string;
        amount: number;
        payment_mode: PaymentMode;
        sales_agent_id: number;
        cashier_id?: number;
        enforce_customer_amount?: boolean;
    }): Promise<Transaction>;
    static findById(id: number): Promise<Transaction | null>;
    static findByOrNumber(orNumber: string): Promise<Transaction | null>;
    static list(filters?: {
        startDate?: Date;
        endDate?: Date;
        paymentMode?: PaymentMode;
        salesAgentId?: number;
        cashierId?: number;
        customerId?: number;
        includePaymentDetails?: boolean;
    }, limit?: number, offset?: number): Promise<{
        transactions: Transaction[];
        total: number;
    }>;
    static updatePaymentStatus(txId: number, settlementRequestId?: string, client?: pg.PoolClient): Promise<Transaction | null>;
    static update(id: number, updates: {
        amount?: number;
        payment_mode?: PaymentMode;
        cashier_id?: number;
    }): Promise<Transaction>;
    static delete(id: number): Promise<void>;
    static getDailySummary(date?: Date): Promise<{
        totalAmount: number;
        totalTransactions: number;
        paidTransactions: number;
        unpaidTransactions: number;
        registeredCustomers: number;
        paymentModeBreakdown: Record<PaymentMode, {
            amount: number;
            count: number;
        }>;
        salesAgentBreakdown: Array<{
            agent_name: string;
            amount: number;
            count: number;
        }>;
    }>;
    static getMonthlyReport(year: number, month: number): Promise<{
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
    }>;
    static getPaymentModeStats(startDate: Date, endDate: Date): Promise<Array<{
        payment_mode: PaymentMode;
        total_amount: number;
        transaction_count: number;
        percentage: number;
    }>>;
}
export declare class ReportService {
    /**
     * Normalizes a daily report row from the database, ensuring all numeric fields are never null
     * @param row Raw database row
     * @returns Normalized DailyReport object with guaranteed numeric values
     */
    private static normalizeDailyReport;
    static generateDailyReport(date: Date, expenses?: Expense[], funds?: Fund[], pettyCashStart?: number, pettyCashEnd?: number): Promise<DailyReport>;
    static saveDailyReport(report: DailyReport): Promise<void>;
    static getDailyReport(date: string): Promise<DailyReport | null>;
    static deleteDailyReport(date: string): Promise<boolean>;
    static getAllDailyReports(): Promise<DailyReport[]>;
}
//# sourceMappingURL=transaction.d.ts.map