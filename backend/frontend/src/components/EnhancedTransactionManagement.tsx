import React, { useState, useEffect } from 'react';

// Payment Mode enum to match backend
enum PaymentMode {
  GCASH = 'gcash',
  MAYA = 'maya', 
  BANK_TRANSFER = 'bank_transfer',
  CREDIT_CARD = 'credit_card',
  CASH = 'cash'
}

interface PaymentModeData {
  amount: number;
  count: number;
}

interface DailySummary {
  totalAmount: number;
  totalTransactions: number;
  paymentModeBreakdown: Record<PaymentMode, PaymentModeData>;
  salesAgentBreakdown: Array<{ agent_name: string; amount: number; count: number }>;
}

interface EnhancedTransactionManagementProps {
  summary?: DailySummary;
}

const EnhancedTransactionManagement: React.FC<EnhancedTransactionManagementProps> = ({ 
  summary 
}) => {
  const [transactionData, setTransactionData] = useState<DailySummary | null>(null);

  useEffect(() => {
    if (summary) {
      setTransactionData(summary);
    }
  }, [summary]);

  // Helper function to safely get payment mode breakdown data with defensive conversion
  const getPaymentModeAmount = (mode: PaymentMode): number => {
    if (!transactionData?.paymentModeBreakdown) return 0;
    const value = transactionData.paymentModeBreakdown[mode]?.amount;
    return Number(value) || 0;
  };

  const getPaymentModeCount = (mode: PaymentMode): number => {
    if (!transactionData?.paymentModeBreakdown) return 0;
    const value = transactionData.paymentModeBreakdown[mode]?.count;
    return Number(value) || 0;
  };

  // Helper function to format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  if (!transactionData) {
    return <div>Loading transaction data...</div>;
  }

  return (
    <div className="enhanced-transaction-management">
      <h2>Enhanced Transaction Management</h2>
      
      {/* Summary Section */}
      <div className="summary-section">
        <h3>Daily Summary</h3>
        <div className="summary-cards">
          <div className="summary-card">
            <h4>Total Amount</h4>
            <p>{formatCurrency(Number(transactionData.totalAmount) || 0)}</p>
          </div>
          <div className="summary-card">
            <h4>Total Transactions</h4>
            <p>{Number(transactionData.totalTransactions) || 0}</p>
          </div>
        </div>
      </div>

      {/* Payment Mode Breakdown */}
      <div className="payment-mode-section">
        <h3>Payment Mode Breakdown</h3>
        <div className="payment-mode-grid">
          {Object.values(PaymentMode).map((mode) => {
            const amount = getPaymentModeAmount(mode);
            const count = getPaymentModeCount(mode);
            
            return (
              <div key={mode} className="payment-mode-card">
                <h4>{mode.toUpperCase().replace('_', ' ')}</h4>
                <div className="payment-mode-stats">
                  <p className="amount">
                    <span>Amount: </span>
                    {formatCurrency(amount)}
                  </p>
                  <p className="count">
                    <span>Count: </span>
                    {count}
                  </p>
                  <p className="average">
                    <span>Avg: </span>
                    {count > 0 ? formatCurrency(amount / count) : formatCurrency(0)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sales Agent Breakdown */}
      <div className="sales-agent-section">
        <h3>Sales Agent Breakdown</h3>
        <div className="sales-agent-list">
          {transactionData.salesAgentBreakdown?.map((agent, index) => (
            <div key={index} className="sales-agent-card">
              <h4>{agent.agent_name || 'Unknown Agent'}</h4>
              <div className="agent-stats">
                <p className="amount">
                  <span>Amount: </span>
                  {formatCurrency(Number(agent.amount) || 0)}
                </p>
                <p className="count">
                  <span>Transactions: </span>
                  {Number(agent.count) || 0}
                </p>
                <p className="average">
                  <span>Avg per Transaction: </span>
                  {(Number(agent.count) || 0) > 0 
                    ? formatCurrency((Number(agent.amount) || 0) / (Number(agent.count) || 1))
                    : formatCurrency(0)
                  }
                </p>
              </div>
            </div>
          )) || <p>No sales agent data available</p>}
        </div>
      </div>

      {/* Payment Mode Analysis */}
      <div className="analysis-section">
        <h3>Payment Analysis</h3>
        <div className="analysis-grid">
          <div className="analysis-card">
            <h4>Most Popular Payment Method</h4>
            <p>
              {Object.values(PaymentMode).reduce((max, mode) => 
                getPaymentModeCount(mode) > getPaymentModeCount(max) ? mode : max
              ).toUpperCase().replace('_', ' ')}
            </p>
            <span className="stat-detail">
              {getPaymentModeCount(
                Object.values(PaymentMode).reduce((max, mode) => 
                  getPaymentModeCount(mode) > getPaymentModeCount(max) ? mode : max
                )
              )} transactions
            </span>
          </div>
          
          <div className="analysis-card">
            <h4>Highest Revenue Method</h4>
            <p>
              {Object.values(PaymentMode).reduce((max, mode) => 
                getPaymentModeAmount(mode) > getPaymentModeAmount(max) ? mode : max
              ).toUpperCase().replace('_', ' ')}
            </p>
            <span className="stat-detail">
              {formatCurrency(getPaymentModeAmount(
                Object.values(PaymentMode).reduce((max, mode) => 
                  getPaymentModeAmount(mode) > getPaymentModeAmount(max) ? mode : max
                )
              ))}
            </span>
          </div>
          
          <div className="analysis-card">
            <h4>Digital vs Cash</h4>
            <p>
              Digital: {formatCurrency(
                getPaymentModeAmount(PaymentMode.GCASH) + 
                getPaymentModeAmount(PaymentMode.MAYA) + 
                getPaymentModeAmount(PaymentMode.BANK_TRANSFER) + 
                getPaymentModeAmount(PaymentMode.CREDIT_CARD)
              )}
            </p>
            <p>
              Cash: {formatCurrency(getPaymentModeAmount(PaymentMode.CASH))}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedTransactionManagement;
