# PaymentSettlementService API Documentation

## Overview
The PaymentSettlementService provides endpoints for managing payment settlements on transactions, allowing for partial payments and tracking payment history.

## Endpoints

### POST /transactions/:id/settlements
Create a new payment settlement for a transaction.

**Request:**
```json
{
  "amount": 500.00,
  "payment_mode": "cash",
  "cashier_id": 123
}
```

**Response:**
```json
{
  "transaction": {
    "id": 1,
    "customer_id": 1,
    "or_number": "OR-2024-001",
    "amount": 1000.00,
    "paid_amount": 500.00,
    "balance_amount": 500.00,
    "payment_status": "partial",
    "payment_mode": "cash",
    "sales_agent_id": 1,
    "cashier_id": 123,
    "transaction_date": "2024-01-15T10:30:00Z",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "settlements": [
    {
      "id": 1,
      "transaction_id": 1,
      "amount": 500.00,
      "payment_mode": "cash",
      "paid_at": "2024-01-15T10:30:00Z",
      "cashier_id": 123,
      "cashier_name": "John Doe",
      "notes": null,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Validation Rules:**
- `amount` must be positive
- `payment_mode` must be one of: cash, gcash, maya, bank_transfer, credit_card
- `cashier_id` must be a valid user ID
- Settlement amount cannot exceed remaining balance
- Transaction must exist

### GET /transactions/:id/settlements
Retrieve all payment settlements for a transaction.

**Response:**
```json
[
  {
    "id": 1,
    "transaction_id": 1,
    "amount": 500.00,
    "payment_mode": "cash",
    "paid_at": "2024-01-15T10:30:00Z",
    "cashier_id": 123,
    "cashier_name": "John Doe",
    "notes": null,
    "created_at": "2024-01-15T10:30:00Z"
  },
  {
    "id": 2,
    "transaction_id": 1,
    "amount": 300.00,
    "payment_mode": "gcash",
    "paid_at": "2024-01-15T14:30:00Z",
    "cashier_id": 124,
    "cashier_name": "Jane Smith",
    "notes": "GCash payment",
    "created_at": "2024-01-15T14:30:00Z"
  }
]
```

## Service Methods

### PaymentSettlementService.createSettlement()
- **Purpose**: Creates a new payment settlement and updates transaction status
- **Parameters**: `transactionId`, `amount`, `paymentMode`, `cashierId`
- **Returns**: `{ transaction, settlements }`
- **Side Effects**: 
  - Updates transaction `paid_amount` and `payment_status`
  - Emits WebSocket event for real-time updates

### PaymentSettlementService.getSettlements()
- **Purpose**: Retrieves all settlements for a transaction
- **Parameters**: `transactionId`
- **Returns**: Array of `PaymentSettlement` objects
- **Features**: 
  - Includes cashier name
  - Ordered by payment date (newest first)

## Authentication & Authorization
- Both endpoints require authentication (`authenticateToken`)
- POST endpoint requires CASHIER or ADMIN role (`requireCashierOrAdmin`)
- GET endpoint accessible to all authenticated users

## Error Handling
- 400 Bad Request: Invalid input data, validation errors
- 404 Not Found: Transaction not found
- 500 Internal Server Error: Database or server errors

## Real-time Updates
All settlement operations emit WebSocket events:
- Event type: `payment_settlement_created`
- Payload includes updated transaction and settlement details
