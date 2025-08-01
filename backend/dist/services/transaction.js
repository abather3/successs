"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportService = exports.TransactionService = void 0;
const database_1 = require("../config/database");
const types_1 = require("../types");
const websocket_1 = require("./websocket");
const customer_1 = require("./customer");
class TransactionService {
    static async create(transactionData) {
        const { customer_id, or_number, amount, payment_mode, sales_agent_id, cashier_id, enforce_customer_amount = false } = transactionData;
        let finalAmount = amount;
        // If enforce_customer_amount is true, use customer's payment_info.amount
        if (enforce_customer_amount) {
            const customer = await customer_1.CustomerService.findById(customer_id);
            if (customer && customer.payment_info && customer.payment_info.amount) {
                finalAmount = customer.payment_info.amount;
                console.log(`[TRANSACTION_CREATE] Enforcing customer payment amount: ${finalAmount} for customer ${customer_id}`);
            }
        }
        const query = `
      INSERT INTO transactions (
        customer_id, or_number, amount, payment_mode, 
        sales_agent_id, cashier_id, transaction_date, paid_amount, balance_amount, payment_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, 0, $3, 'unpaid')
      RETURNING *
    `;
        const values = [
            customer_id,
            or_number,
            finalAmount, // Use finalAmount instead of amount
            payment_mode,
            sales_agent_id,
            cashier_id
        ];
        const result = await database_1.pool.query(query, values);
        const transaction = result.rows[0];
        // Emit real-time update
        websocket_1.WebSocketService.emitTransactionUpdate({
            type: 'transaction_created',
            transaction,
            timestamp: new Date()
        });
        return transaction;
    }
    static async findById(id) {
        const query = `
SELECT 
        t.*, 
        CAST(t.paid_amount AS NUMERIC)::FLOAT as paid_amount, 
        CAST(t.balance_amount AS NUMERIC)::FLOAT as balance_amount, 
        t.payment_status,
        c.name as customer_name,
        u1.full_name as sales_agent_name,
        u2.full_name as cashier_name
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u1 ON t.sales_agent_id = u1.id
      LEFT JOIN users u2 ON t.cashier_id = u2.id
      WHERE t.id = $1
    `;
        const result = await database_1.pool.query(query, [id]);
        return result.rows[0] || null;
    }
    static async findByOrNumber(orNumber) {
        const query = `
SELECT 
        t.*, 
        CAST(t.paid_amount AS NUMERIC)::FLOAT as paid_amount, 
        CAST(t.balance_amount AS NUMERIC)::FLOAT as balance_amount, 
        t.payment_status,
        c.name as customer_name,
        u1.full_name as sales_agent_name,
        u2.full_name as cashier_name
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u1 ON t.sales_agent_id = u1.id
      LEFT JOIN users u2 ON t.cashier_id = u2.id
      WHERE t.or_number = $1
    `;
        const result = await database_1.pool.query(query, [orNumber]);
        return result.rows[0] || null;
    }
    static async list(filters = {}, limit = 50, offset = 0) {
        // Only include payment details if explicitly requested
        const paymentFields = filters.includePaymentDetails
            ? 'CAST(t.paid_amount AS NUMERIC)::FLOAT as paid_amount, CAST(t.balance_amount AS NUMERIC)::FLOAT as balance_amount, t.payment_status,'
            : '';
        let query = `
SELECT 
        t.*, 
        ${paymentFields}
        c.name as customer_name,
        c.contact_number as customer_contact,
        c.email as customer_email,
        c.queue_status as customer_queue_status,
        u1.full_name as sales_agent_name,
        u2.full_name as cashier_name
      FROM transactions t
      INNER JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u1 ON t.sales_agent_id = u1.id
      LEFT JOIN users u2 ON t.cashier_id = u2.id
      WHERE 1=1
    `;
        let countQuery = `
      SELECT COUNT(*) as total
      FROM transactions t
      INNER JOIN customers c ON t.customer_id = c.id
      WHERE 1=1
    `;
        const values = [];
        let paramCount = 1;
        if (filters.startDate) {
            const startDateCondition = ` AND t.transaction_date >= $${paramCount}`;
            query += startDateCondition;
            countQuery += startDateCondition;
            values.push(filters.startDate);
            paramCount++;
        }
        if (filters.endDate) {
            const endDateCondition = ` AND t.transaction_date <= $${paramCount}`;
            query += endDateCondition;
            countQuery += endDateCondition;
            values.push(filters.endDate);
            paramCount++;
        }
        if (filters.paymentMode) {
            const paymentCondition = ` AND t.payment_mode = $${paramCount}`;
            query += paymentCondition;
            countQuery += paymentCondition;
            values.push(filters.paymentMode);
            paramCount++;
        }
        if (filters.salesAgentId) {
            const salesCondition = ` AND t.sales_agent_id = $${paramCount}`;
            query += salesCondition;
            countQuery += salesCondition;
            values.push(filters.salesAgentId);
            paramCount++;
        }
        if (filters.cashierId) {
            const cashierCondition = ` AND t.cashier_id = $${paramCount}`;
            query += cashierCondition;
            countQuery += cashierCondition;
            values.push(filters.cashierId);
            paramCount++;
        }
        if (filters.customerId) {
            const customerCondition = ` AND t.customer_id = $${paramCount}`;
            query += customerCondition;
            countQuery += customerCondition;
            values.push(filters.customerId);
            paramCount++;
        }
        query += ` ORDER BY t.transaction_date DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        values.push(limit, offset);
        const [transactionsResult, countResult] = await Promise.all([
            database_1.pool.query(query, values),
            database_1.pool.query(countQuery, values.slice(0, paramCount - 1))
        ]);
        return {
            transactions: transactionsResult.rows,
            total: parseInt(countResult.rows[0].total)
        };
    }
    static async updatePaymentStatus(txId, settlementRequestId, client) {
        // TRACING: Log entry point with optional settlement request ID
        const traceId = settlementRequestId || `UPDATE_${Date.now()}`;
        console.log(`[TRANSACTION_TRACE] ${traceId}: Starting updatePaymentStatus for transaction ${txId}`);
        // Use a pessimistic lock to prevent race conditions during updates
        const currentQuery = `SELECT * FROM transactions WHERE id = $1 FOR UPDATE`;
        const currentResult = client ? await client.query(currentQuery, [txId]) : await database_1.pool.query(currentQuery, [txId]);
        const currentTransaction = currentResult.rows[0];
        const oldStatus = currentTransaction?.payment_status;
        const oldPaidAmount = currentTransaction?.paid_amount;
        // Log SQL transaction update
        console.log(`[TRANSACTION_TRACE] ${traceId}: Updating payment status in database`);
        const query = `
      UPDATE transactions
      SET paid_amount = COALESCE((
        SELECT SUM(amount)
        FROM payment_settlements
        WHERE transaction_id = $1
      ), 0),
      balance_amount = amount - COALESCE((
        SELECT SUM(amount)
        FROM payment_settlements
        WHERE transaction_id = $1
      ), 0),
      payment_status = CASE
        WHEN COALESCE((
          SELECT SUM(amount)
          FROM payment_settlements
          WHERE transaction_id = $1
        ), 0) = 0 THEN 'unpaid'
        WHEN COALESCE((
          SELECT SUM(amount)
          FROM payment_settlements
          WHERE transaction_id = $1
        ), 0) >= amount THEN 'paid'
        ELSE 'partial'
      END
      WHERE id = $1
      RETURNING *
    `;
        const result = client ? await client.query(query, [txId]) : await database_1.pool.query(query, [txId]);
        const transaction = result.rows[0] || null;
        console.log(`[TRANSACTION_TRACE] ${traceId}: Old status: ${oldStatus}, Old paid: ${oldPaidAmount}`);
        console.log(`[TRANSACTION_TRACE] ${traceId}: New status: ${transaction?.payment_status}, New paid: ${transaction?.paid_amount}`);
        if (transaction) {
            // Check for changes before emitting (deduplication gate)
            const statusChanged = transaction.payment_status !== oldStatus;
            const paidAmountChanged = parseFloat(transaction.paid_amount) !== parseFloat(oldPaidAmount || 0);
            if (statusChanged || paidAmountChanged) {
                // Emit structured payment status update
                console.log(`[TRANSACTION_TRACE] ${traceId}: Emitting WebSocket payment status update (status changed: ${statusChanged}, amount changed: ${paidAmountChanged})`);
                websocket_1.WebSocketService.emitPaymentStatusUpdate({
                    transactionId: transaction.id,
                    payment_status: transaction.payment_status,
                    balance_amount: transaction.balance_amount || (transaction.amount - transaction.paid_amount),
                    paid_amount: transaction.paid_amount,
                    customer_id: transaction.customer_id,
                    or_number: transaction.or_number
                }, traceId);
                // Emit general transaction update for backward compatibility
                console.log(`[TRANSACTION_TRACE] ${traceId}: Emitting WebSocket transaction update`);
                websocket_1.WebSocketService.emitTransactionUpdate({
                    type: 'payment_status_updated',
                    transaction,
                    timestamp: new Date()
                }, traceId);
            }
            else {
                console.log(`[TRANSACTION_TRACE] ${traceId}: No changes detected, skipping WebSocket emission`);
            }
        }
        console.log(`[TRANSACTION_TRACE] ${traceId}: updatePaymentStatus completed`);
        return transaction;
    }
    static async update(id, updates) {
        const client = await database_1.pool.connect();
        try {
            await client.query('BEGIN');
            // Lock the transaction row before updating
            await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [id]);
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
      UPDATE transactions 
      SET ${setClause.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
            const result = await client.query(query, values);
            if (result.rows.length === 0) {
                throw new Error('Transaction not found');
            }
            const transaction = result.rows[0];
            // Check if amount was updated to trigger payment status recalculation
            if (updates.amount !== undefined) {
                await TransactionService.updatePaymentStatus(id, undefined, client);
            }
            await client.query('COMMIT');
            // Emit real-time update
            websocket_1.WebSocketService.emitTransactionUpdate({
                type: 'transaction_updated',
                transaction,
                timestamp: new Date()
            });
            return transaction;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    static async delete(id) {
        const client = await database_1.pool.connect();
        try {
            await client.query('BEGIN');
            await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [id]);
            const query = `DELETE FROM transactions WHERE id = $1`;
            const result = await client.query(query, [id]);
            if (result.rowCount === 0) {
                throw new Error('Transaction not found');
            }
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
        // Emit real-time update
        websocket_1.WebSocketService.emitTransactionUpdate({
            type: 'transaction_deleted',
            transactionId: id,
            timestamp: new Date()
        });
    }
    static async getDailySummary(date = new Date()) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        // 1. Global totals
        const totalsQ = `
      SELECT COUNT(*)::int AS total_transactions,
             COALESCE(SUM(amount),0)::numeric AS total_amount
      FROM transactions
      WHERE transaction_date BETWEEN $1 AND $2
    `;
        // 2. Per-mode breakdown
        const modesQ = `
      SELECT payment_mode,
             COUNT(*)::int AS count,
             COALESCE(SUM(amount),0)::numeric AS amount
      FROM transactions
      WHERE transaction_date BETWEEN $1 AND $2
      GROUP BY payment_mode
    `;
        // Payment status breakdown
        const paymentStatusQ = `
      SELECT 
        payment_status,
        COUNT(*)::int as count
      FROM transactions
      WHERE transaction_date BETWEEN $1 AND $2
      GROUP BY payment_status
    `;
        // Sales agent breakdown
        const agentQuery = `
      SELECT 
        u.full_name as agent_name,
        COUNT(t.*)::int as count,
        COALESCE(SUM(t.amount),0)::numeric as amount
      FROM transactions t
      LEFT JOIN users u ON t.sales_agent_id = u.id
      WHERE t.transaction_date BETWEEN $1 AND $2
      GROUP BY u.id, u.full_name
      ORDER BY amount DESC
    `;
        try {
            const [totalsResult, modesResult, paymentStatusResult, agentResult, customerCount] = await Promise.all([
                database_1.pool.query(totalsQ, [startOfDay, endOfDay]),
                database_1.pool.query(modesQ, [startOfDay, endOfDay]),
                database_1.pool.query(paymentStatusQ, [startOfDay, endOfDay]),
                database_1.pool.query(agentQuery, [startOfDay, endOfDay]),
                customer_1.CustomerService.countRegisteredToday()
            ]);
            const paymentModeBreakdown = {
                [types_1.PaymentMode.CASH]: { amount: 0, count: 0 },
                [types_1.PaymentMode.GCASH]: { amount: 0, count: 0 },
                [types_1.PaymentMode.MAYA]: { amount: 0, count: 0 },
                [types_1.PaymentMode.CREDIT_CARD]: { amount: 0, count: 0 },
                [types_1.PaymentMode.BANK_TRANSFER]: { amount: 0, count: 0 }
            };
            // Get global totals from the first query with better null handling
            const globalTotals = totalsResult.rows[0] || { total_transactions: null, total_amount: null };
            const totalAmount = parseFloat(globalTotals.total_amount || '0') || 0;
            const totalTransactions = parseInt(globalTotals.total_transactions || '0') || 0;
            // Calculate payment status breakdown
            let paidTransactions = 0;
            let unpaidTransactions = 0;
            paymentStatusResult.rows.forEach(row => {
                const count = parseInt(row.count || '0') || 0;
                if (row.payment_status === 'paid') {
                    paidTransactions = count;
                }
                else if (row.payment_status === 'pending' || row.payment_status === 'unpaid') {
                    unpaidTransactions += count;
                }
            });
            // Map results into the predefined paymentModeBreakdown object with better null handling
            modesResult.rows.forEach(row => {
                const mode = row.payment_mode;
                if (paymentModeBreakdown.hasOwnProperty(mode)) {
                    paymentModeBreakdown[mode] = {
                        amount: parseFloat(row.amount || '0') || 0,
                        count: parseInt(row.count || '0') || 0
                    };
                }
            });
            return {
                totalAmount,
                totalTransactions,
                paidTransactions,
                unpaidTransactions,
                paymentModeBreakdown,
                salesAgentBreakdown: agentResult.rows.map(row => ({
                    agent_name: row.agent_name,
                    amount: parseFloat(row.amount || '0') || 0,
                    count: parseInt(row.count || '0') || 0
                })),
                registeredCustomers: customerCount
            };
        }
        catch (error) {
            // Properly propagate database errors
            throw error;
        }
    }
    static async getMonthlyReport(year, month) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        const query = `
      SELECT 
        DATE(transaction_date) as date,
        COUNT(*) as transactions,
        SUM(amount) as amount,
        u.full_name as agent_name
      FROM transactions t
      LEFT JOIN users u ON t.sales_agent_id = u.id
      WHERE transaction_date >= $1 AND transaction_date <= $2
      GROUP BY DATE(transaction_date), u.id, u.full_name
      ORDER BY date DESC
    `;
        const result = await database_1.pool.query(query, [startDate, endDate]);
        const dailyBreakdown = {};
        const agentTotals = {};
        let totalAmount = 0;
        let totalTransactions = 0;
        result.rows.forEach(row => {
            const date = row.date.toISOString().split('T')[0];
            const amount = parseFloat(row.amount);
            const transactions = parseInt(row.transactions);
            if (!dailyBreakdown[date]) {
                dailyBreakdown[date] = { amount: 0, transactions: 0 };
            }
            dailyBreakdown[date].amount += amount;
            dailyBreakdown[date].transactions += transactions;
            if (row.agent_name) {
                if (!agentTotals[row.agent_name]) {
                    agentTotals[row.agent_name] = { amount: 0, transactions: 0 };
                }
                agentTotals[row.agent_name].amount += amount;
                agentTotals[row.agent_name].transactions += transactions;
            }
            totalAmount += amount;
            totalTransactions += transactions;
        });
        return {
            dailyBreakdown: Object.entries(dailyBreakdown).map(([date, data]) => ({
                date,
                amount: data.amount,
                transactions: data.transactions
            })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            totalAmount,
            totalTransactions,
            topSalesAgents: Object.entries(agentTotals)
                .map(([agent_name, data]) => ({
                agent_name,
                amount: data.amount,
                transactions: data.transactions
            }))
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 10)
        };
    }
    static async getPaymentModeStats(startDate, endDate) {
        const query = `
      SELECT 
        payment_mode,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count,
        ROUND((SUM(amount) * 100.0) / (SELECT SUM(amount) FROM transactions WHERE transaction_date >= $1 AND transaction_date <= $2), 2) as percentage
      FROM transactions
      WHERE transaction_date >= $1 AND transaction_date <= $2
      GROUP BY payment_mode
      ORDER BY total_amount DESC
    `;
        const result = await database_1.pool.query(query, [startDate, endDate]);
        return result.rows.map(row => ({
            payment_mode: row.payment_mode,
            total_amount: parseFloat(row.total_amount),
            transaction_count: parseInt(row.transaction_count),
            percentage: parseFloat(row.percentage)
        }));
    }
}
exports.TransactionService = TransactionService;
class ReportService {
    /**
     * Normalizes a daily report row from the database, ensuring all numeric fields are never null
     * @param row Raw database row
     * @returns Normalized DailyReport object with guaranteed numeric values
     */
    static normalizeDailyReport(row) {
        return {
            date: row.date || '',
            total_cash: row.total_cash ?? 0,
            total_gcash: row.total_gcash ?? 0,
            total_maya: row.total_maya ?? 0,
            total_credit_card: row.total_credit_card ?? 0,
            total_bank_transfer: row.total_bank_transfer ?? 0,
            petty_cash_start: row.petty_cash_start ?? 0,
            petty_cash_end: row.petty_cash_end ?? 0,
            expenses: row.expenses ?? [],
            funds: row.funds ?? [],
            cash_turnover: row.cash_turnover ?? 0,
            transaction_count: row.transaction_count ?? 0
        };
    }
    static async generateDailyReport(date, expenses = [], funds = [], pettyCashStart = 0, pettyCashEnd = 0) {
        const summary = await TransactionService.getDailySummary(date);
        const totalFundsAmount = funds.reduce((sum, fund) => sum + fund.amount, 0);
        const totalExpensesAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);
        // Cash Turnover Formula: (PettyCashStart + Cash + Gcash + Maya + Credit Card + Funds + BankTransfer) - Expenses - PettyCashEnd
        const cashTurnover = (pettyCashStart +
            summary.paymentModeBreakdown[types_1.PaymentMode.CASH].amount +
            summary.paymentModeBreakdown[types_1.PaymentMode.GCASH].amount +
            summary.paymentModeBreakdown[types_1.PaymentMode.MAYA].amount +
            summary.paymentModeBreakdown[types_1.PaymentMode.CREDIT_CARD].amount +
            summary.paymentModeBreakdown[types_1.PaymentMode.BANK_TRANSFER].amount +
            totalFundsAmount) - totalExpensesAmount - pettyCashEnd;
        return {
            date: date.toISOString().split('T')[0],
            total_cash: summary.paymentModeBreakdown[types_1.PaymentMode.CASH].amount,
            total_gcash: summary.paymentModeBreakdown[types_1.PaymentMode.GCASH].amount,
            total_maya: summary.paymentModeBreakdown[types_1.PaymentMode.MAYA].amount,
            total_credit_card: summary.paymentModeBreakdown[types_1.PaymentMode.CREDIT_CARD].amount,
            total_bank_transfer: summary.paymentModeBreakdown[types_1.PaymentMode.BANK_TRANSFER].amount,
            petty_cash_start: pettyCashStart,
            petty_cash_end: pettyCashEnd,
            expenses,
            funds,
            cash_turnover: cashTurnover,
            transaction_count: summary.totalTransactions
        };
    }
    static async saveDailyReport(report) {
        const query = `
      INSERT INTO daily_reports (
        date, total_cash, total_gcash, total_maya, total_credit_card, 
        total_bank_transfer, petty_cash_start, petty_cash_end, 
        expenses, funds, cash_turnover, transaction_count
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (date) 
      DO UPDATE SET
        total_cash = EXCLUDED.total_cash,
        total_gcash = EXCLUDED.total_gcash,
        total_maya = EXCLUDED.total_maya,
        total_credit_card = EXCLUDED.total_credit_card,
        total_bank_transfer = EXCLUDED.total_bank_transfer,
        petty_cash_start = EXCLUDED.petty_cash_start,
        petty_cash_end = EXCLUDED.petty_cash_end,
        expenses = EXCLUDED.expenses,
        funds = EXCLUDED.funds,
        cash_turnover = EXCLUDED.cash_turnover,
        transaction_count = EXCLUDED.transaction_count,
        updated_at = CURRENT_TIMESTAMP
    `;
        const values = [
            report.date,
            report.total_cash,
            report.total_gcash,
            report.total_maya,
            report.total_credit_card,
            report.total_bank_transfer,
            report.petty_cash_start,
            report.petty_cash_end,
            JSON.stringify(report.expenses),
            JSON.stringify(report.funds),
            report.cash_turnover,
            report.transaction_count
        ];
        await database_1.pool.query(query, values);
    }
    static async getDailyReport(date) {
        const query = `
      SELECT * FROM daily_reports
      WHERE date = $1
    `;
        const result = await database_1.pool.query(query, [date]);
        if (result.rows.length === 0) {
            return null;
        }
        const row = result.rows[0];
        return this.normalizeDailyReport(row);
    }
    static async deleteDailyReport(date) {
        const query = `
      DELETE FROM daily_reports
      WHERE date = $1
    `;
        const result = await database_1.pool.query(query, [date]);
        return (result.rowCount ?? 0) > 0;
    }
    static async getAllDailyReports() {
        const query = `
      SELECT * FROM daily_reports
      ORDER BY date DESC
    `;
        const result = await database_1.pool.query(query);
        return result.rows.map(row => this.normalizeDailyReport(row));
    }
}
exports.ReportService = ReportService;
//# sourceMappingURL=transaction.js.map