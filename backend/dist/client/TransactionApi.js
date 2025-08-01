"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionApi = exports.TransactionApi = void 0;
class TransactionApi {
    constructor(baseUrl = '/api', authToken) {
        this.baseUrl = baseUrl;
        this.headers = {
            'Content-Type': 'application/json',
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
        };
    }
    /**
     * Set authentication token for API requests
     */
    setAuthToken(token) {
        this.headers.Authorization = `Bearer ${token}`;
    }
    /**
     * Generic fetch wrapper with error handling
     */
    async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers: {
                    ...this.headers,
                    ...options.headers,
                },
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
                };
            }
            const data = await response.json();
            return { data };
        }
        catch (error) {
            return {
                error: error instanceof Error ? error.message : 'Network error occurred',
            };
        }
    }
    /**
     * Get list of transactions with payment fields included
     */
    async getTransactions(filters) {
        const params = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined) {
                    if (value instanceof Date) {
                        params.append(key, value.toISOString());
                    }
                    else {
                        params.append(key, value.toString());
                    }
                }
            });
        }
        const queryString = params.toString();
        const endpoint = `/transactions${queryString ? `?${queryString}` : ''}`;
        return this.request(endpoint);
    }
    /**
     * Get a single transaction by ID with payment fields
     */
    async getTransaction(id) {
        return this.request(`/transactions/${id}`);
    }
    /**
     * Create a new transaction
     */
    async createTransaction(transactionData) {
        return this.request('/transactions', {
            method: 'POST',
            body: JSON.stringify(transactionData),
        });
    }
    /**
     * Update a transaction
     */
    async updateTransaction(id, updates) {
        return this.request(`/transactions/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }
    /**
     * Delete a transaction
     */
    async deleteTransaction(id) {
        return this.request(`/transactions/${id}`, {
            method: 'DELETE',
        });
    }
    /**
     * Create a settlement for a transaction
     */
    async createSettlement(txId, payload) {
        return this.request(`/transactions/${txId}/settlements`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }
    /**
     * Get all settlements for a transaction
     */
    async getSettlements(txId) {
        return this.request(`/transactions/${txId}/settlements`);
    }
    /**
     * Get daily transaction summary
     */
    async getDailySummary(date) {
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
    async getMonthlyReport(year, month) {
        const params = new URLSearchParams();
        params.append('year', year.toString());
        params.append('month', month.toString());
        return this.request(`/transactions/reports/monthly?${params.toString()}`);
    }
    /**
     * Get weekly transaction report
     */
    async getWeeklyReport(startDate, endDate) {
        const params = new URLSearchParams();
        params.append('startDate', startDate.toISOString());
        params.append('endDate', endDate.toISOString());
        return this.request(`/transactions/reports/weekly?${params.toString()}`);
    }
    /**
     * Export transactions
     */
    async exportTransactions(options) {
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
    async generateDailyReport(reportData) {
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
    async getSavedDailyReport(date) {
        return this.request(`/transactions/reports/daily/${date}`);
    }
}
exports.TransactionApi = TransactionApi;
// Export a default instance
exports.transactionApi = new TransactionApi();
//# sourceMappingURL=TransactionApi.js.map