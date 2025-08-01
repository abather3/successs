"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("../../config/database");
const transaction_1 = require("../../services/transaction");
const paymentSettlementService_1 = require("../../services/paymentSettlementService");
const types_1 = require("../../types");
describe('Migration Backward Compatibility Tests', () => {
    let testCustomerId;
    let testSalesAgentId;
    let testCashierId;
    beforeAll(async () => {
        // Create test users and customer
        const client = await database_1.pool.connect();
        try {
            // Create test customer
            const customerResult = await client.query(`
        INSERT INTO customers (name, contact_number, email, age, address, or_number, 
                              distribution_info, sales_agent_id, prescription, grade_type, 
                              lens_type, estimated_time, payment_info, priority_flags, 
                              queue_status, token_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id
      `, [
                'Legacy Customer', '1234567890', 'legacy@example.com', 35, 'Legacy Address', 'LEGACY-OR-001',
                'pickup', 1, '{}', 'single', 'regular', '{"days": 1, "hours": 0, "minutes": 0}',
                '{"mode": "cash", "amount": 1500}', '{"senior_citizen": false, "pregnant": false, "pwd": false}',
                'waiting', 1
            ]);
            testCustomerId = customerResult.rows[0].id;
            // Create test users
            const salesResult = await client.query(`
        INSERT INTO users (email, password, full_name, role, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, ['migration-sales@test.com', 'hashedpassword', 'Migration Sales Agent', 'sales', 'active']);
            testSalesAgentId = salesResult.rows[0].id;
            const cashierResult = await client.query(`
        INSERT INTO users (email, password, full_name, role, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, ['migration-cashier@test.com', 'hashedpassword', 'Migration Cashier', 'cashier', 'active']);
            testCashierId = cashierResult.rows[0].id;
        }
        finally {
            client.release();
        }
    });
    afterAll(async () => {
        // Clean up test data
        const client = await database_1.pool.connect();
        try {
            await client.query('DELETE FROM customers WHERE id = $1', [testCustomerId]);
            await client.query('DELETE FROM users WHERE id IN ($1, $2)', [testSalesAgentId, testCashierId]);
        }
        finally {
            client.release();
        }
    });
    describe('Legacy Transaction Migration', () => {
        let legacyTransactionId;
        beforeEach(async () => {
            // Create a legacy transaction directly in the database (simulating old data)
            const client = await database_1.pool.connect();
            try {
                // Insert legacy transaction without payment tracking fields
                const result = await client.query(`
          INSERT INTO transactions (customer_id, or_number, amount, payment_mode, sales_agent_id, cashier_id, transaction_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [testCustomerId, `LEGACY-${Date.now()}`, 1500, 'cash', testSalesAgentId, testCashierId, new Date()]);
                legacyTransactionId = result.rows[0].id;
                // Simulate legacy state - reset payment tracking columns to simulate pre-migration state
                await client.query(`
          UPDATE transactions 
          SET paid_amount = NULL, payment_status = NULL
          WHERE id = $1
        `, [legacyTransactionId]);
            }
            finally {
                client.release();
            }
        });
        afterEach(async () => {
            // Clean up
            const client = await database_1.pool.connect();
            try {
                await client.query('DELETE FROM payment_settlements WHERE transaction_id = $1', [legacyTransactionId]);
                await client.query('DELETE FROM transactions WHERE id = $1', [legacyTransactionId]);
            }
            finally {
                client.release();
            }
        });
        it('should apply default values to legacy transactions', async () => {
            // Simulate the migration update that sets default values
            const client = await database_1.pool.connect();
            try {
                // Apply migration default values
                await client.query(`
          UPDATE transactions 
          SET paid_amount = COALESCE(paid_amount, amount),
              payment_status = COALESCE(payment_status, 'paid')
          WHERE id = $1
        `, [legacyTransactionId]);
                // Verify the transaction now has the expected default values
                const transaction = await transaction_1.TransactionService.findById(legacyTransactionId);
                expect(transaction).toBeDefined();
                expect(transaction?.paid_amount).toBe(1500);
                expect(transaction?.payment_status).toBe('paid');
                expect(transaction?.amount).toBe(1500);
            }
            finally {
                client.release();
            }
        });
        it('should handle legacy transactions with payment settlements', async () => {
            // Apply migration defaults
            const client = await database_1.pool.connect();
            try {
                await client.query(`
          UPDATE transactions 
          SET paid_amount = COALESCE(paid_amount, amount),
              payment_status = COALESCE(payment_status, 'paid')
          WHERE id = $1
        `, [legacyTransactionId]);
                // Verify legacy transaction behaves correctly with new payment system
                const transaction = await transaction_1.TransactionService.findById(legacyTransactionId);
                expect(transaction?.payment_status).toBe('paid');
                // Now try to add additional settlements (should fail for overpayment)
                await expect(paymentSettlementService_1.PaymentSettlementService.createSettlement(legacyTransactionId, 100, types_1.PaymentMode.GCASH, testCashierId)).rejects.toThrow('Settlement amount (100) exceeds remaining balance (0)');
            }
            finally {
                client.release();
            }
        });
        it('should correctly calculate balance for legacy transactions', async () => {
            // Apply migration defaults
            const client = await database_1.pool.connect();
            try {
                await client.query(`
          UPDATE transactions 
          SET paid_amount = COALESCE(paid_amount, amount),
              payment_status = COALESCE(payment_status, 'paid')
          WHERE id = $1
        `, [legacyTransactionId]);
                // Verify balance calculation
                const transaction = await transaction_1.TransactionService.findById(legacyTransactionId);
                expect(transaction?.amount).toBe(1500);
                expect(transaction?.paid_amount).toBe(1500);
                // Balance should be 0 for fully paid legacy transactions
                const balanceAmount = (transaction?.amount || 0) - (transaction?.paid_amount || 0);
                expect(balanceAmount).toBe(0);
            }
            finally {
                client.release();
            }
        });
        it('should handle legacy transactions with NULL payment fields', async () => {
            // Test the transaction before migration
            const client = await database_1.pool.connect();
            try {
                // Check raw database state before migration
                const result = await client.query(`
          SELECT id, amount, paid_amount, payment_status 
          FROM transactions 
          WHERE id = $1
        `, [legacyTransactionId]);
                const rawTransaction = result.rows[0];
                expect(rawTransaction.amount).toBe(1500);
                expect(rawTransaction.paid_amount).toBeNull();
                expect(rawTransaction.payment_status).toBeNull();
                // Apply migration
                await client.query(`
          UPDATE transactions 
          SET paid_amount = COALESCE(paid_amount, amount),
              payment_status = COALESCE(payment_status, 'paid')
          WHERE paid_amount IS NULL OR payment_status IS NULL
        `);
                // Verify post-migration state
                const postMigrationResult = await client.query(`
          SELECT id, amount, paid_amount, payment_status 
          FROM transactions 
          WHERE id = $1
        `, [legacyTransactionId]);
                const postMigrationTransaction = postMigrationResult.rows[0];
                expect(postMigrationTransaction.amount).toBe(1500);
                expect(postMigrationTransaction.paid_amount).toBe(1500);
                expect(postMigrationTransaction.payment_status).toBe('paid');
            }
            finally {
                client.release();
            }
        });
        it('should preserve legacy transaction data integrity', async () => {
            const client = await database_1.pool.connect();
            try {
                // Store original transaction data
                const originalResult = await client.query(`
          SELECT customer_id, or_number, amount, payment_mode, sales_agent_id, cashier_id, transaction_date
          FROM transactions 
          WHERE id = $1
        `, [legacyTransactionId]);
                const originalData = originalResult.rows[0];
                // Apply migration
                await client.query(`
          UPDATE transactions 
          SET paid_amount = COALESCE(paid_amount, amount),
              payment_status = COALESCE(payment_status, 'paid')
          WHERE id = $1
        `, [legacyTransactionId]);
                // Verify original data is preserved
                const migratedResult = await client.query(`
          SELECT customer_id, or_number, amount, payment_mode, sales_agent_id, cashier_id, transaction_date
          FROM transactions 
          WHERE id = $1
        `, [legacyTransactionId]);
                const migratedData = migratedResult.rows[0];
                expect(migratedData.customer_id).toBe(originalData.customer_id);
                expect(migratedData.or_number).toBe(originalData.or_number);
                expect(migratedData.amount).toBe(originalData.amount);
                expect(migratedData.payment_mode).toBe(originalData.payment_mode);
                expect(migratedData.sales_agent_id).toBe(originalData.sales_agent_id);
                expect(migratedData.cashier_id).toBe(originalData.cashier_id);
                expect(migratedData.transaction_date).toEqual(originalData.transaction_date);
            }
            finally {
                client.release();
            }
        });
    });
    describe('Mixed Legacy and New Transaction Scenarios', () => {
        let legacyTransactionId;
        let newTransactionId;
        beforeEach(async () => {
            // Create a legacy transaction
            const client = await database_1.pool.connect();
            try {
                const legacyResult = await client.query(`
          INSERT INTO transactions (customer_id, or_number, amount, payment_mode, sales_agent_id, cashier_id, transaction_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [testCustomerId, `LEGACY-${Date.now()}`, 1000, 'cash', testSalesAgentId, testCashierId, new Date()]);
                legacyTransactionId = legacyResult.rows[0].id;
                // Reset payment tracking columns
                await client.query(`
          UPDATE transactions 
          SET paid_amount = NULL, payment_status = NULL
          WHERE id = $1
        `, [legacyTransactionId]);
            }
            finally {
                client.release();
            }
            // Create a new transaction using the service
            const newTransaction = await transaction_1.TransactionService.create({
                customer_id: testCustomerId,
                or_number: `NEW-${Date.now()}`,
                amount: 1000,
                payment_mode: types_1.PaymentMode.CASH,
                sales_agent_id: testSalesAgentId,
                cashier_id: testCashierId
            });
            newTransactionId = newTransaction.id;
        });
        afterEach(async () => {
            const client = await database_1.pool.connect();
            try {
                await client.query('DELETE FROM payment_settlements WHERE transaction_id IN ($1, $2)', [legacyTransactionId, newTransactionId]);
                await client.query('DELETE FROM transactions WHERE id IN ($1, $2)', [legacyTransactionId, newTransactionId]);
            }
            finally {
                client.release();
            }
        });
        it('should handle mixed legacy and new transactions correctly', async () => {
            // Apply migration to legacy transaction
            const client = await database_1.pool.connect();
            try {
                await client.query(`
          UPDATE transactions 
          SET paid_amount = COALESCE(paid_amount, amount),
              payment_status = COALESCE(payment_status, 'paid')
          WHERE id = $1
        `, [legacyTransactionId]);
                // Verify legacy transaction
                const legacyTransaction = await transaction_1.TransactionService.findById(legacyTransactionId);
                expect(legacyTransaction?.payment_status).toBe('paid');
                expect(legacyTransaction?.paid_amount).toBe(1000);
                // Verify new transaction
                const newTransaction = await transaction_1.TransactionService.findById(newTransactionId);
                expect(newTransaction?.payment_status).toBe('paid');
                expect(newTransaction?.paid_amount).toBe(1000);
                // Both should behave the same way
                await expect(paymentSettlementService_1.PaymentSettlementService.createSettlement(legacyTransactionId, 100, types_1.PaymentMode.GCASH, testCashierId)).rejects.toThrow('exceeds remaining balance');
                await expect(paymentSettlementService_1.PaymentSettlementService.createSettlement(newTransactionId, 100, types_1.PaymentMode.GCASH, testCashierId)).rejects.toThrow('exceeds remaining balance');
            }
            finally {
                client.release();
            }
        });
        it('should allow settlements on legacy transactions after migration', async () => {
            // Apply migration with unpaid status to test settlements
            const client = await database_1.pool.connect();
            try {
                await client.query(`
          UPDATE transactions 
          SET paid_amount = 0,
              payment_status = 'unpaid'
          WHERE id = $1
        `, [legacyTransactionId]);
                // Now we can add settlements to the legacy transaction
                const result = await paymentSettlementService_1.PaymentSettlementService.createSettlement(legacyTransactionId, 500, types_1.PaymentMode.GCASH, testCashierId);
                expect(result.transaction.payment_status).toBe('partial');
                expect(result.transaction.paid_amount).toBe(500);
                expect(result.settlements).toHaveLength(1);
            }
            finally {
                client.release();
            }
        });
    });
    describe('Migration Performance and Data Integrity', () => {
        it('should handle large batch migration efficiently', async () => {
            // Create multiple legacy transactions
            const client = await database_1.pool.connect();
            const transactionIds = [];
            try {
                // Insert multiple legacy transactions
                for (let i = 0; i < 100; i++) {
                    const result = await client.query(`
            INSERT INTO transactions (customer_id, or_number, amount, payment_mode, sales_agent_id, cashier_id, transaction_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
          `, [testCustomerId, `BATCH-${i}-${Date.now()}`, 1000 + i, 'cash', testSalesAgentId, testCashierId, new Date()]);
                    transactionIds.push(result.rows[0].id);
                }
                // Reset payment tracking columns
                await client.query(`
          UPDATE transactions 
          SET paid_amount = NULL, payment_status = NULL
          WHERE id = ANY($1)
        `, [transactionIds]);
                // Measure migration performance
                const startTime = Date.now();
                // Apply batch migration
                await client.query(`
          UPDATE transactions 
          SET paid_amount = COALESCE(paid_amount, amount),
              payment_status = COALESCE(payment_status, 'paid')
          WHERE id = ANY($1)
        `, [transactionIds]);
                const endTime = Date.now();
                const migrationTime = endTime - startTime;
                // Verify all transactions were migrated correctly
                const result = await client.query(`
          SELECT id, amount, paid_amount, payment_status 
          FROM transactions 
          WHERE id = ANY($1)
        `, [transactionIds]);
                expect(result.rows).toHaveLength(100);
                result.rows.forEach((row, index) => {
                    expect(row.amount).toBe(1000 + index);
                    expect(row.paid_amount).toBe(1000 + index);
                    expect(row.payment_status).toBe('paid');
                });
                // Migration should be reasonably fast (less than 1 second for 100 records)
                expect(migrationTime).toBeLessThan(1000);
                // Clean up
                await client.query('DELETE FROM transactions WHERE id = ANY($1)', [transactionIds]);
            }
            finally {
                client.release();
            }
        });
        it('should maintain referential integrity during migration', async () => {
            const client = await database_1.pool.connect();
            try {
                // Create a legacy transaction
                const result = await client.query(`
          INSERT INTO transactions (customer_id, or_number, amount, payment_mode, sales_agent_id, cashier_id, transaction_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [testCustomerId, `INTEGRITY-${Date.now()}`, 1000, 'cash', testSalesAgentId, testCashierId, new Date()]);
                const transactionId = result.rows[0].id;
                // Reset payment tracking columns
                await client.query(`
          UPDATE transactions 
          SET paid_amount = NULL, payment_status = NULL
          WHERE id = $1
        `, [transactionId]);
                // Verify foreign key relationships are maintained
                const integrityCheck = await client.query(`
          SELECT t.id, t.customer_id, t.sales_agent_id, t.cashier_id,
                 c.id as customer_exists,
                 u1.id as sales_agent_exists,
                 u2.id as cashier_exists
          FROM transactions t
          LEFT JOIN customers c ON t.customer_id = c.id
          LEFT JOIN users u1 ON t.sales_agent_id = u1.id
          LEFT JOIN users u2 ON t.cashier_id = u2.id
          WHERE t.id = $1
        `, [transactionId]);
                const integrityResult = integrityCheck.rows[0];
                expect(integrityResult.customer_exists).toBe(testCustomerId);
                expect(integrityResult.sales_agent_exists).toBe(testSalesAgentId);
                expect(integrityResult.cashier_exists).toBe(testCashierId);
                // Apply migration
                await client.query(`
          UPDATE transactions 
          SET paid_amount = COALESCE(paid_amount, amount),
              payment_status = COALESCE(payment_status, 'paid')
          WHERE id = $1
        `, [transactionId]);
                // Verify referential integrity is still maintained
                const postMigrationCheck = await client.query(`
          SELECT t.id, t.customer_id, t.sales_agent_id, t.cashier_id,
                 c.id as customer_exists,
                 u1.id as sales_agent_exists,
                 u2.id as cashier_exists
          FROM transactions t
          LEFT JOIN customers c ON t.customer_id = c.id
          LEFT JOIN users u1 ON t.sales_agent_id = u1.id
          LEFT JOIN users u2 ON t.cashier_id = u2.id
          WHERE t.id = $1
        `, [transactionId]);
                const postMigrationResult = postMigrationCheck.rows[0];
                expect(postMigrationResult.customer_exists).toBe(testCustomerId);
                expect(postMigrationResult.sales_agent_exists).toBe(testSalesAgentId);
                expect(postMigrationResult.cashier_exists).toBe(testCashierId);
                // Clean up
                await client.query('DELETE FROM transactions WHERE id = $1', [transactionId]);
            }
            finally {
                client.release();
            }
        });
    });
    describe('Old Client vs New Backend Compatibility', () => {
        let legacyTransactionId;
        let legacyCustomerId;
        beforeEach(async () => {
            // Create legacy customer using old client format (without new fields)
            const client = await database_1.pool.connect();
            try {
                const customerResult = await client.query(`
          INSERT INTO customers (name, contact_number, email, age, address, or_number, 
                                distribution_info, sales_agent_id, prescription, grade_type, 
                                lens_type, estimated_time, payment_info, priority_flags, 
                                queue_status, token_number)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING id
        `, [
                    'Legacy Client Customer', '1234567890', 'legacy-client@example.com', 35, 'Legacy Address',
                    `LEGACY-CLIENT-${Date.now()}`, 'pickup', testSalesAgentId, '{}', 'single', 'regular',
                    '{"days": 1, "hours": 0, "minutes": 0}', '{"mode": "cash", "amount": 1200}',
                    '{"senior_citizen": false, "pregnant": false, "pwd": false}', 'waiting', 1
                ]);
                legacyCustomerId = customerResult.rows[0].id;
                // Create legacy transaction (old format without new payment tracking)
                const transactionResult = await client.query(`
          INSERT INTO transactions (customer_id, or_number, amount, payment_mode, sales_agent_id, cashier_id, transaction_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [legacyCustomerId, `LEGACY-CLIENT-${Date.now()}`, 1200, 'cash', testSalesAgentId, testCashierId, new Date()]);
                legacyTransactionId = transactionResult.rows[0].id;
                // Simulate legacy state - no payment tracking fields
                await client.query(`
          UPDATE transactions 
          SET paid_amount = NULL, payment_status = NULL
          WHERE id = $1
        `, [legacyTransactionId]);
            }
            finally {
                client.release();
            }
        });
        afterEach(async () => {
            const client = await database_1.pool.connect();
            try {
                await client.query('DELETE FROM payment_settlements WHERE transaction_id = $1', [legacyTransactionId]);
                await client.query('DELETE FROM transactions WHERE id = $1', [legacyTransactionId]);
                await client.query('DELETE FROM customers WHERE id = $1', [legacyCustomerId]);
            }
            finally {
                client.release();
            }
        });
        it('should handle legacy transaction queries from old client', async () => {
            // Simulate old client requesting transaction data (without new fields)
            const client = await database_1.pool.connect();
            try {
                // Old client query format (doesn't expect new payment tracking columns)
                const oldClientQuery = `
          SELECT id, customer_id, or_number, amount, payment_mode, 
                 sales_agent_id, cashier_id, transaction_date, created_at
          FROM transactions
          WHERE id = $1
        `;
                const result = await client.query(oldClientQuery, [legacyTransactionId]);
                // Should successfully return legacy transaction data
                expect(result.rows.length).toBe(1);
                expect(result.rows[0].id).toBe(legacyTransactionId);
                expect(result.rows[0].customer_id).toBe(legacyCustomerId);
                expect(result.rows[0].amount).toBe(1200);
                expect(result.rows[0].payment_mode).toBe('cash');
            }
            finally {
                client.release();
            }
        });
        it('should allow legacy client to retrieve customer without new fields', async () => {
            // Simulate old client customer query
            const client = await database_1.pool.connect();
            try {
                const oldClientCustomerQuery = `
          SELECT id, name, contact_number, email, or_number, queue_status, created_at
          FROM customers
          WHERE id = $1
        `;
                const result = await client.query(oldClientCustomerQuery, [legacyCustomerId]);
                expect(result.rows.length).toBe(1);
                expect(result.rows[0].id).toBe(legacyCustomerId);
                expect(result.rows[0].name).toBe('Legacy Client Customer');
                expect(result.rows[0].queue_status).toBe('waiting');
            }
            finally {
                client.release();
            }
        });
        it('should support legacy API endpoints for transaction creation', async () => {
            // Simulate legacy API call format (without new payment fields)
            const TransactionService = require('../../services/transaction').TransactionService;
            // Create transaction using legacy format
            const legacyTransactionData = {
                customer_id: legacyCustomerId,
                or_number: `LEGACY-API-${Date.now()}`,
                amount: 800,
                payment_mode: 'gcash',
                sales_agent_id: testSalesAgentId,
                cashier_id: testCashierId
            };
            const createdTransaction = await TransactionService.create(legacyTransactionData);
            // New backend should handle legacy format and set default values
            expect(createdTransaction.id).toBeDefined();
            expect(createdTransaction.amount).toBe(800);
            expect(createdTransaction.payment_mode).toBe('gcash');
            expect(createdTransaction.payment_status).toBe('paid'); // Default value set by new backend
            expect(createdTransaction.paid_amount).toBe(800); // Default value set by new backend
            // Clean up
            await database_1.pool.query('DELETE FROM transactions WHERE id = $1', [createdTransaction.id]);
        });
        it('should maintain API compatibility for status updates', async () => {
            // Simulate legacy client updating customer status
            const client = await database_1.pool.connect();
            try {
                // Legacy status update (simple format)
                const legacyUpdateQuery = `
          UPDATE customers 
          SET queue_status = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING id, queue_status
        `;
                const result = await client.query(legacyUpdateQuery, ['serving', legacyCustomerId]);
                expect(result.rows.length).toBe(1);
                expect(result.rows[0].queue_status).toBe('serving');
                // Verify that new backend systems still work with legacy updates
                const customerAfterUpdate = await client.query('SELECT queue_status FROM customers WHERE id = $1', [legacyCustomerId]);
                expect(customerAfterUpdate.rows[0].queue_status).toBe('serving');
            }
            finally {
                client.release();
            }
        });
        it('should handle mixed legacy and modern API calls in same session', async () => {
            // Test that new backend can handle both legacy and modern client calls
            const TransactionService = require('../../services/transaction').TransactionService;
            const PaymentSettlementService = require('../../services/paymentSettlementService').PaymentSettlementService;
            // Apply migration to existing legacy transaction
            const client = await database_1.pool.connect();
            try {
                await client.query(`
          UPDATE transactions 
          SET paid_amount = COALESCE(paid_amount, 0),
              payment_status = COALESCE(payment_status, 'unpaid')
          WHERE id = $1
        `, [legacyTransactionId]);
            }
            finally {
                client.release();
            }
            // Legacy client retrieves transaction
            const legacyTransaction = await TransactionService.findById(legacyTransactionId);
            expect(legacyTransaction.amount).toBe(1200);
            expect(legacyTransaction.payment_status).toBe('unpaid');
            // Modern client adds settlement to same transaction
            const settlement = await PaymentSettlementService.createSettlement(legacyTransactionId, 600, 'gcash', testCashierId);
            expect(settlement.transaction.payment_status).toBe('partial');
            expect(settlement.transaction.paid_amount).toBe(600);
            // Legacy client can still retrieve updated transaction
            const updatedTransaction = await TransactionService.findById(legacyTransactionId);
            expect(updatedTransaction.paid_amount).toBe(600);
            expect(updatedTransaction.payment_status).toBe('partial');
        });
        it('should maintain backward compatibility for queue operations', async () => {
            // Test that legacy queue operations still work with new backend
            const QueueService = require('../../services/queue').QueueService;
            // Legacy client gets queue (without new fields)
            const queue = await QueueService.getQueue();
            expect(Array.isArray(queue)).toBe(true);
            // Find our legacy customer in queue
            const legacyCustomerInQueue = queue.find(item => item.customer.id === legacyCustomerId);
            expect(legacyCustomerInQueue).toBeDefined();
            expect(legacyCustomerInQueue.customer.name).toBe('Legacy Client Customer');
            // Legacy status change operation
            const updatedCustomer = await QueueService.changeStatus(legacyCustomerId, 'serving');
            expect(updatedCustomer.queue_status).toBe('serving');
        });
        it('should handle legacy database schema gracefully', async () => {
            // Test edge cases where legacy data might have different formats
            const client = await database_1.pool.connect();
            try {
                // Insert transaction with minimal legacy fields
                const minimalLegacyResult = await client.query(`
          INSERT INTO transactions (customer_id, or_number, amount, payment_mode, transaction_date)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `, [legacyCustomerId, `MINIMAL-${Date.now()}`, 500, 'cash', new Date()]);
                const minimalTransactionId = minimalLegacyResult.rows[0].id;
                // New backend should handle this gracefully
                const TransactionService = require('../../services/transaction').TransactionService;
                const transaction = await TransactionService.findById(minimalTransactionId);
                expect(transaction.id).toBe(minimalTransactionId);
                expect(transaction.amount).toBe(500);
                // Clean up
                await client.query('DELETE FROM transactions WHERE id = $1', [minimalTransactionId]);
            }
            finally {
                client.release();
            }
        });
    });
});
//# sourceMappingURL=backward-compatibility.test.js.map