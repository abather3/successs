import React, { useState, useEffect, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';

interface Transaction {
  id: number;
  customer_id: number;
  or_number: string;
  amount: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  paid_amount: number;
  balance_amount: number;
  customer_name?: string;
  sales_agent_name?: string;
  cashier_name?: string;
}

interface Settlement {
  id: number;
  transaction_id: number;
  amount: number;
  payment_mode: string;
  cashier_id: number;
  paid_at: string;
  notes?: string;
  created_at: string;
  cashier_name?: string;
}

interface SettlementData {
  transaction_id: number;
  settlement: Settlement;
  transaction: Transaction;
}

interface TransactionManagementProps {
  authToken: string;
  apiBaseUrl: string;
}

const TransactionManagement: React.FC<TransactionManagementProps> = ({ 
  authToken, 
  apiBaseUrl 
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [processedSettlementIds, setProcessedSettlementIds] = useState<Set<number>>(new Set());

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io(apiBaseUrl, {
      auth: {
        token: authToken
      }
    });

    // Subscribe to transaction updates
    newSocket.emit('subscribe:transactions');
    
    // Subscribe to payment status updates  
    newSocket.emit('subscribe:payment_status');

    // FIX 1: Align listener names with backend changes
    // Listen for transactionUpdated events (backend emits 'transactionUpdated')
    newSocket.on('transactionUpdated', handleTransactionUpdate);
    
    // Listen for settlementCreated events (backend emits 'settlementCreated')
    newSocket.on('settlementCreated', handleSettlementCreated);

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [authToken, apiBaseUrl]);

  // Handle transaction updates from WebSocket
  const handleTransactionUpdate = useCallback((data: {
    type: string;
    transaction?: Transaction;
    transactionId?: number;
    timestamp: Date;
  }) => {
    console.log('Transaction update received:', data);
    
    if (data.type === 'transaction_created' && data.transaction) {
      setTransactions(prev => {
        // Check if transaction already exists to avoid duplicates
        const exists = prev.some(t => t.id === data.transaction!.id);
        if (!exists) {
          return [...prev, data.transaction!];
        }
        return prev;
      });
    } else if (data.type === 'payment_status_updated' && data.transaction) {
      setTransactions(prev => 
        prev.map(t => 
          t.id === data.transaction!.id 
            ? { ...t, ...data.transaction! }
            : t
        )
      );
    } else if (data.type === 'transaction_deleted' && data.transactionId) {
      setTransactions(prev => 
        prev.filter(t => t.id !== data.transactionId)
      );
    }
  }, []);

  // FIX 3: Add safeguard to ignore duplicate settlement IDs
  const handleSettlementCreated = useCallback((data: SettlementData) => {
    console.log('Settlement created received:', data);
    
    // Check if we've already processed this settlement
    if (processedSettlementIds.has(data.settlement.id)) {
      console.log('Duplicate settlement detected, ignoring:', data.settlement.id);
      return;
    }
    
    // Add settlement ID to processed set
    setProcessedSettlementIds(prev => new Set(prev).add(data.settlement.id));
    
    // Update the transaction with new payment status and amounts
    if (data.transaction) {
      setTransactions(prev => 
        prev.map(t => 
          t.id === data.transaction_id 
            ? { 
                ...t, 
                payment_status: data.transaction.payment_status,
                paid_amount: data.transaction.paid_amount,
                balance_amount: data.transaction.balance_amount
              }
            : t
        )
      );
    }
  }, [processedSettlementIds]);

  // FIX 2: Remove forced reload of transactions - rely on socket events
  const handleConfirmSettlement = async (transactionId: number, settlementData: {
    amount: number;
    payment_mode: string;
    cashier_id: number;
    notes?: string;
  }) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/transactions/${transactionId}/settlements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(settlementData)
      });

      if (!response.ok) {
        throw new Error('Failed to create settlement');
      }

      const result = await response.json();
      console.log('Settlement created successfully:', result);
      
      // REMOVED: The forced reload that was previously here
      // Instead, we rely on the 'settlementCreated' WebSocket event 
      // to update the state automatically, avoiding feedback loops
      
      return { success: true, data: result };
    } catch (error) {
      console.error('Error creating settlement:', error);
      return { success: false, error: error.message };
    }
  };

  // Load initial transactions
  const loadTransactions = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/transactions`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  // Load transactions on component mount
  useEffect(() => {
    loadTransactions();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return '#28a745';
      case 'partial': return '#ffc107';
      case 'unpaid': return '#dc3545';
      default: return '#6c757d';
    }
  };

  return (
    <div className="transaction-management">
      <h2>Transaction Management</h2>
      <p>WebSocket Status: {socket?.connected ? '🟢 Connected' : '🔴 Disconnected'}</p>
      
      <div className="transactions-grid">
        {transactions.map(transaction => (
          <div key={transaction.id} className="transaction-card">
            <div className="transaction-header">
              <h3>#{transaction.or_number}</h3>
              <span 
                className="status-badge"
                style={{ backgroundColor: getStatusColor(transaction.payment_status) }}
              >
                {transaction.payment_status.toUpperCase()}
              </span>
            </div>
            
            <div className="transaction-details">
              <p><strong>Customer:</strong> {transaction.customer_name || 'Unknown'}</p>
              <p><strong>Total Amount:</strong> {formatCurrency(transaction.amount)}</p>
              <p><strong>Paid Amount:</strong> {formatCurrency(transaction.paid_amount)}</p>
              <p><strong>Balance:</strong> {formatCurrency(transaction.balance_amount)}</p>
              <p><strong>Sales Agent:</strong> {transaction.sales_agent_name || 'Unknown'}</p>
            </div>
            
            {transaction.balance_amount > 0 && (
              <div className="settlement-form">
                <h4>Add Payment</h4>
                <button 
                  onClick={() => handleConfirmSettlement(transaction.id, {
                    amount: Math.min(500, transaction.balance_amount),
                    payment_mode: 'cash',
                    cashier_id: 1,
                    notes: 'Partial payment'
                  })}
                  className="btn btn-primary"
                >
                  Add ₱500 Payment
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="processed-settlements">
        <h3>Processed Settlement IDs</h3>
        <p>Count: {processedSettlementIds.size}</p>
        <small>This safeguard prevents duplicate processing of settlement events</small>
      </div>

      <style jsx>{`
        .transaction-management {
          padding: 20px;
        }
        
        .transactions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        
        .transaction-card {
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 16px;
          background: white;
        }
        
        .transaction-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        
        .status-badge {
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }
        
        .transaction-details p {
          margin: 8px 0;
        }
        
        .settlement-form {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #eee;
        }
        
        .btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .btn:hover {
          background: #0056b3;
        }
        
        .processed-settlements {
          margin-top: 30px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
};

export default TransactionManagement;
