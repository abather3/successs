import React, { useState } from 'react';
import { Button, TextField, Box, Typography, Paper } from '@mui/material';
import { useNotification } from '../../contexts/NotificationContext';
import { getTransactionWithSnackbar, isValidTransactionId } from '../../utils/apiUtils';
import TransactionApi from '../../services/transactionApi';
import { Transaction } from '../../types';

/**
 * Example component demonstrating improved client-side parameter validation
 * with Snackbar error handling for TransactionApi.getTransaction
 */
const TransactionDetailsExample: React.FC = () => {
  const [transactionId, setTransactionId] = useState<string>('');
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);
  const { error: showErrorSnackbar, success: showSuccessSnackbar } = useNotification();

  // Method 1: Using the utility function with automatic Snackbar handling
  const handleGetTransactionWithUtils = async () => {
    const id = parseFloat(transactionId);
    
    if (!isValidTransactionId(id)) {
      showErrorSnackbar('Please enter a valid numeric transaction ID');
      return;
    }

    setLoading(true);
    try {
      const result = await getTransactionWithSnackbar(id, showErrorSnackbar);
      setTransaction(result);
      showSuccessSnackbar('Transaction loaded successfully');
    } catch (error) {
      if (error instanceof Error && error.message === 'NOT_FOUND') {
        showErrorSnackbar('Transaction not found');
      }
      // Other errors are handled by getTransactionWithSnackbar
    } finally {
      setLoading(false);
    }
  };

  // Method 2: Using TransactionApi directly with manual error handling
  const handleGetTransactionDirect = async () => {
    const id = parseFloat(transactionId);
    
    setLoading(true);
    try {
      const result = await TransactionApi.getTransaction(id, {
        onError: (error: Error) => {
          if (error.message.includes('Invalid transaction ID')) {
            showErrorSnackbar('Please provide a valid transaction ID');
          } else if (error.message !== 'NOT_FOUND') {
            showErrorSnackbar(`Error loading transaction: ${error.message}`);
          }
        }
      });
      setTransaction(result);
      showSuccessSnackbar('Transaction loaded successfully');
    } catch (error) {
      if (error instanceof Error && error.message === 'NOT_FOUND') {
        showErrorSnackbar('Transaction not found');
      }
    } finally {
      setLoading(false);
    }
  };

  // Test various invalid inputs to demonstrate validation
  const testInvalidInputs = () => {
    const testCases = [
      { input: 'NaN', value: NaN, description: 'NaN value' },
      { input: 'Invalid String', value: parseInt('invalid'), description: 'parseInt("invalid")' },
      { input: 'Division by Zero', value: 0 / 0, description: '0/0 result' },
      { input: 'Square Root of -1', value: Math.sqrt(-1), description: 'Math.sqrt(-1)' },
    ];

    testCases.forEach(async ({ input, value, description }) => {
      console.log(`Testing ${description} with value:`, value);
      try {
        await getTransactionWithSnackbar(value, (msg) => {
          console.log(`Snackbar would show: ${msg}`);
          showErrorSnackbar(`${description}: ${msg}`);
        });
      } catch (error) {
        console.log(`Validation caught: ${error}`);
      }
    });
  };

  return (
    <Paper sx={{ p: 3, m: 2 }}>
      <Typography variant="h5" gutterBottom>
        Transaction API Validation Example
      </Typography>
      
      <Typography variant="body2" color="text.secondary" paragraph>
        This component demonstrates improved client-side parameter validation that:
        <br />• Throws early if typeof id !== 'number' || Number.isNaN(id)
        <br />• Shows Snackbar errors instead of firing invalid requests
        <br />• Prevents NaN values from reaching the API
      </Typography>

      <Box sx={{ mb: 3 }}>
        <TextField
          label="Transaction ID"
          value={transactionId}
          onChange={(e) => setTransactionId(e.target.value)}
          placeholder="Enter numeric transaction ID"
          fullWidth
          margin="normal"
          helperText="Try entering: 123, NaN, 'invalid', empty string, etc."
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          onClick={handleGetTransactionWithUtils}
          disabled={loading}
        >
          Get Transaction (Using Utils)
        </Button>
        
        <Button
          variant="outlined"
          onClick={handleGetTransactionDirect}
          disabled={loading}
        >
          Get Transaction (Direct API)
        </Button>
        
        <Button
          variant="text"
          onClick={testInvalidInputs}
          color="warning"
        >
          Test Invalid Inputs
        </Button>
      </Box>

      {loading && (
        <Typography color="primary">Loading...</Typography>
      )}

      {transaction && (
        <Paper sx={{ p: 2, mt: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
          <Typography variant="h6">Transaction Details:</Typography>
          <Typography variant="body2">
            ID: {transaction.id}
          </Typography>
          <Typography variant="body2">
            {/* Add more transaction fields as needed */}
            {JSON.stringify(transaction, null, 2)}
          </Typography>
        </Paper>
      )}
    </Paper>
  );
};

export default TransactionDetailsExample;
