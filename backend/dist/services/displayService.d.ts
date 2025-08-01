import { QueueItem } from '../types';
/**
 * DisplayService - Handles queue display logic for public monitors
 *
 * This service provides filtered queue data for display monitors,
 * implementing monitor exclusion rules for sensitive or internal queue states.
 */
export declare class DisplayService {
    /**
     * Get queue data for display monitors
     *
     * Monitor Exclusion Rules:
     * - Excludes customers with 'processing' status (internal workflow state)
     * - Only shows 'waiting' and 'serving' customers for public display
     * - Maintains proper queue ordering and position calculations
     *
     * @returns Promise<QueueItem[]> - Filtered queue items for display
     */
    static getDisplayQueue(): Promise<QueueItem[]>;
    /**
     * Check if a queue status should be displayed on public monitors
     *
     * @param status - Queue status to check
     * @returns boolean - true if status should be displayed
     */
    static shouldDisplayStatus(status: string): boolean;
    /**
     * Get display-friendly queue statistics
     *
     * @returns Promise<object> - Statistics excluding processing records
     */
    static getDisplayStatistics(): Promise<{
        totalWaiting: number;
        totalServing: number;
        averageWaitTime: number;
    }>;
}
//# sourceMappingURL=displayService.d.ts.map