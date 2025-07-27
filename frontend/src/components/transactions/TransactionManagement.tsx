import React, { useState } from 'react';
import { 
  Typography, 
  Box, 
  Card, 
  CardContent, 
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  useTheme,
  useMediaQuery,
  Stack
} from '@mui/material';
import { Receipt as ReceiptIcon } from '@mui/icons-material';

const TransactionManagement: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Mock data for demonstration
  const [transactions] = useState([
    {
      id: 1,
      or_number: '20250108-001',
      amount: 1500,
      payment_mode: 'gcash',
      transaction_date: '2025-07-08',
      customer_name: 'John Doe'
    },
    {
      id: 2,
      or_number: '20250108-002',
      amount: 2500,
      payment_mode: 'credit_card',
      transaction_date: '2025-07-08',
      customer_name: 'Jane Smith'
    },
    {
      id: 3,
      or_number: '20250108-003',
      amount: 3500,
      payment_mode: 'cash',
      transaction_date: '2025-07-08',
      customer_name: 'Maria Garcia'
    }
  ]);

  const getPaymentModeLabel = (mode: string) => {
    switch (mode) {
      case 'gcash': return 'Gcash';
      case 'maya': return 'Maya';
      case 'bank_transfer': return 'Bank Transfer';
      case 'credit_card': return 'Credit Card';
      case 'cash': return 'Cash';
      default: return 'Unknown';
    }
  };

  const getPaymentModeColor = (mode: string) => {
    switch (mode) {
      case 'gcash': return 'primary';
      case 'maya': return 'secondary';
      case 'bank_transfer': return 'info';
      case 'credit_card': return 'warning';
      case 'cash': return 'success';
      default: return 'default';
    }
  };

  const renderMobileTransactionCard = (transaction: any) => (
    <Card key={transaction.id} sx={{ mb: 2 }}>
      <CardContent>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Typography variant="h6" component="div">
              {transaction.or_number}
            </Typography>
            <Chip 
              label={getPaymentModeLabel(transaction.payment_mode)}
              color={getPaymentModeColor(transaction.payment_mode) as any}
              size="small"
            />
          </Box>
          
          <Box>
            <Typography variant="body2" color="text.secondary">
              Customer
            </Typography>
            <Typography variant="body1">
              {transaction.customer_name}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Amount
              </Typography>
              <Typography variant="h6" color="primary">
                ₱{transaction.amount.toLocaleString()}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" color="text.secondary">
                Date
              </Typography>
              <Typography variant="body1">
                {transaction.transaction_date}
              </Typography>
            </Box>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <Box sx={{ p: 2 }}>
        <Typography 
          variant="h4" 
          gutterBottom
          sx={{ 
            fontSize: { xs: '1.5rem', sm: '2.125rem' },
            fontWeight: 400,
            lineHeight: 1.235
          }}
        >
          Transaction Management
        </Typography>

      {/* Transactions */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Transactions
          </Typography>

          {isMobile ? (
            // Mobile view - Cards
            <Box>
              {transactions.map(renderMobileTransactionCard)}
            </Box>
          ) : (
            // Desktop view - Table
            <TableContainer component={Paper} elevation={0} sx={{ overflowX: 'auto' }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>OR Number</TableCell>
                    <TableCell>Customer Name</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Payment Mode</TableCell>
                    <TableCell>Transaction Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{transaction.or_number}</TableCell>
                      <TableCell>{transaction.customer_name}</TableCell>
                      <TableCell>₱{transaction.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Chip 
                          label={getPaymentModeLabel(transaction.payment_mode)}
                          color={getPaymentModeColor(transaction.payment_mode) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{transaction.transaction_date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {transactions.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <ReceiptIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No transactions recorded
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Transactions will appear here once recorded
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
      </Box>
    </div>
  );
};

export default TransactionManagement;
