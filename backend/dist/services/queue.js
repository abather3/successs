"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CounterService = exports.QueueService = void 0;
const database_1 = require("../config/database");
const types_1 = require("../types");
const websocket_1 = require("./websocket");
const config_1 = require("../config/config");
const QueueAnalyticsService_1 = require("./QueueAnalyticsService");
const queueStatusValidation_1 = require("../utils/queueStatusValidation");
class QueueService {
    static async getQueue(statusFilter) {
        let whereClause = 'WHERE TRUE';
        let queryParams = [];
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
        const result = await database_1.pool.query(query, queryParams);
        return result.rows.map((row, index) => ({
            customer_id: row.id,
            customer: {
                ...row,
                queue_status: (0, queueStatusValidation_1.validateAndFallbackQueueStatus)(row.queue_status),
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
    static async getDisplayQueue() {
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
        const result = await database_1.pool.query(query);
        return result.rows.map((row) => ({
            customer_id: row.id,
            customer: {
                ...row,
                queue_status: (0, queueStatusValidation_1.validateAndFallbackQueueStatus)(row.queue_status),
                prescription: typeof row.prescription === 'string' ? JSON.parse(row.prescription) : row.prescription,
                payment_info: typeof row.payment_info === 'string' ? JSON.parse(row.payment_info) : row.payment_info,
                priority_flags: typeof row.priority_flags === 'string' ? JSON.parse(row.priority_flags) : row.priority_flags,
            },
            position: row.position,
            priority_score: this.calculatePriorityScore(typeof row.priority_flags === 'string' ? JSON.parse(row.priority_flags) : row.priority_flags),
            estimated_wait_time: this.calculateEstimatedWaitTime(row.position)
        }));
    }
    static async callNext(counterId) {
        const client = await database_1.pool.connect();
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
            await websocket_1.WebSocketService.emitQueueUpdate({
                type: 'customer_called',
                customer,
                counterId,
                timestamp: new Date()
            });
            // Record analytics event
            try {
                await QueueAnalyticsService_1.QueueAnalyticsService.recordQueueEvent({
                    customerId,
                    eventType: 'called',
                    counterId,
                    queuePosition,
                    waitTimeMinutes,
                    isPriority
                });
            }
            catch (analyticsError) {
                console.error('Failed to record analytics event:', analyticsError);
                // Don't fail the operation if analytics fails
            }
            return customer;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    static async callSpecificCustomer(customerId, counterId) {
        const client = await database_1.pool.connect();
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
            await websocket_1.WebSocketService.emitQueueUpdate({
                type: 'customer_called',
                customer,
                counterId,
                timestamp: new Date()
            });
            // Record analytics event
            try {
                const priorityFlags = customer.priority_flags;
                const isPriority = priorityFlags.senior_citizen || priorityFlags.pwd || priorityFlags.pregnant;
                await QueueAnalyticsService_1.QueueAnalyticsService.recordQueueEvent({
                    customerId,
                    eventType: 'called',
                    counterId,
                    isPriority
                });
            }
            catch (analyticsError) {
                console.error('Failed to record analytics event:', analyticsError);
                // Don't fail the operation if analytics fails
            }
            return customer;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    static async completeService(customerId, counterId) {
        const client = await database_1.pool.connect();
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
            await websocket_1.WebSocketService.emitQueueUpdate({
                type: 'customer_completed',
                customer,
                counterId,
                timestamp: new Date()
            });
            // Record analytics event
            try {
                await QueueAnalyticsService_1.QueueAnalyticsService.recordQueueEvent({
                    customerId,
                    eventType: 'served',
                    counterId,
                    serviceTimeMinutes,
                    isPriority
                });
            }
            catch (analyticsError) {
                console.error('Failed to record analytics event:', analyticsError);
                // Don't fail the operation if analytics fails
            }
            return customer;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    static async cancelService(customerId, reason) {
        const client = await database_1.pool.connect();
        try {
            await client.query('BEGIN');
            // Get customer information before cancelling
            const customerQuery = `
        SELECT * FROM customers WHERE id = $1
      `;
            const customerResult = await client.query(customerQuery, [customerId]);
            if (customerResult.rows.length === 0) {
                throw new Error('Customer not found');
            }
            const originalCustomer = customerResult.rows[0];
            // Update customer status to cancelled
            const updateQuery = `
        UPDATE customers 
        SET queue_status = 'cancelled', 
            served_at = CURRENT_TIMESTAMP,
            remarks = COALESCE(remarks || ' | ', '') || 'Cancelled: ' || COALESCE($2, 'No reason provided'),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;
            const updateResult = await client.query(updateQuery, [customerId, reason]);
            const updatedCustomer = updateResult.rows[0];
            // Archive cancelled customer to customer_history table immediately
            const archiveQuery = `
        INSERT INTO customer_history (
          original_customer_id, name, email, phone, queue_status, 
          token_number, priority_flags, created_at, served_at, 
          counter_id, estimated_wait_time, archive_date
        ) VALUES (
          $1, $2, $3, $4, 'cancelled', $5, $6, $7, CURRENT_TIMESTAMP, 
          NULL, 0, CURRENT_DATE
        )
        ON CONFLICT (original_customer_id, archive_date) 
        DO UPDATE SET
          queue_status = 'cancelled',
          served_at = CURRENT_TIMESTAMP,
          counter_id = NULL
      `;
            await client.query(archiveQuery, [
                originalCustomer.id,
                originalCustomer.name,
                originalCustomer.email,
                originalCustomer.contact_number,
                originalCustomer.token_number,
                originalCustomer.priority_flags,
                originalCustomer.created_at
            ]);
            await client.query('COMMIT');
            const customer = {
                ...updatedCustomer,
                prescription: typeof updatedCustomer.prescription === 'string' ? JSON.parse(updatedCustomer.prescription) : updatedCustomer.prescription,
                payment_info: typeof updatedCustomer.payment_info === 'string' ? JSON.parse(updatedCustomer.payment_info) : updatedCustomer.payment_info,
                priority_flags: typeof updatedCustomer.priority_flags === 'string' ? JSON.parse(updatedCustomer.priority_flags) : updatedCustomer.priority_flags,
            };
            // Emit real-time update
            await websocket_1.WebSocketService.emitQueueUpdate({
                type: 'customer_cancelled',
                customer,
                reason,
                timestamp: new Date()
            });
            // Record analytics event
            try {
                const priorityFlags = customer.priority_flags;
                const isPriority = priorityFlags.senior_citizen || priorityFlags.pwd || priorityFlags.pregnant;
                await QueueAnalyticsService_1.QueueAnalyticsService.recordQueueEvent({
                    customerId,
                    eventType: 'cancelled',
                    isPriority,
                    reason
                });
            }
            catch (analyticsError) {
                console.error('Failed to record analytics event:', analyticsError);
                // Don't fail the operation if analytics fails
            }
            console.log(`Customer ${customer.name} (ID: ${customerId}) cancelled and archived to customer_history`);
            return customer;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    static async getPosition(customerId) {
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
        const result = await database_1.pool.query(query, [customerId]);
        return result.rows[0]?.position || null;
    }
    static async getEstimatedWaitTime(customerId) {
        const position = await this.getPosition(customerId);
        if (!position)
            return 0;
        return this.calculateEstimatedWaitTime(position);
    }
    static async updatePriority(customerId, priorityBoost = 0) {
        // This could be used for emergency cases or VIP customers
        const query = `
      UPDATE customers 
      SET priority_score = COALESCE(priority_score, 0) + $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
        const result = await database_1.pool.query(query, [customerId, priorityBoost]);
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
        await websocket_1.WebSocketService.emitQueueUpdate({
            type: 'priority_updated',
            customer,
            priorityBoost,
            timestamp: new Date()
        });
        return customer;
    }
    static async getQueueStatistics() {
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
        const result = await database_1.pool.query(query);
        const stats = result.rows[0];
        return {
            totalWaiting: parseInt(stats.total_waiting),
            averageWaitTime: parseFloat(stats.average_wait_minutes) || 0,
            longestWaitTime: parseFloat(stats.longest_wait_minutes) || 0,
            priorityCustomers: parseInt(stats.priority_customers)
        };
    }
    static calculatePriorityScore(priorityFlags) {
        let score = 0;
        if (priorityFlags.senior_citizen)
            score += 1000;
        if (priorityFlags.pwd)
            score += 900;
        if (priorityFlags.pregnant)
            score += 800;
        return score;
    }
    static calculateEstimatedWaitTime(position) {
        // Estimated wait time based on position and average service time
        const averageServiceTime = config_1.config.AVERAGE_SERVICE_TIME || 15; // minutes
        return (position - 1) * averageServiceTime;
    }
    static async reorderQueue(customerIds) {
        const client = await database_1.pool.connect();
        try {
            await client.query('BEGIN');
            // Add a manual_position column to track the new order
            for (let i = 0; i < customerIds.length; i++) {
                const customerId = customerIds[i];
                const position = i + 1;
                await client.query('UPDATE customers SET manual_position = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND queue_status = $3', [position, customerId, 'waiting']);
            }
            await client.query('COMMIT');
            // Get the updated queue
            const updatedQueue = await this.getQueue();
            // Emit real-time update
            await websocket_1.WebSocketService.emitQueueUpdate({
                type: 'queue_reordered',
                queue: updatedQueue,
                timestamp: new Date()
            });
            return updatedQueue;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    static async changeStatus(customerId, nextStatus, userId, userRole) {
        const client = await database_1.pool.connect();
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
            const currentStatus = currentCustomer.queue_status;
            // Validate transition
            if (!this.isValidStatusTransition(currentStatus, nextStatus)) {
                throw new Error(`Invalid status transition: ${currentStatus} → ${nextStatus}. ` +
                    `Valid transitions are: Waiting → Serving → Processing → Completed`);
            }
            // Check RBAC permissions if userRole is provided
            if (userRole && !this.isTransitionAllowedForRole(userRole, currentStatus, nextStatus)) {
                throw new Error(`Access denied. Your role (${userRole}) is not authorized to perform this transition: ${currentStatus} → ${nextStatus}`);
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
            await this.recordQueueEventWithTimestamps(client, customerId, currentStatus, nextStatus, userId);
            await client.query('COMMIT');
            const customer = {
                ...customerResult.rows[0],
                prescription: typeof customerResult.rows[0].prescription === 'string' ? JSON.parse(customerResult.rows[0].prescription) : customerResult.rows[0].prescription,
                payment_info: typeof customerResult.rows[0].payment_info === 'string' ? JSON.parse(customerResult.rows[0].payment_info) : customerResult.rows[0].payment_info,
                priority_flags: typeof customerResult.rows[0].priority_flags === 'string' ? JSON.parse(customerResult.rows[0].priority_flags) : customerResult.rows[0].priority_flags,
            };
            // Emit real-time updates
            // 1. New specific status change event
            websocket_1.WebSocketService.emitQueueStatusChanged(customerId, nextStatus, {
                previousStatus: currentStatus,
                customer: {
                    id: customer.id,
                    name: customer.name,
                    or_number: customer.or_number,
                    token_number: customer.token_number
                }
            });
            // 2. Enhanced queue update with processing count
            await websocket_1.WebSocketService.emitQueueUpdate({
                type: 'status_changed',
                customer,
                previousStatus: currentStatus,
                newStatus: nextStatus,
                timestamp: new Date()
            });
            return customer;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    static isValidStatusTransition(currentStatus, nextStatus) {
        // Define valid transitions: Waiting → Serving → Processing → Completed
        // Cancelled can be reached from any status
        const validTransitions = {
            [types_1.QueueStatus.WAITING]: [types_1.QueueStatus.SERVING, types_1.QueueStatus.CANCELLED],
            [types_1.QueueStatus.SERVING]: [types_1.QueueStatus.PROCESSING, types_1.QueueStatus.COMPLETED, types_1.QueueStatus.CANCELLED],
            [types_1.QueueStatus.PROCESSING]: [types_1.QueueStatus.COMPLETED, types_1.QueueStatus.CANCELLED],
            [types_1.QueueStatus.COMPLETED]: [], // Terminal state
            [types_1.QueueStatus.CANCELLED]: [] // Terminal state
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
    static isTransitionAllowedForRole(userRole, currentStatus, nextStatus) {
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
            if (currentStatus === types_1.QueueStatus.SERVING && nextStatus === types_1.QueueStatus.PROCESSING) {
                return true;
            }
            // Allow other standard transitions
            if (currentStatus === types_1.QueueStatus.WAITING && nextStatus === types_1.QueueStatus.SERVING) {
                return true;
            }
            if (currentStatus === types_1.QueueStatus.SERVING && nextStatus === types_1.QueueStatus.COMPLETED) {
                return true;
            }
            if (currentStatus === types_1.QueueStatus.PROCESSING && nextStatus === types_1.QueueStatus.COMPLETED) {
                return true;
            }
            // Allow cancellation from any status
            if (nextStatus === types_1.QueueStatus.CANCELLED) {
                return true;
            }
            return false;
        }
        return false;
    }
    static async recordQueueEventWithTimestamps(client, customerId, fromStatus, toStatus, userId) {
        const now = new Date();
        let eventType;
        let processingStartAt = null;
        let processingEndAt = null;
        // Determine event type and timestamps
        switch (toStatus) {
            case types_1.QueueStatus.SERVING:
                eventType = 'called';
                break;
            case types_1.QueueStatus.PROCESSING:
                eventType = 'processing_started';
                processingStartAt = now;
                break;
            case types_1.QueueStatus.COMPLETED:
                eventType = 'served';
                if (fromStatus === types_1.QueueStatus.PROCESSING) {
                    processingEndAt = now;
                }
                break;
            case types_1.QueueStatus.CANCELLED:
                eventType = 'cancelled';
                if (fromStatus === types_1.QueueStatus.PROCESSING) {
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
    static async resetQueue(adminId, reason) {
        const client = await database_1.pool.connect();
        try {
            await client.query('BEGIN');
            // Get all customers that will be affected by reset (for archiving)
            // Include completed customers from today that haven't been archived yet
            const affectedCustomersQuery = `
        SELECT * FROM customers 
        WHERE queue_status IN ('waiting', 'serving', 'processing')
        OR (queue_status = 'completed' AND DATE(created_at) = CURRENT_DATE AND 
            id NOT IN (
              SELECT original_customer_id FROM customer_history 
              WHERE archive_date = CURRENT_DATE
            ))
      `;
            const affectedCustomersResult = await client.query(affectedCustomersQuery);
            const affectedCustomers = affectedCustomersResult.rows;
            // Get count of customers before reset
            const countQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE queue_status = 'waiting') as waiting_count,
          COUNT(*) FILTER (WHERE queue_status = 'serving') as serving_count,
          COUNT(*) FILTER (WHERE queue_status = 'processing') as processing_count,
          COUNT(*) FILTER (WHERE queue_status = 'completed') as completed_count
        FROM customers
        WHERE queue_status IN ('waiting', 'serving', 'processing', 'completed')
      `;
            const countResult = await client.query(countQuery);
            const counts = countResult.rows[0];
            // Cancel all waiting customers
            const cancelQuery = `
        UPDATE customers 
        SET queue_status = 'cancelled', 
            served_at = CURRENT_TIMESTAMP,
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
            // Complete all processing customers (they are being processed, so mark as completed)
            const completeProcessingQuery = `
        UPDATE customers 
        SET queue_status = 'completed', 
            served_at = CURRENT_TIMESTAMP,
            remarks = COALESCE(remarks || ' | ', '') || 'Queue Reset: Processing completed during reset',
            updated_at = CURRENT_TIMESTAMP
        WHERE queue_status = 'processing'
        RETURNING id, name
      `;
            const completeProcessingResult = await client.query(completeProcessingQuery);
            // Archive all affected customers to customer_history table
            console.log(`[QUEUE_RESET] Found ${affectedCustomers.length} customers to archive:`, affectedCustomers.map(c => ({ id: c.id, name: c.name, status: c.queue_status })));
            if (affectedCustomers.length === 0) {
                console.log(`[QUEUE_RESET] No active customers found to archive. Reset completed with no archival needed.`);
            }
            for (const customer of affectedCustomers) {
                const finalStatus = customer.queue_status === 'waiting' ? 'cancelled' : 'completed';
                console.log(`Archiving customer ${customer.id} with status ${finalStatus}...`);
                try {
                    const archiveQuery = `
            INSERT INTO customer_history (
              original_customer_id, name, email, phone, queue_status, 
              token_number, priority_flags, created_at, served_at, 
              counter_id, estimated_wait_time, archive_date
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, 
              NULL, 0, CURRENT_DATE
            )
            ON CONFLICT (original_customer_id, archive_date) 
            DO UPDATE SET
              queue_status = $5,
              served_at = CURRENT_TIMESTAMP,
              counter_id = NULL
          `;
                    await client.query(archiveQuery, [
                        customer.id,
                        customer.name,
                        customer.email,
                        customer.contact_number,
                        finalStatus, // Either 'cancelled' or 'completed' based on original status
                        customer.token_number,
                        customer.priority_flags,
                        customer.created_at
                    ]);
                    console.log(`Successfully archived customer ${customer.id}.`);
                }
                catch (archiveError) {
                    console.error(`Failed to archive customer ${customer.id} during queue reset:`, archiveError);
                    // Don't fail the entire reset if archiving fails
                }
            }
            // Clear all counters
            await client.query('UPDATE counters SET current_customer_id = NULL, updated_at = CURRENT_TIMESTAMP');
            // Record analytics events for cancelled customers
            for (const customer of cancelResult.rows) {
                try {
                    await QueueAnalyticsService_1.QueueAnalyticsService.recordQueueEvent({
                        customerId: customer.id,
                        eventType: 'cancelled',
                        isPriority: false, // We can't determine priority easily here
                        reason: `Queue reset: ${reason || 'Queue reset by admin'}`
                    });
                }
                catch (analyticsError) {
                    console.error('Failed to record analytics event for cancelled customer:', analyticsError);
                }
            }
            // Record analytics events for completed customers (serving)
            for (const customer of completeResult.rows) {
                try {
                    await QueueAnalyticsService_1.QueueAnalyticsService.recordQueueEvent({
                        customerId: customer.id,
                        eventType: 'served',
                        isPriority: false, // We can't determine priority easily here
                        reason: `Queue reset: Service completed during reset`
                    });
                }
                catch (analyticsError) {
                    console.error('Failed to record analytics event for completed customer:', analyticsError);
                }
            }
            // Record analytics events for completed customers (processing)
            for (const customer of completeProcessingResult.rows) {
                try {
                    await QueueAnalyticsService_1.QueueAnalyticsService.recordQueueEvent({
                        customerId: customer.id,
                        eventType: 'served',
                        isPriority: false, // We can't determine priority easily here
                        reason: `Queue reset: Processing completed during reset`
                    });
                }
                catch (analyticsError) {
                    console.error('Failed to record analytics event for completed processing customer:', analyticsError);
                }
            }
            await client.query('COMMIT');
            const totalCompleted = completeResult.rows.length + completeProcessingResult.rows.length;
            const result = {
                cancelled: cancelResult.rows.length,
                completed: totalCompleted,
                message: `Queue reset: ${cancelResult.rows.length} customers cancelled, ${totalCompleted} customers completed and archived to history`
            };
            console.log(`Queue reset by admin ${adminId}: ${affectedCustomers.length} customers archived to customer_history`);
            // Force analytics update after queue reset
            try {
                await QueueAnalyticsService_1.QueueAnalyticsService.updateHourlyAnalytics();
                await QueueAnalyticsService_1.QueueAnalyticsService.updateDailySummary();
                console.log('Analytics updated after queue reset');
            }
            catch (analyticsError) {
                console.error('Failed to update analytics after queue reset:', analyticsError);
            }
            // Emit real-time update
            await websocket_1.WebSocketService.emitQueueUpdate({
                type: 'queue_reset',
                adminId,
                reason,
                result,
                timestamp: new Date()
            });
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
}
exports.QueueService = QueueService;
class CounterService {
    static async list() {
        const query = `
      SELECT c.*, cu.name as current_customer_name
      FROM counters c
      LEFT JOIN customers cu ON c.current_customer_id = cu.id
      ORDER BY c.name
    `;
        const result = await database_1.pool.query(query);
        return result.rows;
    }
    static async create(name) {
        const query = `
      INSERT INTO counters (name, is_active)
      VALUES ($1, true)
      RETURNING *
    `;
        const result = await database_1.pool.query(query, [name]);
        return result.rows[0];
    }
    static async update(id, updates) {
        const setClause = [];
        const values = [];
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
        const result = await database_1.pool.query(query, values);
        if (result.rows.length === 0) {
            throw new Error('Counter not found');
        }
        return result.rows[0];
    }
    static async delete(id) {
        const query = `DELETE FROM counters WHERE id = $1`;
        const result = await database_1.pool.query(query, [id]);
        if (result.rowCount === 0) {
            throw new Error('Counter not found');
        }
    }
    static async findById(id) {
        const query = `
      SELECT c.*, cu.name as current_customer_name
      FROM counters c
      LEFT JOIN customers cu ON c.current_customer_id = cu.id
      WHERE c.id = $1
    `;
        const result = await database_1.pool.query(query, [id]);
        return result.rows[0] || null;
    }
}
exports.CounterService = CounterService;
//# sourceMappingURL=queue.js.map