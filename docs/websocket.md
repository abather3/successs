# WebSocket Event Documentation

This document describes the standardized WebSocket events emitted by the EscaShop backend for real-time communication with clients.

## Event Names

### `transactionUpdated`

**Description**: Emitted for any change in the `transactions` table.

**Payload Structure**:
```typescript
{
  type: string;           // The type of update (e.g., 'transaction_created', 'payment_status_updated', 'transaction_updated', 'transaction_deleted')
  transaction?: any;      // The transaction object (for create/update operations)
  transactionId?: number; // The transaction ID (for delete operations)
  settlement?: any;       // Settlement object (when applicable, e.g., during payment settlements)
  timestamp: Date;        // When the event occurred
}
```

**Examples**:

Transaction Created:
```json
{
  "type": "transaction_created",
  "transaction": {
    "id": 123,
    "customer_id": 456,
    "or_number": "OR-2024-001",
    "amount": 1500.00,
    "payment_mode": "cash",
    "payment_status": "unpaid",
    "paid_amount": 0,
    "balance_amount": 1500.00
  },
  "timestamp": "2024-01-01T10:00:00Z"
}
```

Payment Status Updated:
```json
{
  "type": "payment_status_updated",
  "transaction": {
    "id": 123,
    "payment_status": "partial",
    "paid_amount": 500.00,
    "balance_amount": 1000.00
  },
  "timestamp": "2024-01-01T10:15:00Z"
}
```

Transaction Updated:
```json
{
  "type": "transaction_updated",
  "transaction": {
    "id": 123,
    "amount": 1600.00,
    "payment_mode": "gcash"
  },
  "timestamp": "2024-01-01T10:20:00Z"
}
```

Transaction Deleted:
```json
{
  "type": "transaction_deleted",
  "transactionId": 123,
  "timestamp": "2024-01-01T10:30:00Z"
}
```

### `settlementCreated`

**Description**: Emitted once per new settlement creation in the `payment_settlements` table.

**Payload Structure**:
```typescript
{
  transaction_id: number;  // ID of the transaction this settlement belongs to
  settlement: any;         // The settlement record that was created
  transaction: any;        // The updated transaction record after settlement
}
```

**Example**:
```json
{
  "transaction_id": 123,
  "settlement": {
    "id": 45,
    "transaction_id": 123,
    "amount": 500.00,
    "payment_mode": "cash",
    "cashier_id": 789,
    "paid_at": "2024-01-01T10:15:00Z"
  },
  "transaction": {
    "id": 123,
    "customer_id": 456,
    "or_number": "OR-2024-001",
    "amount": 1500.00,
    "payment_status": "partial",
    "paid_amount": 500.00,
    "balance_amount": 1000.00
  }
}
```

## Client Implementation

### Subscription

To receive these events, clients must subscribe to the appropriate channels:

```javascript
// Subscribe to transaction updates
socket.emit('subscribe:transactions');

// Listen for transaction updates
socket.on('transactionUpdated', (data) => {
  console.log('Transaction updated:', data);
  // Handle the transaction update based on the type
  switch(data.type) {
    case 'transaction_created':
      // Handle new transaction
      break;
    case 'payment_status_updated':
      // Handle payment status change
      break;
    case 'transaction_updated':
      // Handle transaction modification
      break;
    case 'transaction_deleted':
      // Handle transaction deletion
      break;
  }
});

// Listen for settlement creation
socket.on('settlementCreated', (data) => {
  console.log('New settlement created:', data);
  // Update UI to show the new settlement
  updateSettlementHistory(data.transaction_id, data.settlement);
  updateTransactionStatus(data.transaction);
});
```

### Access Control

- `transactionUpdated`: Available to users with roles `admin` and `cashier` who subscribe to `transactions:updates` channel
- `settlementCreated`: Available to all authenticated users (broadcasted globally)

## Legacy Events (Deprecated)

The following events are maintained for backward compatibility but should be migrated to the standardized events:

- `transaction:update` → Use `transactionUpdated` instead
- `payment_status_updated` → Still available via separate subscription to `payment_status:updates`

## Migration Guide

### For Frontend Developers

1. Replace `transaction:update` event listeners with `transactionUpdated`
2. Update event handlers to check the `type` field to determine the specific action
3. Add listeners for `settlementCreated` if you need real-time settlement notifications

**Before**:
```javascript
socket.on('transaction:update', (data) => {
  // Handle update
});
```

**After**:
```javascript
socket.on('transactionUpdated', (data) => {
  switch(data.type) {
    case 'payment_status_updated':
      // Handle payment status change
      break;
    // Handle other types...
  }
});

socket.on('settlementCreated', (data) => {
  // Handle new settlement
});
```

### For Backend Developers

The WebSocket service provides helper methods:

```typescript
import { WebSocketService } from './services/websocket';

// Emit transaction update
WebSocketService.emitTransactionUpdate({
  type: 'transaction_created',
  transaction: transactionObject,
  timestamp: new Date()
});

// Emit settlement creation
WebSocketService.emitSettlementCreated({
  transaction_id: 123,
  settlement: settlementObject,
  transaction: updatedTransactionObject
});
```

## Testing

Use the existing test suites in `backend/src/__tests__/websocket-*.test.ts` and update them to verify the new standardized event names.

Example test:
```typescript
it('should emit transactionUpdated event', () => {
  WebSocketService.emitTransactionUpdate({
    type: 'transaction_created',
    transaction: mockTransaction,
    timestamp: new Date()
  });
  
  expect(mockIO.emit).toHaveBeenCalledWith('transactionUpdated', expect.objectContaining({
    type: 'transaction_created',
    transaction: mockTransaction
  }));
});
```
