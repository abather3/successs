"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const queueStatusValidation_1 = require("../../utils/queueStatusValidation");
const types_1 = require("../../types");
describe('Queue Status Validation', () => {
    describe('validateAndFallbackQueueStatus', () => {
        it('should return valid status unchanged', () => {
            expect((0, queueStatusValidation_1.validateAndFallbackQueueStatus)('waiting')).toBe(types_1.QueueStatus.WAITING);
            expect((0, queueStatusValidation_1.validateAndFallbackQueueStatus)('serving')).toBe(types_1.QueueStatus.SERVING);
            expect((0, queueStatusValidation_1.validateAndFallbackQueueStatus)('completed')).toBe(types_1.QueueStatus.COMPLETED);
            expect((0, queueStatusValidation_1.validateAndFallbackQueueStatus)('cancelled')).toBe(types_1.QueueStatus.CANCELLED);
        });
        it('should handle case insensitive input', () => {
            expect((0, queueStatusValidation_1.validateAndFallbackQueueStatus)('WAITING')).toBe(types_1.QueueStatus.WAITING);
            expect((0, queueStatusValidation_1.validateAndFallbackQueueStatus)('Serving')).toBe(types_1.QueueStatus.SERVING);
            expect((0, queueStatusValidation_1.validateAndFallbackQueueStatus)('COMPLETED')).toBe(types_1.QueueStatus.COMPLETED);
        });
        it('should trim whitespace from input', () => {
            expect((0, queueStatusValidation_1.validateAndFallbackQueueStatus)('  waiting  ')).toBe(types_1.QueueStatus.WAITING);
            expect((0, queueStatusValidation_1.validateAndFallbackQueueStatus)('\tserving\n')).toBe(types_1.QueueStatus.SERVING);
        });
        it('should fallback to waiting for null/undefined', () => {
            expect((0, queueStatusValidation_1.validateAndFallbackQueueStatus)(null)).toBe(types_1.QueueStatus.WAITING);
            expect((0, queueStatusValidation_1.validateAndFallbackQueueStatus)(undefined)).toBe(types_1.QueueStatus.WAITING);
        });
        it('should fallback to waiting for unknown status', () => {
            expect((0, queueStatusValidation_1.validateAndFallbackQueueStatus)('unknown_status')).toBe(types_1.QueueStatus.WAITING);
            expect((0, queueStatusValidation_1.validateAndFallbackQueueStatus)('invalid')).toBe(types_1.QueueStatus.WAITING);
            expect((0, queueStatusValidation_1.validateAndFallbackQueueStatus)('processing')).toBe(types_1.QueueStatus.WAITING);
        });
        it('should fallback to waiting for empty string', () => {
            expect((0, queueStatusValidation_1.validateAndFallbackQueueStatus)('')).toBe(types_1.QueueStatus.WAITING);
            expect((0, queueStatusValidation_1.validateAndFallbackQueueStatus)('   ')).toBe(types_1.QueueStatus.WAITING);
        });
    });
    describe('isValidQueueStatus', () => {
        it('should return true for valid statuses', () => {
            expect((0, queueStatusValidation_1.isValidQueueStatus)('waiting')).toBe(true);
            expect((0, queueStatusValidation_1.isValidQueueStatus)('serving')).toBe(true);
            expect((0, queueStatusValidation_1.isValidQueueStatus)('completed')).toBe(true);
            expect((0, queueStatusValidation_1.isValidQueueStatus)('cancelled')).toBe(true);
        });
        it('should handle case insensitive validation', () => {
            expect((0, queueStatusValidation_1.isValidQueueStatus)('WAITING')).toBe(true);
            expect((0, queueStatusValidation_1.isValidQueueStatus)('Serving')).toBe(true);
        });
        it('should return false for invalid statuses', () => {
            expect((0, queueStatusValidation_1.isValidQueueStatus)('unknown')).toBe(false);
            expect((0, queueStatusValidation_1.isValidQueueStatus)('invalid')).toBe(false);
            expect((0, queueStatusValidation_1.isValidQueueStatus)('')).toBe(false);
            expect((0, queueStatusValidation_1.isValidQueueStatus)('processing')).toBe(false);
        });
    });
    describe('normalizeStatusForDisplay', () => {
        it('should return correct display info for valid status', () => {
            const result = (0, queueStatusValidation_1.normalizeStatusForDisplay)('waiting');
            expect(result.status).toBe(types_1.QueueStatus.WAITING);
            expect(result.isFallback).toBe(false);
            expect(result.displayText).toBe('WAITING');
        });
        it('should return fallback info for invalid status', () => {
            const result = (0, queueStatusValidation_1.normalizeStatusForDisplay)('unknown');
            expect(result.status).toBe(types_1.QueueStatus.WAITING);
            expect(result.isFallback).toBe(true);
            expect(result.displayText).toBe('Waiting (Was: unknown)');
        });
        it('should handle null/undefined gracefully', () => {
            const result = (0, queueStatusValidation_1.normalizeStatusForDisplay)(null);
            expect(result.status).toBe(types_1.QueueStatus.WAITING);
            expect(result.isFallback).toBe(true);
            expect(result.displayText).toBe('Waiting (Unknown)');
        });
    });
    describe('validateApiQueueStatus', () => {
        it('should validate and warn for invalid status', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            const result = (0, queueStatusValidation_1.validateApiQueueStatus)('invalid_status');
            expect(result.validStatus).toBe(types_1.QueueStatus.WAITING);
            expect(result.hasWarning).toBe(true);
            expect(result.warningMessage).toContain('Invalid queue status');
            consoleSpy.mockRestore();
        });
        it('should not warn for valid status', () => {
            const result = (0, queueStatusValidation_1.validateApiQueueStatus)('waiting');
            expect(result.validStatus).toBe(types_1.QueueStatus.WAITING);
            expect(result.hasWarning).toBe(false);
            expect(result.warningMessage).toBeUndefined();
        });
    });
    describe('getValidQueueStatuses', () => {
        it('should return all valid queue statuses', () => {
            const statuses = (0, queueStatusValidation_1.getValidQueueStatuses)();
            expect(statuses).toEqual(['waiting', 'serving', 'completed', 'cancelled']);
        });
        it('should return a copy of the array', () => {
            const statuses1 = (0, queueStatusValidation_1.getValidQueueStatuses)();
            const statuses2 = (0, queueStatusValidation_1.getValidQueueStatuses)();
            expect(statuses1).not.toBe(statuses2);
        });
    });
    describe('validateQueueStatusForDB', () => {
        it('should return valid status for database operations', () => {
            expect((0, queueStatusValidation_1.validateQueueStatusForDB)('waiting')).toBe('waiting');
            expect((0, queueStatusValidation_1.validateQueueStatusForDB)('serving')).toBe('serving');
        });
        it('should return waiting for invalid status', () => {
            expect((0, queueStatusValidation_1.validateQueueStatusForDB)('invalid')).toBe('waiting');
            expect((0, queueStatusValidation_1.validateQueueStatusForDB)(null)).toBe('waiting');
        });
    });
    describe('Integration scenarios', () => {
        it('should handle legacy data migration scenario', () => {
            const legacyStatuses = ['processing', 'pending', 'in_progress', null, undefined, ''];
            legacyStatuses.forEach(status => {
                const validated = (0, queueStatusValidation_1.validateAndFallbackQueueStatus)(status);
                expect(validated).toBe(types_1.QueueStatus.WAITING);
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
                queue_status: (0, queueStatusValidation_1.validateAndFallbackQueueStatus)(response.queue_status)
            }));
            expect(processed[0].queue_status).toBe(types_1.QueueStatus.WAITING);
            expect(processed[1].queue_status).toBe(types_1.QueueStatus.WAITING); // Fallback
            expect(processed[2].queue_status).toBe(types_1.QueueStatus.SERVING);
            expect(processed[3].queue_status).toBe(types_1.QueueStatus.WAITING); // Fallback
        });
    });
    describe('Error logging and monitoring', () => {
        it('should log warnings for unknown statuses', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            (0, queueStatusValidation_1.validateAndFallbackQueueStatus)('unknown_status');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown status "unknown_status" encountered'));
            consoleSpy.mockRestore();
        });
        it('should log production alerts for unknown statuses', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            (0, queueStatusValidation_1.validateAndFallbackQueueStatus)('unknown_status');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[UNKNOWN_STATUS_ALERT] Status: unknown_status'));
            consoleSpy.mockRestore();
            process.env.NODE_ENV = originalEnv;
        });
    });
});
//# sourceMappingURL=queueStatusValidation.test.js.map