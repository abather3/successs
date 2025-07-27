# WebSocket Payment Status Updates

This document explains how to implement real-time payment status updates using WebSocket connections.

## Overview

The WebSocket gateway now supports real-time payment status updates that broadcast changes to payment status, balance amounts, and paid amounts to all subscribed clients.

## WebSocket Events

### Client Subscription

To receive payment status updates, clients must subscribe to the `payment_status` channel:

```javascript
// After establishing WebSocket connection
socket.emit('subscribe:payment_status');
```

### Server Event: `payment_status_updated`

The server broadcasts this event whenever a payment status changes:

```javascript
// Event structure
{
  transactionId: number,
  payment_status: string,      // 'unpaid', 'partial', 'paid'
  balance_amount: number,      // Remaining balance
  paid_amount: number,         // Amount already paid
  customer_id: number,         // Customer ID
  or_number: string,          // Official Receipt number
  updatedBy: string,          // User who made the update
  timestamp: Date             // When the update occurred
}
```

## Frontend Implementation

### JavaScript/TypeScript Example

```javascript
// Establish WebSocket connection
const socket = io('ws://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});

// Subscribe to payment status updates
socket.emit('subscribe:payment_status');

// Listen for payment status updates
socket.on('payment_status_updated', (data) => {
  console.log('Payment status updated:', data);
  
  // Update UI based on payment status
  updatePaymentUI(data);
});

function updatePaymentUI(paymentData) {
  const { transactionId, payment_status, balance_amount, paid_amount } = paymentData;
  
  // Update transaction row in UI
  const transactionRow = document.querySelector(`[data-transaction-id="${transactionId}"]`);
  if (transactionRow) {
    // Update payment status badge
    const statusBadge = transactionRow.querySelector('.payment-status');
    statusBadge.textContent = payment_status;
    statusBadge.className = `payment-status ${payment_status}`;
    
    // Update amounts
    const balanceElement = transactionRow.querySelector('.balance-amount');
    balanceElement.textContent = `₱${balance_amount.toFixed(2)}`;
    
    const paidElement = transactionRow.querySelector('.paid-amount');
    paidElement.textContent = `₱${paid_amount.toFixed(2)}`;
  }
}
```

### React Example

```jsx
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const PaymentStatusComponent = () => {
  const [socket, setSocket] = useState(null);
  const [paymentUpdates, setPaymentUpdates] = useState([]);

  useEffect(() => {
    const newSocket = io('ws://localhost:3000', {
      auth: {
        token: localStorage.getItem('token')
      }
    });

    // Subscribe to payment status updates
    newSocket.emit('subscribe:payment_status');

    // Listen for payment status updates
    newSocket.on('payment_status_updated', (data) => {
      setPaymentUpdates(prev => [data, ...prev]);
      
      // Update specific transaction in your state
      // updateTransactionInState(data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <div>
      <h3>Recent Payment Updates</h3>
      {paymentUpdates.map((update, index) => (
        <div key={index} className="payment-update">
          <p>Transaction {update.transactionId}: {update.payment_status}</p>
          <p>Balance: ₱{update.balance_amount}</p>
          <p>Paid: ₱{update.paid_amount}</p>
          <small>{new Date(update.timestamp).toLocaleString()}</small>
        </div>
      ))}
    </div>
  );
};
```

## Access Control

### Role-Based Access

The following roles can subscribe to payment status updates:
- **admin**: Full access to all payment updates
- **cashier**: Can receive updates for transactions they handle
- **sales**: Can receive updates for transactions they created

### Authentication

Clients must provide a valid JWT token in the WebSocket handshake:

```javascript
const socket = io('ws://localhost:3000', {
  auth: {
    token: 'your-jwt-token-here'
  }
});
```

## Backend Integration

### Triggering Updates

Payment status updates are automatically triggered when:

1. A new payment settlement is created
2. Transaction payment status is updated
3. Payment amounts are modified

### Manual Triggering

You can also manually trigger payment status updates:

```javascript
import { WebSocketService } from './services/websocket';

// Trigger payment status update
WebSocketService.emitPaymentStatusUpdate({
  transactionId: 123,
  payment_status: 'partial',
  balance_amount: 500.00,
  paid_amount: 1000.00,
  customer_id: 456,
  or_number: 'OR-2024-001',
  updatedBy: 'System'
});
```

## Error Handling

### Client-Side

```javascript
socket.on('error', (error) => {
  console.error('WebSocket error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  
  // Implement reconnection logic
  setTimeout(() => {
    socket.connect();
  }, 5000);
});
```

### Server-Side

The server validates:
- User authentication
- Role permissions
- Data integrity

## Performance Considerations

- WebSocket connections are persistent
- Updates are broadcast only to subscribed clients
- Role-based filtering reduces unnecessary traffic
- Consider implementing client-side debouncing for rapid updates

## Testing

### Manual Testing

Use a WebSocket client to test the connection:

```bash
# Using wscat (install with: npm install -g wscat)
wscat -c ws://localhost:3000/socket.io/?EIO=4&transport=websocket
```

### Automated Testing

```javascript
// Jest test example
import { io } from 'socket.io-client';

test('receives payment status updates', (done) => {
  const socket = io('http://localhost:3000', {
    auth: { token: 'test-token' }
  });

  socket.emit('subscribe:payment_status');
  
  socket.on('payment_status_updated', (data) => {
    expect(data).toHaveProperty('transactionId');
    expect(data).toHaveProperty('payment_status');
    expect(data).toHaveProperty('balance_amount');
    expect(data).toHaveProperty('paid_amount');
    done();
  });
});
```
