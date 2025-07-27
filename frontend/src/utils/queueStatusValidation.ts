import { QueueStatus, QueueStatusWithFallback } from '../types';

/**
 * Valid queue status values
 */
const VALID_QUEUE_STATUSES: string[] = [
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
export function validateAndFallbackQueueStatus(status: string | undefined | null): QueueStatus {
  if (!status) {
    console.warn('QueueStatus validation: Received null/undefined status, falling back to "waiting"');
    return QueueStatus.WAITING;
  }

  const normalizedStatus = status.toLowerCase().trim();
  
  if (VALID_QUEUE_STATUSES.includes(normalizedStatus)) {
    return normalizedStatus as QueueStatus;
  }

  // Log unknown status for monitoring
  console.warn(`QueueStatus validation: Unknown status "${status}" encountered, falling back to "waiting"`);
  
  // In production, this could trigger analytics or monitoring
  if (process.env.NODE_ENV === 'production') {
    console.error(`[UNKNOWN_STATUS_CLIENT] Status: ${status}, Timestamp: ${new Date().toISOString()}`);
  }

  return QueueStatus.WAITING;
}

/**
 * Check if a status is a valid queue status
 * @param status - The status to check
 * @returns boolean indicating if status is valid
 */
export function isValidQueueStatus(status: string): boolean {
  return VALID_QUEUE_STATUSES.includes(status.toLowerCase().trim());
}

/**
 * Normalize status for display with fallback indicator
 * @param status - The status to normalize
 * @returns QueueStatusWithFallback object with display information
 */
export function normalizeStatusForDisplay(status: string | undefined | null): QueueStatusWithFallback {
  if (!status) {
    return {
      status: QueueStatus.WAITING,
      isFallback: true,
      originalValue: undefined,
      displayText: 'Waiting (Unknown)'
    };
  }

  const normalizedStatus = status.toLowerCase().trim();
  const isValid = VALID_QUEUE_STATUSES.includes(normalizedStatus);
  
  return {
    status: isValid ? (normalizedStatus as QueueStatus) : QueueStatus.WAITING,
    isFallback: !isValid,
    originalValue: isValid ? undefined : status,
    displayText: isValid ? normalizedStatus.toUpperCase() : `Waiting (Was: ${status})`
  };
}

/**
 * Get status color for UI components with fallback handling
 * @param status - The queue status
 * @param isFallback - Whether the status is a fallback
 * @returns Color string for status display
 */
export function getStatusColor(status: QueueStatus, isFallback: boolean = false): 'warning' | 'info' | 'success' | 'error' | 'default' {
  if (isFallback) {
    return 'warning'; // Show fallback statuses with warning color
  }

  switch (status) {
    case QueueStatus.WAITING:
      return 'warning';
    case QueueStatus.SERVING:
      return 'info';
    case QueueStatus.PROCESSING:
      return 'info';
    case QueueStatus.COMPLETED:
      return 'success';
    case QueueStatus.CANCELLED:
      return 'error';
    default:
      return 'default';
  }
}

/**
 * Get human-readable status label
 * @param status - The queue status
 * @param isFallback - Whether the status is a fallback
 * @returns Human-readable status label
 */
export function getStatusLabel(status: QueueStatus, isFallback: boolean = false): string {
  if (isFallback) {
    return `${status.toUpperCase()} (?)`;
  }
  
  return status.toUpperCase();
}

/**
 * Validate queue status from API response and handle gracefully
 * @param apiData - Data from API that might contain queue_status
 * @returns Normalized data with validated queue status
 */
export function validateApiQueueStatus<T extends { queue_status?: string }>(apiData: T): T & { queue_status: QueueStatus } {
  const normalizedStatus = normalizeStatusForDisplay(apiData.queue_status);
  
  // Log warning if fallback was used
  if (normalizedStatus.isFallback && apiData.queue_status) {
    console.warn(`API returned unknown queue_status: "${apiData.queue_status}". Using fallback: "${normalizedStatus.status}"`);
  }
  
  return {
    ...apiData,
    queue_status: normalizedStatus.status
  };
}

/**
 * Validate queue status for filtering operations
 * @param status - Status to validate for filtering
 * @returns Validated status or null if invalid
 */
export function validateStatusForFiltering(status: string | undefined | null): QueueStatus | null {
  if (!status) return null;
  
  const normalizedStatus = status.toLowerCase().trim();
  return VALID_QUEUE_STATUSES.includes(normalizedStatus) ? (normalizedStatus as QueueStatus) : null;
}

/**
 * Get all valid queue statuses for dropdown/filter options
 * @returns Array of valid queue status options
 */
export function getValidQueueStatusOptions(): { value: QueueStatus; label: string }[] {
  return [
    { value: QueueStatus.WAITING, label: 'Waiting' },
    { value: QueueStatus.SERVING, label: 'Serving' },
    { value: QueueStatus.PROCESSING, label: 'Processing' },
    { value: QueueStatus.COMPLETED, label: 'Completed' },
    { value: QueueStatus.CANCELLED, label: 'Cancelled' }
  ];
}
