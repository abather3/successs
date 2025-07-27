import { QueueService } from './queue';
import { QueueItem } from '../types';

/**
 * DisplayService - Handles queue display logic for public monitors
 * 
 * This service provides filtered queue data for display monitors,
 * implementing monitor exclusion rules for sensitive or internal queue states.
 */
export class DisplayService {
  
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
  static async getDisplayQueue(): Promise<QueueItem[]> {
    // Use the QueueService getDisplayQueue method that already implements filtering
    return await QueueService.getDisplayQueue();
  }

  /**
   * Check if a queue status should be displayed on public monitors
   * 
   * @param status - Queue status to check
   * @returns boolean - true if status should be displayed
   */
  static shouldDisplayStatus(status: string): boolean {
    // Display exclusion rule: hide processing status from public monitors
    const displayableStatuses = ['waiting', 'serving'];
    return displayableStatuses.includes(status.toLowerCase());
  }

  /**
   * Get display-friendly queue statistics
   * 
   * @returns Promise<object> - Statistics excluding processing records
   */
  static async getDisplayStatistics(): Promise<{
    totalWaiting: number;
    totalServing: number;
    averageWaitTime: number;
  }> {
    const displayQueue = await this.getDisplayQueue();
    
    const waitingCustomers = displayQueue.filter(item => 
      item.customer.queue_status === 'waiting'
    );
    
    const servingCustomers = displayQueue.filter(item => 
      item.customer.queue_status === 'serving'
    );

    // Calculate average wait time for waiting customers
    const averageWaitTime = waitingCustomers.length > 0
      ? waitingCustomers.reduce((sum, item) => sum + item.estimated_wait_time, 0) / waitingCustomers.length
      : 0;

    return {
      totalWaiting: waitingCustomers.length,
      totalServing: servingCustomers.length,
      averageWaitTime: Math.round(averageWaitTime)
    };
  }
}
