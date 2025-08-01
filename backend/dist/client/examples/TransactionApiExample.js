"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.demonstrateTransactionApiUsage = demonstrateTransactionApiUsage;
exports.handleApiErrors = handleApiErrors;
exports.useSingletonInstance = useSingletonInstance;
exports.batchOperations = batchOperations;
const TransactionApi_1 = require("../TransactionApi");
const types_1 = require("../../types");
// Example usage of TransactionApi client
async function demonstrateTransactionApiUsage() {
    // Initialize the API client
    const transactionApi = new TransactionApi_1.TransactionApi('/api', 'your-auth-token');
    try {
        // Example 1: Get transactions with payment fields
        console.log('=== Getting Transactions with Payment Fields ===');
        const transactionsResponse = await transactionApi.getTransactions({
            page: 1,
            limit: 10,
            paymentMode: types_1.PaymentMode.CASH,
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-12-31')
        });
        if (transactionsResponse.data) {
            console.log('Transactions:', transactionsResponse.data.transactions);
            console.log('Pagination:', transactionsResponse.data.pagination);
            // Each transaction now includes payment fields:
            // - paid_amount
            // - balance_amount  
            // - payment_status
            // - customer_name
            // - sales_agent_name
            // - cashier_name
        }
        else {
            console.error('Error getting transactions:', transactionsResponse.error);
        }
        // Example 2: Get a specific transaction
        console.log('\n=== Getting Single Transaction ===');
        const transactionResponse = await transactionApi.getTransaction(1);
        if (transactionResponse.data) {
            console.log('Transaction details:', transactionResponse.data);
        }
        else {
            console.error('Error getting transaction:', transactionResponse.error);
        }
        // Example 3: Create a settlement
        console.log('\n=== Creating Settlement ===');
        const settlementResponse = await transactionApi.createSettlement(1, {
            amount: 500.00,
            payment_mode: types_1.PaymentMode.GCASH,
            cashier_id: 2
        });
        if (settlementResponse.data) {
            console.log('Settlement created successfully!');
            console.log('Updated transaction:', settlementResponse.data.transaction);
            console.log('Settlement history:', settlementResponse.data.settlements);
        }
        else {
            console.error('Error creating settlement:', settlementResponse.error);
        }
        // Example 4: Get all settlements for a transaction
        console.log('\n=== Getting Settlements ===');
        const settlementsResponse = await transactionApi.getSettlements(1);
        if (settlementsResponse.data) {
            console.log('Settlements for transaction 1:', settlementsResponse.data);
            // Each settlement includes:
            // - id
            // - transaction_id
            // - amount
            // - payment_mode
            // - paid_at
            // - cashier_id
            // - notes
            // - created_at
            // - cashier_name (from JOIN)
        }
        else {
            console.error('Error getting settlements:', settlementsResponse.error);
        }
        // Example 5: Get daily summary
        console.log('\n=== Getting Daily Summary ===');
        const summaryResponse = await transactionApi.getDailySummary(new Date());
        if (summaryResponse.data) {
            console.log('Daily summary:', summaryResponse.data);
        }
        else {
            console.error('Error getting daily summary:', summaryResponse.error);
        }
        // Example 6: Export transactions
        console.log('\n=== Exporting Transactions ===');
        const exportResponse = await transactionApi.exportTransactions({
            format: 'excel',
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-12-31'),
            paymentMode: types_1.PaymentMode.CASH
        });
        if (exportResponse.data) {
            console.log('Export completed:', exportResponse.data);
        }
        else {
            console.error('Error exporting transactions:', exportResponse.error);
        }
    }
    catch (error) {
        console.error('Unexpected error:', error);
    }
}
// Example of using the API client with error handling
async function handleApiErrors() {
    const transactionApi = new TransactionApi_1.TransactionApi('/api');
    // Example of handling different types of errors
    const result = await transactionApi.createSettlement(999, {
        amount: 100,
        payment_mode: types_1.PaymentMode.CASH,
        cashier_id: 1
    });
    if (result.error) {
        console.error('API Error:', result.error);
        // Handle specific error types
        if (result.error.includes('not found')) {
            console.log('Transaction not found - show user-friendly message');
        }
        else if (result.error.includes('exceeds')) {
            console.log('Settlement amount exceeds balance - show validation error');
        }
        else if (result.error.includes('Network')) {
            console.log('Network error - show retry option');
        }
    }
    else {
        console.log('Settlement created successfully:', result.data);
    }
}
// Example of using the singleton instance
async function useSingletonInstance() {
    // Import the default instance
    const { transactionApi } = await Promise.resolve().then(() => __importStar(require('../TransactionApi')));
    // Set auth token
    transactionApi.setAuthToken('your-auth-token');
    // Use the singleton instance
    const response = await transactionApi.getTransactions({ page: 1, limit: 5 });
    console.log('Transactions from singleton:', response.data);
}
// Example of batch operations
async function batchOperations() {
    const transactionApi = new TransactionApi_1.TransactionApi('/api', 'your-auth-token');
    // Get multiple transactions in parallel
    const transactionIds = [1, 2, 3, 4, 5];
    const transactionPromises = transactionIds.map(id => transactionApi.getTransaction(id));
    const transactionResults = await Promise.all(transactionPromises);
    // Process results
    transactionResults.forEach((result, index) => {
        if (result.data) {
            console.log(`Transaction ${transactionIds[index]}:`, result.data);
        }
        else {
            console.error(`Error for transaction ${transactionIds[index]}:`, result.error);
        }
    });
}
//# sourceMappingURL=TransactionApiExample.js.map