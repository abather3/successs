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

export class TransactionApi {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(baseUrl: string = '/api', authToken?: string) {
    this.baseUrl = baseUrl;
    this.headers = {
      'Content-Type': 'application/json',
      ...(authToken && { Authorization: `Bearer ${authToken}` }),
    };
  }

  /**
   * Set authentication token for API requests
   */
  setAuthToken(token: string): void {
    this.headers.Authorization = `Bearer ${token}`;
  }

  /**
   * Generic fetch wrapper with error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as any;
        return {
          error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json() as T;
      return { data };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Network error occurred',
      };
    }
  }

  /**
   * Get list of transactions with payment fields included
   */
  async getTransactions(filters?: {
    startDate?: Date;
    endDate?: Date;
    paymentMode?: PaymentMode;
    salesAgentId?: number;
    cashierId?: number;
    customerId?: number;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<TransactionListResponse>> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          if (value instanceof Date) {
            params.append(key, value.toISOString());
          } else {
            params.append(key, value.toString());
          }
        }
      });
    }

    const queryString = params.toString();
    const endpoint = `/transactions${queryString ? `?${queryString}` : ''}`;
    
    return this.request<TransactionListResponse>(endpoint);
  }

  /**
   * Get a single transaction by ID with payment fields
   */
  async getTransaction(id: number): Promise<ApiResponse<TransactionWithPaymentFields>> {
    return this.request<TransactionWithPaymentFields>(`/transactions/${id}`);
  }

  /**
   * Create a new transaction
   */
  async createTransaction(transactionData: {
    customer_id: number;
    or_number: string;
    amount: number;
    payment_mode: PaymentMode;
    sales_agent_id: number;
    cashier_id?: number;
  }): Promise<ApiResponse<Transaction>> {
    return this.request<Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
  }

  /**
   * Update a transaction
   */
  async updateTransaction(
    id: number,
    updates: {
      amount?: number;
      payment_mode?: PaymentMode;
      cashier_id?: number;
    }
  ): Promise<ApiResponse<Transaction>> {
    return this.request<Transaction>(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete a transaction
   */
  async deleteTransaction(id: number): Promise<ApiResponse<void>> {
    return this.request<void>(`/transactions/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Create a settlement for a transaction
   */
  async createSettlement(
    txId: number,
    payload: SettlementPayload
  ): Promise<ApiResponse<SettlementResponse>> {
    return this.request<SettlementResponse>(`/transactions/${txId}/settlements`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Get all settlements for a transaction
   */
  async getSettlements(txId: number): Promise<ApiResponse<PaymentSettlement[]>> {
    return this.request<PaymentSettlement[]>(`/transactions/${txId}/settlements`);
  }

  /**
   * Get daily transaction summary
   */
  async getDailySummary(date?: Date): Promise<ApiResponse<{
    totalAmount: number;
    totalTransactions: number;
    paymentModeBreakdown: Record<PaymentMode, { amount: number; count: number }>;
    salesAgentBreakdown: Array<{ agent_name: string; amount: number; count: number }>;
  }>> {
    const params = new URLSearchParams();
    if (date) {
      params.append('date', date.toISOString());
    }
    
    const queryString = params.toString();
    const endpoint = `/transactions/reports/daily${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint);
  }

  /**
   * Get monthly transaction report
   */
  async getMonthlyReport(year: number, month: number): Promise<ApiResponse<{
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
  }>> {
    const params = new URLSearchParams();
    params.append('year', year.toString());
    params.append('month', month.toString());
    
    return this.request(`/transactions/reports/monthly?${params.toString()}`);
  }

  /**
   * Get weekly transaction report
   */
  async getWeeklyReport(startDate: Date, endDate: Date): Promise<ApiResponse<{
    startDate: string;
    endDate: string;
    summary: any;
    paymentStats: Array<{
      payment_mode: PaymentMode;
      total_amount: number;
      transaction_count: number;
      percentage: number;
    }>;
  }>> {
    const params = new URLSearchParams();
    params.append('startDate', startDate.toISOString());
    params.append('endDate', endDate.toISOString());
    
    return this.request(`/transactions/reports/weekly?${params.toString()}`);
  }

  /**
   * Export transactions
   */
  async exportTransactions(options: {
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
  }>> {
    return this.request('/transactions/export', {
      method: 'POST',
      body: JSON.stringify({
        ...options,
        startDate: options.startDate?.toISOString(),
        endDate: options.endDate?.toISOString(),
      }),
    });
  }

  /**
   * Generate daily report
   */
  async generateDailyReport(reportData: {
    date?: Date;
    expenses?: Array<{ description: string; amount: number }>;
    funds?: Array<{ description: string; amount: number }>;
    pettyCashStart?: number;
    pettyCashEnd?: number;
  }): Promise<ApiResponse<any>> {
    return this.request('/transactions/reports/daily', {
      method: 'POST',
      body: JSON.stringify({
        ...reportData,
        date: reportData.date?.toISOString(),
      }),
    });
  }

  /**
   * Get saved daily report
   */
  async getSavedDailyReport(date: string): Promise<ApiResponse<any>> {
    return this.request(`/transactions/reports/daily/${date}`);
  }
}

// Export a default instance
export const transactionApi = new TransactionApi();
