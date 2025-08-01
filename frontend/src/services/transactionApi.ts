import { Transaction, DailyReport, PaymentMode, Expense, Fund } from '../types';

/**
 * TransactionApi - Centralized API handling with error management
 * 
 * Features:
 * - 404 errors throw 'NOT_FOUND' special error message
 * - Optional onError callback for components to handle errors (e.g., snackbar feedback)
 * - Callers can decide how to treat NOT_FOUND errors (skip vs show error)
 * 
 * Example usage:
 * ```typescript
 * try {
 *   const transaction = await TransactionApi.getTransaction(id, {
 *     onError: (error, status) => {
 *       if (error.message !== 'NOT_FOUND') {
 *         showSnackbar('Error loading transaction', 'error');
 *       }
 *     }
 *   });
 * } catch (error) {
 *   if (error.message === 'NOT_FOUND') {
 *     // Handle NOT_FOUND specifically - maybe skip or show different message
 *   }
 * }
 * ```
 */

// Use proper API base URL detection
const getApiBaseUrl = () => {
  const currentLocation = window.location;
  const isNginxProxy = currentLocation.port === '80' || currentLocation.port === '' || currentLocation.port === undefined;
  return isNginxProxy ? '/api' : (process.env.REACT_APP_API_URL || '/api');
};
const API_BASE_URL = getApiBaseUrl();

interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  paymentMode?: PaymentMode;
  salesAgentId?: number;
  cashierId?: number;
  customerId?: number;
  page?: number;
  limit?: number;
}

interface TransactionListResponse {
  transactions: Transaction[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

interface ExportRequest {
  format: 'excel' | 'pdf' | 'csv';
  startDate?: string;
  endDate?: string;
  paymentMode?: PaymentMode;
  salesAgentId?: number;
  cashierId?: number;
}

interface ReportGenerationRequest {
  date: string;
  expenses: Expense[];
  funds: Fund[];
  pettyCashStart: number;
  pettyCashEnd: number;
}

interface ApiOptions {
  onError?: (error: Error, status?: number) => void;
}

class TransactionApi {
  private static async fetchWithAuth(url: string, options: RequestInit = {}, apiOptions?: ApiOptions): Promise<Response> {
    const token = localStorage.getItem('accessToken');
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    const fullUrl = `${API_BASE_URL}${url}`;
    
    try {
      const response = await fetch(fullUrl, config);
      
      
      if (!response.ok) {
        const error = response.status === 404 
          ? new Error('NOT_FOUND')
          : new Error(`HTTP error! status: ${response.status}`);
        
        // Call onError callback if provided
        if (apiOptions?.onError) {
          apiOptions.onError(error, response.status);
        }
        
        throw error;
      }
      
      return response;
    } catch (error) {
      // Handle network errors or other fetch errors
      if (error instanceof Error && error.message !== 'NOT_FOUND') {
        const networkError = new Error(`Network error: ${error.message}`);
        if (apiOptions?.onError) {
          apiOptions.onError(networkError);
        }
        throw networkError;
      }
      throw error;
    }
  }

  // Transaction CRUD operations
  static async getTransactions(filters: TransactionFilters = {}, apiOptions?: ApiOptions): Promise<TransactionListResponse> {
    const queryParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value.toString());
      }
    });

    const response = await this.fetchWithAuth(`/transactions?${queryParams.toString()}`, {}, apiOptions);
    return response.json();
  }

  static async getTransaction(id: number, apiOptions?: ApiOptions): Promise<Transaction> {
    // Guard against invalid IDs - throw early if not a valid number
    if (typeof id !== 'number' || Number.isNaN(id)) {
      const error = new Error('Invalid transaction ID: must be a valid number');
      if (apiOptions?.onError) {
        apiOptions.onError(error);
      }
      throw error;
    }
    const response = await this.fetchWithAuth(`/transactions/${id}`, {}, apiOptions);
    return response.json();
  }

  static async createTransaction(transactionData: Omit<Transaction, 'id' | 'created_at'>, apiOptions?: ApiOptions): Promise<Transaction> {
    const response = await this.fetchWithAuth('/transactions', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    }, apiOptions);
    return response.json();
  }

  static async updateTransaction(id: number, updates: Partial<Transaction>, apiOptions?: ApiOptions): Promise<Transaction> {
    // Guard against invalid IDs
    if (!id || isNaN(id) || id <= 0) {
      throw new Error('Invalid transaction ID provided');
    }
    const response = await this.fetchWithAuth(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }, apiOptions);
    return response.json();
  }

  static async deleteTransaction(id: number, apiOptions?: ApiOptions): Promise<void> {
    // Guard against invalid IDs
    if (!id || isNaN(id) || id <= 0) {
      throw new Error('Invalid transaction ID provided');
    }
    await this.fetchWithAuth(`/transactions/${id}`, {
      method: 'DELETE',
    }, apiOptions);
  }

  // Report operations
  static async getDailySummary(date?: string, apiOptions?: ApiOptions): Promise<any> {
    const queryParams = date ? `?date=${date}` : '';
    const response = await this.fetchWithAuth(`/transactions/reports/daily${queryParams}`, {}, apiOptions);
    return response.json();
  }

  static async generateDailyReport(request: ReportGenerationRequest, apiOptions?: ApiOptions): Promise<DailyReport> {
    const response = await this.fetchWithAuth('/transactions/reports/daily', {
      method: 'POST',
      body: JSON.stringify(request),
    }, apiOptions);
    return response.json();
  }

  static async getDailyReport(date: string, apiOptions?: ApiOptions): Promise<DailyReport> {
    const url = `/transactions/reports/daily/${date}`;
    const response = await this.fetchWithAuth(url, {}, apiOptions);
    return response.json();
  }

  static async deleteDailyReport(date: string, apiOptions?: ApiOptions): Promise<{ success: boolean; message: string }> {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const error = new Error('Invalid date format. Expected YYYY-MM-DD');
      if (apiOptions?.onError) {
        apiOptions.onError(error);
      }
      throw error;
    }
    const url = `/transactions/reports/daily/${date}`;
    const response = await this.fetchWithAuth(url, {
      method: 'DELETE',
    }, apiOptions);
    return response.json();
  }

  static async getAllDailyReports(apiOptions?: ApiOptions): Promise<DailyReport[]> {
    const response = await this.fetchWithAuth('/transactions/reports/daily/all', {}, apiOptions);
    return response.json();
  }

  static async getMonthlyReport(year: number, month: number): Promise<any> {
    const response = await this.fetchWithAuth(`/transactions/reports/monthly?year=${year}&month=${month}`);
    return response.json();
  }

  static async getWeeklyReport(startDate: string, endDate: string): Promise<any> {
    const response = await this.fetchWithAuth(`/transactions/reports/weekly?startDate=${startDate}&endDate=${endDate}`);
    return response.json();
  }

  // Export operations
  static async exportTransactions(request: ExportRequest): Promise<any> {
    const response = await this.fetchWithAuth('/transactions/export', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response.json();
  }

  // Payment mode statistics
  static async getPaymentModeStats(startDate: string, endDate: string): Promise<any> {
    const response = await this.fetchWithAuth(`/transactions/stats/payment-modes?startDate=${startDate}&endDate=${endDate}`);
    return response.json();
  }

  // Settlement operations
  static async createSettlement(transactionId: number, settlementData: {
    amount: number;
    payment_mode: PaymentMode;
    cashier_id: number;
    notes?: string;
  }): Promise<any> {
    // Guard against invalid transaction IDs
    if (!transactionId || isNaN(transactionId) || transactionId <= 0) {
      throw new Error('Invalid transaction ID provided for settlement');
    }
    const response = await this.fetchWithAuth(`/transactions/${transactionId}/settlements`, {
      method: 'POST',
      body: JSON.stringify(settlementData),
    });
    return response.json();
  }

  static async getSettlements(transactionId: number): Promise<any> {
    // Guard against invalid transaction IDs
    if (!transactionId || isNaN(transactionId) || transactionId <= 0) {
      throw new Error('Invalid transaction ID provided for settlements lookup');
    }
    const response = await this.fetchWithAuth(`/transactions/${transactionId}/settlements`);
    return response.json();
  }

  // Alias for getSettlements to match the expected API
  static async getSettlementHistory(transactionId: number): Promise<any> {
    return this.getSettlements(transactionId);
  }
}

export default TransactionApi;
export type { ApiOptions };
