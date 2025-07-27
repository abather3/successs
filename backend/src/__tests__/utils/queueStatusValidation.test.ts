import { 
  validateAndFallbackQueueStatus,
  validateQueueStatusForDB,
  isValidQueueStatus,
  normalizeStatusForDisplay,
  validateApiQueueStatus,
  getValidQueueStatuses
} from '../../utils/queueStatusValidation';
import { QueueStatus } from '../../types';

describe('Queue Status Validation', () => {
  
  describe('validateAndFallbackQueueStatus', () => {
    it('should return valid status unchanged', () => {
      expect(validateAndFallbackQueueStatus('waiting')).toBe(QueueStatus.WAITING);
      expect(validateAndFallbackQueueStatus('serving')).toBe(QueueStatus.SERVING);
      expect(validateAndFallbackQueueStatus('completed')).toBe(QueueStatus.COMPLETED);
      expect(validateAndFallbackQueueStatus('cancelled')).toBe(QueueStatus.CANCELLED);
    });

    it('should handle case insensitive input', () => {
      expect(validateAndFallbackQueueStatus('WAITING')).toBe(QueueStatus.WAITING);
      expect(validateAndFallbackQueueStatus('Serving')).toBe(QueueStatus.SERVING);
      expect(validateAndFallbackQueueStatus('COMPLETED')).toBe(QueueStatus.COMPLETED);
    });

    it('should trim whitespace from input', () => {
      expect(validateAndFallbackQueueStatus('  waiting  ')).toBe(QueueStatus.WAITING);
      expect(validateAndFallbackQueueStatus('\tserving\n')).toBe(QueueStatus.SERVING);
    });

    it('should fallback to waiting for null/undefined', () => {
      expect(validateAndFallbackQueueStatus(null)).toBe(QueueStatus.WAITING);
      expect(validateAndFallbackQueueStatus(undefined)).toBe(QueueStatus.WAITING);
    });

    it('should fallback to waiting for unknown status', () => {
      expect(validateAndFallbackQueueStatus('unknown_status')).toBe(QueueStatus.WAITING);
      expect(validateAndFallbackQueueStatus('invalid')).toBe(QueueStatus.WAITING);
      expect(validateAndFallbackQueueStatus('processing')).toBe(QueueStatus.WAITING);
    });

    it('should fallback to waiting for empty string', () => {
      expect(validateAndFallbackQueueStatus('')).toBe(QueueStatus.WAITING);
      expect(validateAndFallbackQueueStatus('   ')).toBe(QueueStatus.WAITING);
    });
  });

  describe('isValidQueueStatus', () => {
    it('should return true for valid statuses', () => {
      expect(isValidQueueStatus('waiting')).toBe(true);
      expect(isValidQueueStatus('serving')).toBe(true);
      expect(isValidQueueStatus('completed')).toBe(true);
      expect(isValidQueueStatus('cancelled')).toBe(true);
    });

    it('should handle case insensitive validation', () => {
      expect(isValidQueueStatus('WAITING')).toBe(true);
      expect(isValidQueueStatus('Serving')).toBe(true);
    });

    it('should return false for invalid statuses', () => {
      expect(isValidQueueStatus('unknown')).toBe(false);
      expect(isValidQueueStatus('invalid')).toBe(false);
      expect(isValidQueueStatus('')).toBe(false);
      expect(isValidQueueStatus('processing')).toBe(false);
    });
  });

  describe('normalizeStatusForDisplay', () => {
    it('should return correct display info for valid status', () => {
      const result = normalizeStatusForDisplay('waiting');
      expect(result.status).toBe(QueueStatus.WAITING);
      expect(result.isFallback).toBe(false);
      expect(result.displayText).toBe('WAITING');
    });

    it('should return fallback info for invalid status', () => {
      const result = normalizeStatusForDisplay('unknown');
      expect(result.status).toBe(QueueStatus.WAITING);
      expect(result.isFallback).toBe(true);
      expect(result.displayText).toBe('Waiting (Was: unknown)');
    });

    it('should handle null/undefined gracefully', () => {
      const result = normalizeStatusForDisplay(null);
      expect(result.status).toBe(QueueStatus.WAITING);
      expect(result.isFallback).toBe(true);
      expect(result.displayText).toBe('Waiting (Unknown)');
    });
  });

  describe('validateApiQueueStatus', () => {
    it('should validate and warn for invalid status', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = validateApiQueueStatus('invalid_status');
      
      expect(result.validStatus).toBe(QueueStatus.WAITING);
      expect(result.hasWarning).toBe(true);
      expect(result.warningMessage).toContain('Invalid queue status');
      
      consoleSpy.mockRestore();
    });

    it('should not warn for valid status', () => {
      const result = validateApiQueueStatus('waiting');
      
      expect(result.validStatus).toBe(QueueStatus.WAITING);
      expect(result.hasWarning).toBe(false);
      expect(result.warningMessage).toBeUndefined();
    });
  });

  describe('getValidQueueStatuses', () => {
    it('should return all valid queue statuses', () => {
      const statuses = getValidQueueStatuses();
      expect(statuses).toEqual(['waiting', 'serving', 'completed', 'cancelled']);
    });

    it('should return a copy of the array', () => {
      const statuses1 = getValidQueueStatuses();
      const statuses2 = getValidQueueStatuses();
      expect(statuses1).not.toBe(statuses2);
    });
  });

  describe('validateQueueStatusForDB', () => {
    it('should return valid status for database operations', () => {
      expect(validateQueueStatusForDB('waiting')).toBe('waiting');
      expect(validateQueueStatusForDB('serving')).toBe('serving');
    });

    it('should return waiting for invalid status', () => {
      expect(validateQueueStatusForDB('invalid')).toBe('waiting');
      expect(validateQueueStatusForDB(null)).toBe('waiting');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle legacy data migration scenario', () => {
      const legacyStatuses = ['processing', 'pending', 'in_progress', null, undefined, ''];
      
      legacyStatuses.forEach(status => {
        const validated = validateAndFallbackQueueStatus(status as any);
        expect(validated).toBe(QueueStatus.WAITING);
      });
    });

    it('should handle API response with mixed valid/invalid statuses', () => {
      const apiResponses = [
        { id: 1, queue_status: 'waiting' },
        { id: 2, queue_status: 'invalid_status' },
        { id: 3, queue_status: 'serving' },
        { id: 4, queue_status: null }
      ];

      const processed = apiResponses.map(response => ({
        ...response,
        queue_status: validateAndFallbackQueueStatus(response.queue_status as any)
      }));

      expect(processed[0].queue_status).toBe(QueueStatus.WAITING);
      expect(processed[1].queue_status).toBe(QueueStatus.WAITING); // Fallback
      expect(processed[2].queue_status).toBe(QueueStatus.SERVING);
      expect(processed[3].queue_status).toBe(QueueStatus.WAITING); // Fallback
    });
  });

  describe('Error logging and monitoring', () => {
    it('should log warnings for unknown statuses', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      validateAndFallbackQueueStatus('unknown_status');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown status "unknown_status" encountered')
      );
      
      consoleSpy.mockRestore();
    });

    it('should log production alerts for unknown statuses', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      validateAndFallbackQueueStatus('unknown_status');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[UNKNOWN_STATUS_ALERT] Status: unknown_status')
      );
      
      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });
  });
});
