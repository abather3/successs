import { pool } from '../config/database';
import { QueueItem, Customer, QueueStatus, Counter } from '../types';
import { CustomerService } from './customer';
import { WebSocketService } from './websocket';
import { config } from '../config/config';
import { QueueAnalyticsService } from './QueueAnalyticsService';
import { validateAndFallbackQueueStatus, validateQueueStatusForDB } from '../utils/queueStatusValidation';

export class QueueService {
  static async getQueue(statusFilter?: string): Promise<QueueItem[]> {
    let whereClause = 'WHERE TRUE';
    let queryParams: any[] = [];
    
    if (statusFilter) {
      whereClause = 'WHERE c.queue_status = $1';
      queryParams = [statusFilter];
    }

    const query = `
      SELECT 
        c.*,
        u.full_name as sales_agent_name,
        ROW_NUMBER() OVER (ORDER BY 
          CASE 
            WHEN c.manual_position IS NOT NULL THEN c.manual_position
            ELSE
              CASE 
                WHEN c.priority_flags::json->>'senior_citizen' = 'true' THEN 1000
                WHEN c.priority_flags::json->>'pwd' = 'true' THEN 900
                WHEN c.priority_flags::json->>'pregnant' = 'true' THEN 800
                ELSE 0
              END * 100000 + EXTRACT(EPOCH FROM c.created_at)
          END ASC
        ) as position
      FROM customers c
      LEFT JOIN users u ON c.sales_agent_id = u.id
      ${whereClause}
      ORDER BY position
    `;

    const result = await pool.query(query, queryParams);
    
    return result.rows.map((row: any, index: number) => ({
      customer_id: row.id,
      customer: {
        ...row,
        queue_status: validateAndFallbackQueueStatus(row.queue_status),
        prescription: typeof row.prescription === 'string' ? JSON.parse(row.prescription) : row.prescription,
        payment_info: typeof row.payment_info === 'string' ? JSON.parse(row.payment_info) : row.payment_info,
        priority_flags: typeof row.priority_flags === 'string' ? JSON.parse(row.priority_flags) : row.priority_flags,
      },
      position: index + 1,
      priority_score: this.calculatePriorityScore(typeof row.priority_flags === 'string' ? JSON.parse(row.priority_flags) : row.priority_flags),
      estimated_wait_time: this.calculateEstimatedWaitTime(index + 1)
    }));
  }

  /**
   * Get queue for display monitors - excludes processing records
   * Only returns customers in 'waiting' and 'serving' status for public display
   */
  static async getDisplayQueue(): Promise<QueueItem[]> {
    const query = `
      SELECT 
        c.*,
        u.full_name as sales_agent_name,
        ROW_NUMBER() OVER (ORDER BY 
          CASE 
            WHEN c.manual_position IS NOT NULL THEN c.manual_position
            ELSE
              CASE 
                WHEN c.priority_flags::json->>'senior_citizen' = 'true' THEN 1000
                WHEN c.priority_flags::json->>'pwd' = 'true' THEN 900
                WHEN c.priority_flags::json->>'pregnant' = 'true' THEN 800
                ELSE 0
              END * 100000 + EXTRACT(EPOCH FROM c.created_at)
          END ASC
        ) as position
      FROM customers c
      LEFT JOIN users u ON c.sales_agent_id = u.id
      WHERE c.queue_status IN ('waiting', 'serving')
      ORDER BY 
        CASE 
          WHEN c.queue_status = 'serving' THEN 0
          ELSE 1
        END,
        CASE 
          WHEN c.manual_position IS NOT NULL THEN c.manual_position
          ELSE
            CASE 
              WHEN c.priority_flags::json->>'senior_citizen' = 'true' THEN 1000
              WHEN c.priority_flags::json->>'pwd' = 'true' THEN 900
              WHEN c.priority_flags::json->>'pregnant' = 'true' THEN 800
              ELSE 0
            END * 100000 + EXTRACT(EPOCH FROM c.created_at)
        END ASC
    `;

    const result = await pool.query(query);
    
    return result.rows.map((row: any) => ({
      customer_id: row.id,
      customer: {
        ...row,
        queue_status: validateAndFallbackQueueStatus(row.queue_status),
        prescription: typeof row.prescription === 'string' ? JSON.parse(row.prescription) : row.prescription,
        payment_info: typeof row.payment_info === 'string' ? JSON.parse(row.payment_info) : row.payment_info,
        priority_flags: typeof row.priority_flags === 'string' ? JSON.parse(row.priority_flags) : row.priority_flags,
      },
      position: row.position,
      priority_score: this.calculatePriorityScore(typeof row.priority_flags === 'string' ? JSON.parse(row.priority_flags) : row.priority_flags),
      estimated_wait_time: this.calculateEstimatedWaitTime(row.position)
    }));
  }

  static async callNext(counterId: number): Promise<Customer | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get the next customer in queue with position and wait time calculation
      const queueQuery = `
        SELECT 
          c.id,
          c.priority_flags,
          c.created_at,
          ROW_NUMBER() OVER (ORDER BY 
            CASE 
              WHEN c.manual_position IS NOT NULL THEN c.manual_position
              ELSE
                CASE 
                  WHEN c.priority_flags::json->>'senior_citizen' = 'true' THEN 1000
                  WHEN c.priority_flags::json->>'pwd' = 'true' THEN 900
                  WHEN c.priority_flags::json->>'pregnant' = 'true' THEN 800
                  ELSE 0
                END * 100000 + EXTRACT(EPOCH FROM c.created_at)
            END ASC
          ) as position,
          EXTRACT(EPOCH FROM (NOW() - c.created_at)) / 60 as wait_time_minutes
        FROM customers c
        WHERE c.queue_status = 'waiting'
        ORDER BY 
          CASE 
            WHEN c.manual_position IS NOT NULL THEN c.manual_position
            ELSE
              CASE 
                WHEN c.priority_flags::json->>'senior_citizen' = 'true' THEN 1000
                WHEN c.priority_flags::json->>'pwd' = 'true' THEN 900
                WHEN c.priority_flags::json->>'pregnant' = 'true' THEN 800
                ELSE 0
              END * 100000 + EXTRACT(EPOCH FROM c.created_at)
          END ASC
        LIMIT 1
        FOR UPDATE
      `;

      const queueResult = await client.query(queueQuery);
      
      if (queueResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const customerId = queueResult.rows[0].id;
      const queuePosition = queueResult.rows[0].position;
      const waitTimeMinutes = Math.round(queueResult.rows[0].wait_time_minutes);
      const priorityFlags = typeof queueResult.rows[0].priority_flags === 'string' 
        ? JSON.parse(queueResult.rows[0].priority_flags) 
        : queueResult.rows[0].priority_flags;
      const isPriority = priorityFlags.senior_citizen || priorityFlags.pwd || priorityFlags.pregnant;

      // Update customer status to serving
      const updateCustomerQuery = `
        UPDATE customers 
        SET queue_status = 'serving', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;

      const customerResult = await client.query(updateCustomerQuery, [customerId]);

      // Update counter with current customer
      const updateCounterQuery = `
        UPDATE counters 
        SET current_customer_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `;

      await client.query(updateCounterQuery, [customerId, counterId]);

      await client.query('COMMIT');

      const customer = {
        ...customerResult.rows[0],
        prescription: typeof customerResult.rows[0].prescription === 'string' ? JSON.parse(customerResult.rows[0].prescription) : customerResult.rows[0].prescription,
        payment_info: typeof customerResult.rows[0].payment_info === 'string' ? JSON.parse(customerResult.rows[0].payment_info) : customerResult.rows[0].payment_info,
        priority_flags: typeof customerResult.rows[0].priority_flags === 'string' ? JSON.parse(customerResult.rows[0].priority_flags) : customerResult.rows[0].priority_flags,
      };

      // Emit real-time update
      await WebSocketService.emitQueueUpdate({
        type: 'customer_called',
        customer,
        counterId,
        timestamp: new Date()
      });

      // Record analytics event
      try {
        await QueueAnalyticsService.recordQueueEvent({
          customerId,
          eventType: 'called',
          counterId,
          queuePosition,
          waitTimeMinutes,
          isPriority
        });
      } catch (analyticsError) {
        console.error('Failed to record analytics event:', analyticsError);
        // Don't fail the operation if analytics fails
      }

      return customer;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async callSpecificCustomer(customerId: number, counterId: number): Promise<Customer | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if customer exists and is waiting
      const checkCustomerQuery = `
        SELECT id
        FROM customers
        WHERE id = $1 AND queue_status = 'waiting'
        FOR UPDATE
      `;

      const checkResult = await client.query(checkCustomerQuery, [customerId]);
      
      if (checkResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      // Update customer status to serving
      const updateCustomerQuery = `
        UPDATE customers 
        SET queue_status = 'serving', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;

      const customerResult = await client.query(updateCustomerQuery, [customerId]);

      // Update counter with current customer
      const updateCounterQuery = `
        UPDATE counters 
        SET current_customer_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `;

      await client.query(updateCounterQuery, [customerId, counterId]);

      await client.query('COMMIT');

      const customer = {
        ...customerResult.rows[0],
        prescription: typeof customerResult.rows[0].prescription === 'string' ? JSON.parse(customerResult.rows[0].prescription) : customerResult.rows[0].prescription,
        payment_info: typeof customerResult.rows[0].payment_info === 'string' ? JSON.parse(customerResult.rows[0].payment_info) : customerResult.rows[0].payment_info,
        priority_flags: typeof customerResult.rows[0].priority_flags === 'string' ? JSON.parse(customerResult.rows[0].priority_flags) : customerResult.rows[0].priority_flags,
      };

      // Emit real-time update
      await WebSocketService.emitQueueUpdate({
        type: 'customer_called',
        customer,
        counterId,
        timestamp: new Date()
      });

      return customer;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async completeService(customerId: number, counterId: number): Promise<Customer> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get customer info before updating for analytics
      const customerInfoQuery = `
        SELECT 
          c.*,
          EXTRACT(EPOCH FROM (NOW() - c.updated_at)) / 60 as service_time_minutes
        FROM customers c
        WHERE c.id = $1 AND c.queue_status IN ('serving', 'processing')
      `;
      
      const customerInfoResult = await client.query(customerInfoQuery, [customerId]);
      
      if (customerInfoResult.rows.length === 0) {
        throw new Error('Customer not found or not currently being served');
      }

      const customerInfo = customerInfoResult.rows[0];
      const serviceTimeMinutes = Math.round(customerInfo.service_time_minutes);
      const priorityFlags = typeof customerInfo.priority_flags === 'string' 
        ? JSON.parse(customerInfo.priority_flags) 
        : customerInfo.priority_flags;
      const isPriority = priorityFlags.senior_citizen || priorityFlags.pwd || priorityFlags.pregnant;

      // Update customer status to completed and set served_at timestamp
      const updateCustomerQuery = `
        UPDATE customers 
        SET queue_status = 'completed', 
            served_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;

      const customerResult = await client.query(updateCustomerQuery, [customerId]);

      if (customerResult.rows.length === 0) {
        throw new Error('Customer not found');
      }

      // Clear counter
      const updateCounterQuery = `
        UPDATE counters 
        SET current_customer_id = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;

      await client.query(updateCounterQuery, [counterId]);

      await client.query('COMMIT');

      const customer = {
        ...customerResult.rows[0],
        prescription: typeof customerResult.rows[0].prescription === 'string' ? JSON.parse(customerResult.rows[0].prescription) : customerResult.rows[0].prescription,
        payment_info: typeof customerResult.rows[0].payment_info === 'string' ? JSON.parse(customerResult.rows[0].payment_info) : customerResult.rows[0].payment_info,
        priority_flags: typeof customerResult.rows[0].priority_flags === 'string' ? JSON.parse(customerResult.rows[0].priority_flags) : customerResult.rows[0].priority_flags,
      };

      // Emit real-time update
      await WebSocketService.emitQueueUpdate({
        type: 'customer_completed',
        customer,
        counterId,
        timestamp: new Date()
      });

      // Record analytics event
      try {
        await QueueAnalyticsService.recordQueueEvent({
          customerId,
          eventType: 'served',
          counterId,
          serviceTimeMinutes,
          isPriority
        });
      } catch (analyticsError) {
        console.error('Failed to record analytics event:', analyticsError);
        // Don't fail the operation if analytics fails
      }

      return customer;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async cancelService(customerId: number, reason?: string): Promise<Customer> {
    const query = `
      UPDATE customers 
      SET queue_status = 'cancelled', 
          served_at = CURRENT_TIMESTAMP,
          remarks = COALESCE(remarks || ' | ', '') || 'Cancelled: ' || COALESCE($2, 'No reason provided'),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [customerId, reason]);

    if (result.rows.length === 0) {
      throw new Error('Customer not found');
    }

    const customer = {
      ...result.rows[0],
      prescription: typeof result.rows[0].prescription === 'string' ? JSON.parse(result.rows[0].prescription) : result.rows[0].prescription,
      payment_info: typeof result.rows[0].payment_info === 'string' ? JSON.parse(result.rows[0].payment_info) : result.rows[0].payment_info,
      priority_flags: typeof result.rows[0].priority_flags === 'string' ? JSON.parse(result.rows[0].priority_flags) : result.rows[0].priority_flags,
    };

    // Emit real-time update
    await WebSocketService.emitQueueUpdate({
      type: 'customer_cancelled',
      customer,
      reason,
      timestamp: new Date()
    });

    // Record analytics event
    try {
      const priorityFlags = customer.priority_flags;
      const isPriority = priorityFlags.senior_citizen || priorityFlags.pwd || priorityFlags.pregnant;
      
      await QueueAnalyticsService.recordQueueEvent({
        customerId,
        eventType: 'cancelled',
        isPriority,
        reason
      });
    } catch (analyticsError) {
      console.error('Failed to record analytics event:', analyticsError);
      // Don't fail the operation if analytics fails
    }

    return customer;
  }

  static async getPosition(customerId: number): Promise<number | null> {
    const query = `
      WITH queue_position AS (
        SELECT 
          id,
          ROW_NUMBER() OVER (ORDER BY 
            CASE 
              WHEN priority_flags::json->>'senior_citizen' = 'true' THEN 1000
              WHEN priority_flags::json->>'pwd' = 'true' THEN 900
              WHEN priority_flags::json->>'pregnant' = 'true' THEN 800
              ELSE 0
            END DESC,
            created_at ASC
          ) as position
        FROM customers
        WHERE queue_status = 'waiting'
      )
      SELECT position
      FROM queue_position
      WHERE id = $1
    `;

    const result = await pool.query(query, [customerId]);
    return result.rows[0]?.position || null;
  }

  static async getEstimatedWaitTime(customerId: number): Promise<number> {
    const position = await this.getPosition(customerId);
    if (!position) return 0;

    return this.calculateEstimatedWaitTime(position);
  }

  static async updatePriority(customerId: number, priorityBoost: number = 0): Promise<Customer> {
    // This could be used for emergency cases or VIP customers
    const query = `
      UPDATE customers 
      SET priority_score = COALESCE(priority_score, 0) + $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [customerId, priorityBoost]);

    if (result.rows.length === 0) {
      throw new Error('Customer not found');
    }

    const customer = {
      ...result.rows[0],
      prescription: typeof result.rows[0].prescription === 'string' ? JSON.parse(result.rows[0].prescription) : result.rows[0].prescription,
      payment_info: typeof result.rows[0].payment_info === 'string' ? JSON.parse(result.rows[0].payment_info) : result.rows[0].payment_info,
      priority_flags: typeof result.rows[0].priority_flags === 'string' ? JSON.parse(result.rows[0].priority_flags) : result.rows[0].priority_flags,
    };

    // Emit real-time update
    await WebSocketService.emitQueueUpdate({
      type: 'priority_updated',
      customer,
      priorityBoost,
      timestamp: new Date()
    });

    return customer;
  }

  static async getQueueStatistics(): Promise<{
    totalWaiting: number;
    averageWaitTime: number;
    longestWaitTime: number;
    priorityCustomers: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_waiting,
        AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60) as average_wait_minutes,
        MAX(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60) as longest_wait_minutes,
        COUNT(*) FILTER (WHERE 
          priority_flags::json->>'senior_citizen' = 'true' OR
          priority_flags::json->>'pwd' = 'true' OR
          priority_flags::json->>'pregnant' = 'true'
        ) as priority_customers
      FROM customers
      WHERE queue_status = 'waiting'
    `;

    const result = await pool.query(query);
    const stats = result.rows[0];

    return {
      totalWaiting: parseInt(stats.total_waiting),
      averageWaitTime: parseFloat(stats.average_wait_minutes) || 0,
      longestWaitTime: parseFloat(stats.longest_wait_minutes) || 0,
      priorityCustomers: parseInt(stats.priority_customers)
    };
  }

  private static calculatePriorityScore(priorityFlags: any): number {
    let score = 0;
    
    if (priorityFlags.senior_citizen) score += 1000;
    if (priorityFlags.pwd) score += 900;
    if (priorityFlags.pregnant) score += 800;
    
    return score;
  }

  private static calculateEstimatedWaitTime(position: number): number {
    // Estimated wait time based on position and average service time
    const averageServiceTime = config.AVERAGE_SERVICE_TIME || 15; // minutes
    return (position - 1) * averageServiceTime;
  }

  static async reorderQueue(customerIds: number[]): Promise<QueueItem[]> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Add a manual_position column to track the new order
      for (let i = 0; i < customerIds.length; i++) {
        const customerId = customerIds[i];
        const position = i + 1;
        
        await client.query(
          'UPDATE customers SET manual_position = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND queue_status = $3',
          [position, customerId, 'waiting']
        );
      }

      await client.query('COMMIT');

      // Get the updated queue
      const updatedQueue = await this.getQueue();

      // Emit real-time update
      await WebSocketService.emitQueueUpdate({
        type: 'queue_reordered',
        queue: updatedQueue,
        timestamp: new Date()
      });

      return updatedQueue;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async changeStatus(customerId: number, nextStatus: QueueStatus, userId?: number, userRole?: string): Promise<Customer> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current customer status
      const getCurrentStatusQuery = `
        SELECT id, name, queue_status, created_at, updated_at
        FROM customers
        WHERE id = $1
        FOR UPDATE
      `;
      
      const currentResult = await client.query(getCurrentStatusQuery, [customerId]);
      
      if (currentResult.rows.length === 0) {
        throw new Error('Customer not found');
      }

      const currentCustomer = currentResult.rows[0];
      const currentStatus = currentCustomer.queue_status as QueueStatus;
      
      // Validate transition
      if (!this.isValidStatusTransition(currentStatus, nextStatus)) {
        throw new Error(
          `Invalid status transition: ${currentStatus} → ${nextStatus}. ` +
          `Valid transitions are: Waiting → Serving → Processing → Completed`
        );
      }
      
      // Check RBAC permissions if userRole is provided
      if (userRole && !this.isTransitionAllowedForRole(userRole, currentStatus, nextStatus)) {
        throw new Error(
          `Access denied. Your role (${userRole}) is not authorized to perform this transition: ${currentStatus} → ${nextStatus}`
        );
      }

      // Update customer status
      const updateCustomerQuery = `
        UPDATE customers 
        SET queue_status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;

      const customerResult = await client.query(updateCustomerQuery, [nextStatus, customerId]);
      
      // Record queue event with processing timestamps
      await this.recordQueueEventWithTimestamps(
        client, 
        customerId, 
        currentStatus,
        nextStatus,
        userId
      );

      await client.query('COMMIT');

      const customer = {
        ...customerResult.rows[0],
        prescription: typeof customerResult.rows[0].prescription === 'string' ? JSON.parse(customerResult.rows[0].prescription) : customerResult.rows[0].prescription,
        payment_info: typeof customerResult.rows[0].payment_info === 'string' ? JSON.parse(customerResult.rows[0].payment_info) : customerResult.rows[0].payment_info,
        priority_flags: typeof customerResult.rows[0].priority_flags === 'string' ? JSON.parse(customerResult.rows[0].priority_flags) : customerResult.rows[0].priority_flags,
      };

      // Emit real-time updates
      // 1. New specific status change event
      WebSocketService.emitQueueStatusChanged(customerId, nextStatus, {
        previousStatus: currentStatus,
        customer: {
          id: customer.id,
          name: customer.name,
          or_number: customer.or_number,
          token_number: customer.token_number
        }
      });
      
      // 2. Enhanced queue update with processing count
      await WebSocketService.emitQueueUpdate({
        type: 'status_changed',
        customer,
        previousStatus: currentStatus,
        newStatus: nextStatus,
        timestamp: new Date()
      });

      return customer;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private static isValidStatusTransition(currentStatus: QueueStatus, nextStatus: QueueStatus): boolean {
    // Define valid transitions: Waiting → Serving → Processing → Completed
    // Cancelled can be reached from any status
    const validTransitions: { [key in QueueStatus]: QueueStatus[] } = {
      [QueueStatus.WAITING]: [QueueStatus.SERVING, QueueStatus.CANCELLED],
      [QueueStatus.SERVING]: [QueueStatus.PROCESSING, QueueStatus.COMPLETED, QueueStatus.CANCELLED],
      [QueueStatus.PROCESSING]: [QueueStatus.COMPLETED, QueueStatus.CANCELLED],
      [QueueStatus.COMPLETED]: [], // Terminal state
      [QueueStatus.CANCELLED]: [] // Terminal state
    };

    return validTransitions[currentStatus]?.includes(nextStatus) || false;
  }

  /**
   * Check RBAC permissions for status transitions
   * @param userRole - The role of the user making the transition
   * @param currentStatus - Current status of the customer
   * @param nextStatus - Desired next status
   * @returns true if transition is allowed for the user role
   */
  private static isTransitionAllowedForRole(
    userRole: string, 
    currentStatus: QueueStatus, 
    nextStatus: QueueStatus
  ): boolean {
    const { UserRole } = require('../types');
    
    // Super Admin can do everything
    if (userRole === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Admin can force any valid transition
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    // Sales role can only view processing items, no transitions
    if (userRole === UserRole.SALES) {
      return false;
    }

    // Cashier can do Serve → Processing and normal flow
    if (userRole === UserRole.CASHIER) {
      // Allow Serve → Processing transition
      if (currentStatus === QueueStatus.SERVING && nextStatus === QueueStatus.PROCESSING) {
        return true;
      }
      // Allow other standard transitions
      if (currentStatus === QueueStatus.WAITING && nextStatus === QueueStatus.SERVING) {
        return true;
      }
      if (currentStatus === QueueStatus.SERVING && nextStatus === QueueStatus.COMPLETED) {
        return true;
      }
      if (currentStatus === QueueStatus.PROCESSING && nextStatus === QueueStatus.COMPLETED) {
        return true;
      }
      // Allow cancellation from any status
      if (nextStatus === QueueStatus.CANCELLED) {
        return true;
      }
      return false;
    }

    return false;
  }

  private static async recordQueueEventWithTimestamps(
    client: any, 
    customerId: number, 
    fromStatus: QueueStatus,
    toStatus: QueueStatus,
    userId?: number
  ): Promise<void> {
    const now = new Date();
    let eventType: string;
    let processingStartAt: Date | null = null;
    let processingEndAt: Date | null = null;

    // Determine event type and timestamps
    switch (toStatus) {
      case QueueStatus.SERVING:
        eventType = 'called';
        break;
      case QueueStatus.PROCESSING:
        eventType = 'processing_started';
        processingStartAt = now;
        break;
      case QueueStatus.COMPLETED:
        eventType = 'served';
        if (fromStatus === QueueStatus.PROCESSING) {
          processingEndAt = now;
        }
        break;
      case QueueStatus.CANCELLED:
        eventType = 'cancelled';
        if (fromStatus === QueueStatus.PROCESSING) {
          processingEndAt = now;
        }
        break;
      default:
        eventType = 'status_changed';
    }

    // Insert queue event with timestamps
    const insertEventQuery = `
      INSERT INTO queue_events (
        customer_id, 
        event_type, 
        details,
        processing_start_at,
        processing_end_at,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `;

    const details = {
      from_status: fromStatus,
      to_status: toStatus,
      user_id: userId,
      timestamp: now.toISOString()
    };

    await client.query(insertEventQuery, [
      customerId,
      eventType,
      JSON.stringify(details),
      processingStartAt,
      processingEndAt,
      now
    ]);
  }

  static async resetQueue(adminId: number, reason?: string): Promise<{
    cancelled: number;
    completed: number;
    message: string;
  }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get count of customers before reset
      const countQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE queue_status = 'waiting') as waiting_count,
          COUNT(*) FILTER (WHERE queue_status = 'serving') as serving_count,
          COUNT(*) FILTER (WHERE queue_status = 'completed') as completed_count
        FROM customers
        WHERE queue_status IN ('waiting', 'serving', 'completed')
      `;
      const countResult = await client.query(countQuery);
      const counts = countResult.rows[0];

      // Cancel all waiting customers
      const cancelQuery = `
        UPDATE customers 
        SET queue_status = 'cancelled', 
            remarks = COALESCE(remarks || ' | ', '') || 'Queue Reset: ' || COALESCE($1, 'Queue reset by admin'),
            updated_at = CURRENT_TIMESTAMP
        WHERE queue_status = 'waiting'
        RETURNING id, name
      `;
      const cancelResult = await client.query(cancelQuery, [reason]);

      // Complete all serving customers
      const completeQuery = `
        UPDATE customers 
        SET queue_status = 'completed', 
            served_at = CURRENT_TIMESTAMP,
            remarks = COALESCE(remarks || ' | ', '') || 'Queue Reset: Service completed during reset',
            updated_at = CURRENT_TIMESTAMP
        WHERE queue_status = 'serving'
        RETURNING id, name
      `;
      const completeResult = await client.query(completeQuery);

      // Clear all counters
      await client.query(
        'UPDATE counters SET current_customer_id = NULL, updated_at = CURRENT_TIMESTAMP'
      );

      // Record analytics events for cancelled customers
      for (const customer of cancelResult.rows) {
        try {
          await QueueAnalyticsService.recordQueueEvent({
            customerId: customer.id,
            eventType: 'cancelled',
            isPriority: false, // We can't determine priority easily here
            reason: `Queue reset: ${reason || 'Queue reset by admin'}`
          });
        } catch (analyticsError) {
          console.error('Failed to record analytics event for cancelled customer:', analyticsError);
        }
      }

      await client.query('COMMIT');

      const result = {
        cancelled: cancelResult.rows.length,
        completed: completeResult.rows.length,
        message: `Queue reset: ${cancelResult.rows.length} customers cancelled, ${completeResult.rows.length} customers completed`
      };

      // Emit real-time update
      await WebSocketService.emitQueueUpdate({
        type: 'queue_reset',
        adminId,
        reason,
        result,
        timestamp: new Date()
      });

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export class CounterService {
  static async list(): Promise<Counter[]> {
    const query = `
      SELECT c.*, cu.name as current_customer_name
      FROM counters c
      LEFT JOIN customers cu ON c.current_customer_id = cu.id
      ORDER BY c.name
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  static async create(name: string): Promise<Counter> {
    const query = `
      INSERT INTO counters (name, is_active)
      VALUES ($1, true)
      RETURNING *
    `;

    const result = await pool.query(query, [name]);
    return result.rows[0];
  }

  static async update(id: number, updates: { name?: string; is_active?: boolean }): Promise<Counter> {
    const setClause: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        setClause.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (setClause.length === 0) {
      throw new Error('No valid updates provided');
    }

    values.push(id);
    const query = `
      UPDATE counters 
      SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Counter not found');
    }

    return result.rows[0];
  }

  static async delete(id: number): Promise<void> {
    const query = `DELETE FROM counters WHERE id = $1`;
    const result = await pool.query(query, [id]);
    
    if (result.rowCount === 0) {
      throw new Error('Counter not found');
    }
  }

  static async findById(id: number): Promise<Counter | null> {
    const query = `
      SELECT c.*, cu.name as current_customer_name
      FROM counters c
      LEFT JOIN customers cu ON c.current_customer_id = cu.id
      WHERE c.id = $1
    `;

    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }
}
