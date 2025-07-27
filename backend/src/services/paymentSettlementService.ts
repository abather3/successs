import { pool } from '../config/database';
import { PaymentSettlement, PaymentMode } from '../types';
import { TransactionService } from './transaction';
import { WebSocketService } from './websocket';
import { randomUUID } from 'crypto';
import { config } from '../config/config';
import { PoolClient } from 'pg';

export class PaymentSettlementService {
  static async createSettlement(
    transactionId: number,
    amount: number,
    paymentMode: string,
    cashierId: number
  ): Promise<{ transaction: any, settlements: PaymentSettlement[] }> {
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

      if (!Object.values(PaymentMode).includes(paymentMode as PaymentMode)) {
        throw new Error('Invalid payment mode');
      }

      // Get current transaction details
      const transaction = await TransactionService.findById(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Get current total of settlements
      const currentSettlements = await this.getSettlements(transactionId);
      const currentPaid = currentSettlements.reduce((sum, settlement) => sum + parseFloat(settlement.amount.toString()), 0);
      const remainingBalance = transaction.amount - currentPaid;

      // Validate partial payment rules
      if (amount > remainingBalance) {
        throw new Error(`Settlement amount (${amount}) exceeds remaining balance (${remainingBalance})`);
      }

      console.log(`[SETTLEMENT_TRACE] ${settlementRequestId}: Validation passed. Current paid: ${currentPaid}, Remaining balance: ${remainingBalance}`);
      
      // Insert into payment_settlements
      console.log(`[SETTLEMENT_TRACE] ${settlementRequestId}: Inserting settlement record into database`);
      const insertQuery = `
        INSERT INTO payment_settlements (transaction_id, amount, payment_mode, cashier_id)
        VALUES ($1, $2, $3, $4)
        RETURNING *`;
      const insertResult = await client.query(insertQuery, [transactionId, amount, paymentMode, cashierId]);
      const newSettlement = insertResult.rows[0];
      console.log(`[SETTLEMENT_TRACE] ${settlementRequestId}: Settlement record created with ID: ${newSettlement.id}`);

      // Update payment status
      console.log(`[SETTLEMENT_TRACE] ${settlementRequestId}: Calling TransactionService.updatePaymentStatus for transaction ${transactionId}`);
const updatedTransaction = await TransactionService.updatePaymentStatus(transactionId, settlementRequestId, client);

      // Fetch updated settlement history
      const settlementHistory = await this.getSettlements(transactionId);

      await client.query('COMMIT');


      // Emit real-time update for payment settlement
      console.log(`[SETTLEMENT_TRACE] ${settlementRequestId}: Emitting WebSocket transaction update`);
      WebSocketService.emitTransactionUpdate({
        type: 'payment_settlement_created',
        transaction: updatedTransaction,
        settlement: newSettlement,
        timestamp: new Date()
      }, settlementRequestId);
      
      // Emit standardized settlementCreated event
      console.log(`[SETTLEMENT_TRACE] ${settlementRequestId}: Emitting standardized settlementCreated event`);
      WebSocketService.emitSettlementCreated({
        transaction_id: transactionId,
        settlement: newSettlement,
        transaction: updatedTransaction
      });

      console.log(`[SETTLEMENT_TRACE] ${settlementRequestId}: Settlement completed successfully`);
      return { transaction: updatedTransaction, settlements: settlementHistory };
    } catch (error) {
      await client.query('ROLLBACK');
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

