import { QueueStatus } from '../types';
/**
 * Validates a queue status and provides fallback for unknown values
 * @param status - The status to validate
 * @returns Valid QueueStatus, defaults to 'waiting' for unknown values
 */
export declare function validateAndFallbackQueueStatus(status: string | undefined | null): QueueStatus;
/**
 * Validates queue status for database operations
 * @param status - The status to validate
 * @returns Status or 'waiting' as fallback
 */
export declare function validateQueueStatusForDB(status: string | undefined | null): string;
/**
 * Check if a status is a valid queue status
 * @param status - The status to check
 * @returns boolean indicating if status is valid
 */
export declare function isValidQueueStatus(status: string): boolean;
/**
 * Get all valid queue statuses
 * @returns Array of valid queue status strings
 */
export declare function getValidQueueStatuses(): string[];
/**
 * Normalize status display for frontend components
 * @param status - The status to normalize
 * @returns Normalized status with fallback indicator if needed
 */
export declare function normalizeStatusForDisplay(status: string | undefined | null): {
    status: QueueStatus;
    isFallback: boolean;
    displayText: string;
};
/**
 * Middleware helper for validating queue status in API requests
 * @param status - Status from request
 * @returns Validated status with warnings
 */
export declare function validateApiQueueStatus(status: string): {
    validStatus: QueueStatus;
    hasWarning: boolean;
    warningMessage?: string;
};
//# sourceMappingURL=queueStatusValidation.d.ts.map