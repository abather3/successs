"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAndFallbackQueueStatus = validateAndFallbackQueueStatus;
exports.validateQueueStatusForDB = validateQueueStatusForDB;
exports.isValidQueueStatus = isValidQueueStatus;
exports.getValidQueueStatuses = getValidQueueStatuses;
exports.normalizeStatusForDisplay = normalizeStatusForDisplay;
exports.validateApiQueueStatus = validateApiQueueStatus;
const types_1 = require("../types");
/**
 * Valid queue status values
 */
const VALID_QUEUE_STATUSES = [
    'waiting',
    'serving',
    'processing',
    'completed',
    'cancelled'
];
/**
 * Validates a queue status and provides fallback for unknown values
 * @param status - The status to validate
 * @returns Valid QueueStatus, defaults to 'waiting' for unknown values
 */
function validateAndFallbackQueueStatus(status) {
    if (!status) {
        console.warn('QueueStatus validation: Received null/undefined status, falling back to "waiting"');
        return types_1.QueueStatus.WAITING;
    }
    const normalizedStatus = status.toLowerCase().trim();
    if (VALID_QUEUE_STATUSES.includes(normalizedStatus)) {
        return normalizedStatus;
    }
    // Log unknown status for monitoring
    console.warn(`QueueStatus validation: Unknown status "${status}" encountered, falling back to "waiting"`);
    // Emit metrics or alert for monitoring unknown statuses
    // This could be expanded to send to monitoring service
    if (process.env.NODE_ENV === 'production') {
        console.error(`[UNKNOWN_STATUS_ALERT] Status: ${status}, Timestamp: ${new Date().toISOString()}`);
    }
    return types_1.QueueStatus.WAITING;
}
/**
 * Validates queue status for database operations
 * @param status - The status to validate
 * @returns Status or 'waiting' as fallback
 */
function validateQueueStatusForDB(status) {
    const validatedStatus = validateAndFallbackQueueStatus(status);
    return validatedStatus;
}
/**
 * Check if a status is a valid queue status
 * @param status - The status to check
 * @returns boolean indicating if status is valid
 */
function isValidQueueStatus(status) {
    return VALID_QUEUE_STATUSES.includes(status.toLowerCase().trim());
}
/**
 * Get all valid queue statuses
 * @returns Array of valid queue status strings
 */
function getValidQueueStatuses() {
    return [...VALID_QUEUE_STATUSES];
}
/**
 * Normalize status display for frontend components
 * @param status - The status to normalize
 * @returns Normalized status with fallback indicator if needed
 */
function normalizeStatusForDisplay(status) {
    if (!status) {
        return {
            status: types_1.QueueStatus.WAITING,
            isFallback: true,
            displayText: 'Waiting (Unknown)'
        };
    }
    const normalizedStatus = status.toLowerCase().trim();
    const isValid = VALID_QUEUE_STATUSES.includes(normalizedStatus);
    return {
        status: isValid ? normalizedStatus : types_1.QueueStatus.WAITING,
        isFallback: !isValid,
        displayText: isValid ? normalizedStatus.toUpperCase() : `Waiting (Was: ${status})`
    };
}
/**
 * Middleware helper for validating queue status in API requests
 * @param status - Status from request
 * @returns Validated status with warnings
 */
function validateApiQueueStatus(status) {
    const validatedStatus = validateAndFallbackQueueStatus(status);
    const isOriginalValid = isValidQueueStatus(status);
    return {
        validStatus: validatedStatus,
        hasWarning: !isOriginalValid,
        warningMessage: !isOriginalValid ?
            `Invalid queue status '${status}' provided, defaulted to '${validatedStatus}'` :
            undefined
    };
}
//# sourceMappingURL=queueStatusValidation.js.map