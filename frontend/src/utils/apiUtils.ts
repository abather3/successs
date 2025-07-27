import TransactionApi, { ApiOptions } from '../services/transactionApi';
import { Transaction } from '../types';

/**
 * Utility function to safely call TransactionApi.getTransaction with Snackbar error handling
 * @param id - The transaction ID
 * @param showErrorSnackbar - Function to show error snackbar
 * @returns Promise<Transaction> or throws error
 */
export const getTransactionWithSnackbar = async (
  id: number,
  showErrorSnackbar: (message: string) => void
): Promise<Transaction> => {
  const apiOptions: ApiOptions = {
    onError: (error: Error) => {
      // Show snackbar error for validation errors and other API errors
      if (error.message.includes('Invalid transaction ID')) {
        showErrorSnackbar('Please provide a valid transaction ID');
      } else if (error.message !== 'NOT_FOUND') {
        showErrorSnackbar(`Error loading transaction: ${error.message}`);
      }
    }
  };

  return TransactionApi.getTransaction(id, apiOptions);
};

/**
 * Validates that a value is a valid number for transaction ID
 * @param id - The ID to validate
 * @returns boolean indicating if ID is valid
 */
export const isValidTransactionId = (id: any): id is number => {
  return typeof id === 'number' && !Number.isNaN(id);
};
