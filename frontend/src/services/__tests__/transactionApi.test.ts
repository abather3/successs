import TransactionApi, { ApiOptions } from '../transactionApi';
import { getTransactionWithSnackbar, isValidTransactionId } from '../../utils/apiUtils';

// Mock fetch globally
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('TransactionApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('mock-token');
  });

  describe('getTransaction parameter validation', () => {
    it('should throw error for NaN values', async () => {
      const onError = jest.fn();
      const apiOptions: ApiOptions = { onError };

      await expect(TransactionApi.getTransaction(NaN, apiOptions)).rejects.toThrow(
        'Invalid transaction ID: must be a valid number'
      );

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid transaction ID: must be a valid number'
        })
      );
    });

    it('should throw error for non-number types', async () => {
      const onError = jest.fn();
      const apiOptions: ApiOptions = { onError };

      // Test string
      await expect(TransactionApi.getTransaction('123' as any, apiOptions)).rejects.toThrow(
        'Invalid transaction ID: must be a valid number'
      );

      // Test null
      await expect(TransactionApi.getTransaction(null as any, apiOptions)).rejects.toThrow(
        'Invalid transaction ID: must be a valid number'
      );

      // Test undefined
      await expect(TransactionApi.getTransaction(undefined as any, apiOptions)).rejects.toThrow(
        'Invalid transaction ID: must be a valid number'
      );

      // Test object
      await expect(TransactionApi.getTransaction({} as any, apiOptions)).rejects.toThrow(
        'Invalid transaction ID: must be a valid number'
      );

      // Test array
      await expect(TransactionApi.getTransaction([] as any, apiOptions)).rejects.toThrow(
        'Invalid transaction ID: must be a valid number'
      );
    });

    it('should accept valid number values', async () => {
      const mockResponse = { 
        ok: true, 
        json: jest.fn().mockResolvedValue({ id: 123, amount: 100 }) 
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      // Test positive integer
      await expect(TransactionApi.getTransaction(123)).resolves.toEqual({ id: 123, amount: 100 });

      // Test positive decimal (though not typical for IDs, should still pass type validation)
      await expect(TransactionApi.getTransaction(123.0)).resolves.toEqual({ id: 123, amount: 100 });
    });

    it('should call onError callback when validation fails', async () => {
      const onError = jest.fn();
      const apiOptions: ApiOptions = { onError };

      await expect(TransactionApi.getTransaction(NaN, apiOptions)).rejects.toThrow();
      
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid transaction ID: must be a valid number'
        })
      );
    });

    it('should not make HTTP request when validation fails', async () => {
      const onError = jest.fn();
      const apiOptions: ApiOptions = { onError };

      await expect(TransactionApi.getTransaction(NaN, apiOptions)).rejects.toThrow();
      
      // Fetch should not be called when validation fails
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases that could produce NaN', () => {
    const testCases = [
      { input: parseInt('invalid'), description: 'parseInt("invalid")' },
      { input: Number('not-a-number'), description: 'Number("not-a-number")' },
      { input: 0 / 0, description: '0 / 0' },
      { input: Math.sqrt(-1), description: 'Math.sqrt(-1)' },
      { input: Infinity - Infinity, description: 'Infinity - Infinity' },
      { input: parseFloat('xyz'), description: 'parseFloat("xyz")' },
    ];

    testCases.forEach(({ input, description }) => {
      it(`should prevent ${description} from reaching the API`, async () => {
        const onError = jest.fn();
        const apiOptions: ApiOptions = { onError };

        await expect(TransactionApi.getTransaction(input, apiOptions)).rejects.toThrow(
          'Invalid transaction ID: must be a valid number'
        );

        expect(global.fetch).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalled();
      });
    });
  });
});

describe('API Utils', () => {
  describe('isValidTransactionId', () => {
    it('should return true for valid numbers', () => {
      expect(isValidTransactionId(1)).toBe(true);
      expect(isValidTransactionId(123)).toBe(true);
      expect(isValidTransactionId(0)).toBe(true);
      expect(isValidTransactionId(-1)).toBe(true);
      expect(isValidTransactionId(123.0)).toBe(true);
    });

    it('should return false for NaN', () => {
      expect(isValidTransactionId(NaN)).toBe(false);
      expect(isValidTransactionId(Number('invalid'))).toBe(false);
      expect(isValidTransactionId(parseInt('xyz'))).toBe(false);
    });

    it('should return false for non-numbers', () => {
      expect(isValidTransactionId('123')).toBe(false);
      expect(isValidTransactionId(null)).toBe(false);
      expect(isValidTransactionId(undefined)).toBe(false);
      expect(isValidTransactionId({})).toBe(false);
      expect(isValidTransactionId([])).toBe(false);
      expect(isValidTransactionId(true)).toBe(false);
    });
  });

  describe('getTransactionWithSnackbar', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should call showErrorSnackbar for invalid transaction ID', async () => {
      const showErrorSnackbar = jest.fn();

      await expect(getTransactionWithSnackbar(NaN, showErrorSnackbar)).rejects.toThrow();
      
      expect(showErrorSnackbar).toHaveBeenCalledWith('Please provide a valid transaction ID');
    });

    it('should call showErrorSnackbar for API errors (not NOT_FOUND)', async () => {
      const showErrorSnackbar = jest.fn();
      const mockResponse = { 
        ok: false, 
        status: 500,
        json: jest.fn().mockResolvedValue({ error: 'Server Error' })
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(getTransactionWithSnackbar(123, showErrorSnackbar)).rejects.toThrow();
      
      expect(showErrorSnackbar).toHaveBeenCalledWith(
        expect.stringContaining('Error loading transaction')
      );
    });

    it('should NOT call showErrorSnackbar for NOT_FOUND errors', async () => {
      const showErrorSnackbar = jest.fn();
      const mockResponse = { 
        ok: false, 
        status: 404,
        json: jest.fn().mockResolvedValue({ error: 'Not Found' })
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(getTransactionWithSnackbar(123, showErrorSnackbar)).rejects.toThrow('NOT_FOUND');
      
      expect(showErrorSnackbar).not.toHaveBeenCalled();
    });

    it('should return transaction data for successful requests', async () => {
      const showErrorSnackbar = jest.fn();
      const mockTransaction = { id: 123, amount: 100, description: 'Test' };
      const mockResponse = { 
        ok: true, 
        json: jest.fn().mockResolvedValue(mockTransaction)
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getTransactionWithSnackbar(123, showErrorSnackbar);
      
      expect(result).toEqual(mockTransaction);
      expect(showErrorSnackbar).not.toHaveBeenCalled();
    });
  });
});
