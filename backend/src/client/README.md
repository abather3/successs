# TransactionApi Client

A TypeScript client library for interacting with the transaction and settlement APIs in the escashop backend.

## Features

- ✅ **Settlement Methods**: `createSettlement(txId, payload)` and `getSettlements(txId)`
- ✅ **Enhanced Transaction Parsing**: `getTransactions` includes payment fields (`paid_amount`, `balance_amount`, `payment_status`)
- ✅ **Full Transaction CRUD**: Create, read, update, and delete transactions
- ✅ **Comprehensive Reporting**: Daily, weekly, and monthly reports
- ✅ **Type Safety**: Full TypeScript support with proper interfaces
- ✅ **Error Handling**: Structured error responses with detailed messages
- ✅ **Authentication**: Token-based authentication support
- ✅ **Singleton Support**: Default instance for easy usage

## Installation

```typescript
import { TransactionApi, transactionApi } from './client/TransactionApi';
// or
import { TransactionApi, transactionApi } from './client';
```

## Quick Start

### Basic Usage

```typescript
// Create a new instance
const api = new TransactionApi('/api', 'your-auth-token');

// Or use the singleton instance
transactionApi.setAuthToken('your-auth-token');
```

### Key Methods

#### 1. Create Settlement
```typescript
const result = await api.createSettlement(txId, {
  amount: 500.00,
  payment_mode: PaymentMode.GCASH,
  cashier_id: 2
});

if (result.data) {
  console.log('Settlement created!');
  console.log('Updated transaction:', result.data.transaction);
  console.log('Settlement history:', result.data.settlements);
} else {
  console.error('Error:', result.error);
}
```

#### 2. Get Settlements
```typescript
const settlements = await api.getSettlements(txId);

if (settlements.data) {
  settlements.data.forEach(settlement => {
    console.log(`Settlement ${settlement.id}: ${settlement.amount} via ${settlement.payment_mode}`);
  });
}
```

#### 3. Get Transactions with Payment Fields
```typescript
const response = await api.getTransactions({
  page: 1,
  limit: 10,
  paymentMode: PaymentMode.CASH,
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31')
});

if (response.data) {
  response.data.transactions.forEach(tx => {
    console.log(`Transaction ${tx.id}:`);
    console.log(`- Amount: ${tx.amount}`);
    console.log(`- Paid: ${tx.paid_amount}`);
    console.log(`- Balance: ${tx.balance_amount}`);
    console.log(`- Status: ${tx.payment_status}`);
    console.log(`- Customer: ${tx.customer_name}`);
    console.log(`- Sales Agent: ${tx.sales_agent_name}`);
    console.log(`- Cashier: ${tx.cashier_name}`);
  });
}
```

## API Reference

### Constructor
```typescript
new TransactionApi(baseUrl?: string, authToken?: string)
```

### Authentication
```typescript
setAuthToken(token: string): void
```

### Settlement Methods
```typescript
createSettlement(txId: number, payload: SettlementPayload): Promise<ApiResponse<SettlementResponse>>
getSettlements(txId: number): Promise<ApiResponse<PaymentSettlement[]>>
```

### Transaction Methods
```typescript
getTransactions(filters?: TransactionFilters): Promise<ApiResponse<TransactionListResponse>>
getTransaction(id: number): Promise<ApiResponse<TransactionWithPaymentFields>>
createTransaction(data: TransactionData): Promise<ApiResponse<Transaction>>
updateTransaction(id: number, updates: TransactionUpdates): Promise<ApiResponse<Transaction>>
deleteTransaction(id: number): Promise<ApiResponse<void>>
```

### Reporting Methods
```typescript
getDailySummary(date?: Date): Promise<ApiResponse<DailySummary>>
getMonthlyReport(year: number, month: number): Promise<ApiResponse<MonthlyReport>>
getWeeklyReport(startDate: Date, endDate: Date): Promise<ApiResponse<WeeklyReport>>
exportTransactions(options: ExportOptions): Promise<ApiResponse<ExportResult>>
```

## Types

### SettlementPayload
```typescript
interface SettlementPayload {
  amount: number;
  payment_mode: PaymentMode;
  cashier_id: number;
}
```

### TransactionWithPaymentFields
```typescript
interface TransactionWithPaymentFields extends Transaction {
  customer_name?: string;
  sales_agent_name?: string;
  cashier_name?: string;
  paid_amount: number;
  balance_amount: number;
  payment_status: PaymentStatus;
}
```

### ApiResponse
```typescript
interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
```

## Error Handling

The client returns structured error responses:

```typescript
const result = await api.createSettlement(txId, payload);

if (result.error) {
  // Handle specific error types
  if (result.error.includes('not found')) {
    // Transaction not found
  } else if (result.error.includes('exceeds')) {
    // Settlement amount exceeds balance
  } else if (result.error.includes('Network')) {
    // Network/connection error
  }
}
```

## Transaction Filters

```typescript
interface TransactionFilters {
  startDate?: Date;
  endDate?: Date;
  paymentMode?: PaymentMode;
  salesAgentId?: number;
  cashierId?: number;
  customerId?: number;
  page?: number;
  limit?: number;
}
```

## Payment Fields Enhancement

The `getTransactions` method now includes additional payment-related fields:

- `paid_amount`: Total amount paid through settlements
- `balance_amount`: Remaining balance (amount - paid_amount)
- `payment_status`: Current payment status ('unpaid', 'partial', 'paid')
- `customer_name`: Customer name from JOIN
- `sales_agent_name`: Sales agent name from JOIN
- `cashier_name`: Cashier name from JOIN

## Examples

See `examples/TransactionApiExample.ts` for comprehensive usage examples including:
- Basic operations
- Error handling patterns
- Batch operations
- Singleton usage
- Real-world scenarios

## Backend Integration

This client integrates with the existing backend endpoints:

- `POST /api/transactions/:id/settlements` - Create settlement
- `GET /api/transactions/:id/settlements` - Get settlements
- `GET /api/transactions` - Get transactions with payment fields
- `GET /api/transactions/:id` - Get single transaction
- And all other transaction endpoints...

## Development

The client is built with:
- TypeScript for type safety
- Fetch API for HTTP requests
- Structured error handling
- Consistent API patterns
- Comprehensive documentation

## Contributing

When adding new features:
1. Add the method to the `TransactionApi` class
2. Update the types as needed
3. Add examples to the example file
4. Update this README
5. Ensure proper error handling
