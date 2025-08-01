import { pool } from '../config/database';
import { PaymentMode, Transaction, PaymentSettlement } from '../types';
import { TransactionService } from './transaction';
import { WebSocketService } from './websocket';
import { randomUUID } from 'crypto';
import { config } from '../config/config';

export class PaymentSettlementService {
  static async createSettlement(
    transactionId: number,
    amount: number,
    paymentMode: PaymentMode,
    cashierId: number
  ): Promise<{ transaction: Transaction; settlements: PaymentSettlement[] }> {
    // TRACING: Generate unique UUID for this settlement request (behind feature flag)
    const settlementRequestId = randomUUID();
    if (config.ENABLE_SETTLEMENT_TRACING) {
      console.log(`[SETTLEMENT_TRACE] ${settlementRequestId}: Starting createSettlement for transaction ${transactionId}, amount ${amount}, paymentMode ${paymentMode}, cashier ${cashierId}`);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Validate input
      if (!transactionId || !amount || !paymentMode || !cashierId) {
        throw new Error('Missing required fields: transactionId, amount, paymentMode, cashierId');
      }
      if (amount <= 0) {
        throw new Error('Settlement amount must be greater than 0');
      }
      if (!Object.values(PaymentMode).includes(paymentMode)) {
        throw new Error('Invalid payment mode');
      }

      // CRITICAL: Get transaction with pessimistic lock to prevent race conditions
      // This ensures only one settlement can be processed at a time per transaction
      const lockQuery = `SELECT * FROM transactions WHERE id = $1 FOR UPDATE`;
      const transactionResult = await client.query(lockQuery, [transactionId]);
      if (transactionResult.rows.length === 0) {
        throw new Error('Transaction not found');
      }
      const transaction = transactionResult.rows[0];

      // Get current total of settlements within the same transaction context
      const settlementsQuery = `
        SELECT COALESCE(SUM(amount), 0) as total_paid
        FROM payment_settlements
        WHERE transaction_id = $1
      `;
      const settlementsResult = await client.query(settlementsQuery, [transactionId]);
      const currentPaid = parseFloat(settlementsResult.rows[0].total_paid || 0);
      const remainingBalance = parseFloat(transaction.amount) - currentPaid;

      // Validate partial payment rules with precise decimal handling
      if (amount > remainingBalance) {
        throw new Error(`Settlement amount (${amount}) exceeds remaining balance (${remainingBalance.toFixed(2)})`);
      }

      console.log(`[SETTLEMENT_TRACE] ${settlementRequestId}: Pessimistic lock acquired. Current paid: ${currentPaid}, Remaining: ${remainingBalance.toFixed(2)}`);

      // Additional validation: prevent overpayment due to floating point errors
      if ((currentPaid + amount) > parseFloat(transaction.amount) + 0.01) { // Allow 1 cent tolerance
        throw new Error(`Total payment (${(currentPaid + amount).toFixed(2)}) would exceed transaction amount (${parseFloat(transaction.amount).toFixed(2)})`);
      }
      console.log(`[SETTLEMENT_TRACE] ${settlementRequestId}: Validation passed. Current paid: ${currentPaid}, Remaining balance: ${remainingBalance}`);

      // AUDIT LOG: Record settlement initiation
      const auditInitiatedQuery = `
        INSERT INTO payment_tracking (transaction_id, payment_event, amount, payment_method, status, processed_by, external_reference)
        VALUES ($1, 'initiated', $2, $3, 'processing', $4, $5)
        RETURNING id
      `;
      const auditInitiated = await client.query(auditInitiatedQuery, [
        transactionId, amount, paymentMode, cashierId, settlementRequestId
      ]);
      const trackingId = auditInitiated.rows[0].id;
      console.log(`[SETTLEMENT_TRACE] ${settlementRequestId}: Audit tracking initiated with ID: ${trackingId}`);

      // Insert into payment_settlements
      console.log(`[SETTLEMENT_TRACE] ${settlementRequestId}: Inserting settlement record into database`);
      const insertQuery = `
        INSERT INTO payment_settlements (transaction_id, amount, payment_mode, cashier_id)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const insertResult = await client.query(insertQuery, [transactionId, amount, paymentMode, cashierId]);
      const newSettlement = insertResult.rows[0];
      console.log(`[SETTLEMENT_TRACE] ${settlementRequestId}: Settlement record created with ID: ${newSettlement.id}`);

      // Update payment status
      console.log(`[SETTLEMENT_TRACE] ${settlementRequestId}: Calling TransactionService.updatePaymentStatus for transaction ${transactionId}`);
      const updatedTransaction = await TransactionService.updatePaymentStatus(transactionId, settlementRequestId, client);

      // Check if transaction update was successful
      if (!updatedTransaction) {
        throw new Error('Failed to update transaction payment status');
      }

      // AUDIT LOG: Record successful completion
      const auditCompletedQuery = `
        UPDATE payment_tracking
        SET payment_event = 'completed', status = 'success',
          gateway_response = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `;
      await client.query(auditCompletedQuery, [
        JSON.stringify({ 
          settlement_id: newSettlement.id, 
          final_paid_amount: updatedTransaction?.paid_amount,
          final_payment_status: updatedTransaction?.payment_status,
          processing_time_ms: Date.now() - new Date(settlementRequestId.substring(0, 8)).getTime()
        }), 
        trackingId
      ]);
      console.log(`[SETTLEMENT_TRACE] ${settlementRequestId}: Audit tracking completed`);

      const updatedTransactionWithTracking = updatedTransaction;

      // Fetch updated settlement history
      const settlementHistory = await this.getSettlements(transactionId);

      await client.query('COMMIT');

      // Emit real-time update for payment settlement
      console.log(`[SETTLEMENT_TRACE] ${settlementRequestId}: Emitting WebSocket transaction update`);
      WebSocketService.emitTransactionUpdate({
        type: 'payment_settlement_created',
        transaction: updatedTransaction!,
        settlement: newSettlement,
        timestamp: new Date()
      }, settlementRequestId);

      // Emit standardized settlementCreated event
      console.log(`[SETTLEMENT_TRACE] ${settlementRequestId}: Emitting standardized settlementCreated event`);
      WebSocketService.emitSettlementCreated({
        transaction_id: transactionId,
        settlement: newSettlement,
        transaction: updatedTransaction!
      });

      console.log(`[SETTLEMENT_TRACE] ${settlementRequestId}: Settlement completed successfully`);
      return { transaction: updatedTransaction!, settlements: settlementHistory };
    } catch (error) {
      await client.query('ROLLBACK');

      // AUDIT LOG: Record failed settlement attempt
      try {
        const auditFailedQuery = `
          INSERT INTO payment_tracking (transaction_id, payment_event, amount, payment_method, status, processed_by, external_reference, error_message)
          VALUES ($1, 'failed', $2, $3, 'error', $4, $5, $6)
        `;
        await pool.query(auditFailedQuery, [
          transactionId, amount, paymentMode, cashierId, settlementRequestId, (error as Error).message
        ]);
        console.log(`[SETTLEMENT_TRACE] ${settlementRequestId}: Audit tracking recorded failure: ${(error as Error).message}`);
      } catch (auditError) {
        console.error(`[SETTLEMENT_TRACE] ${settlementRequestId}: Failed to log audit entry:`, auditError);
      }

      console.error('Error creating settlement:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async getSettlements(transactionId: number): Promise<PaymentSettlement[]> {
    const query = `
      SELECT 
        ps.*,
        CAST(ps.amount AS NUMERIC)::FLOAT as amount,
        u.full_name as cashier_name
      FROM payment_settlements ps
      LEFT JOIN users u ON ps.cashier_id = u.id
      WHERE ps.transaction_id = $1
      ORDER BY ps.paid_at DESC
    `;
    const result = await pool.query(query, [transactionId]);
    return result.rows;
  }
}

