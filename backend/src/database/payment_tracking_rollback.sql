-- Complete rollback script for payment tracking features
-- This script removes all payment tracking capabilities added by the migration

-- ============================================================================
-- ROLLBACK START
-- ============================================================================

-- Drop triggers first
DROP TRIGGER IF EXISTS trigger_update_payment_status ON transactions;
DROP TRIGGER IF EXISTS trigger_update_transaction_paid_amount_insert ON payment_settlements;
DROP TRIGGER IF EXISTS trigger_update_transaction_paid_amount_update ON payment_settlements;
DROP TRIGGER IF EXISTS trigger_update_transaction_paid_amount_delete ON payment_settlements;

-- Drop functions
DROP FUNCTION IF EXISTS update_payment_status();
DROP FUNCTION IF EXISTS update_transaction_paid_amount();

-- Drop indexes for payment_settlements table
DROP INDEX IF EXISTS idx_payment_settlements_transaction_id;
DROP INDEX IF EXISTS idx_payment_settlements_paid_at;
DROP INDEX IF EXISTS idx_payment_settlements_cashier_id;
DROP INDEX IF EXISTS idx_payment_settlements_payment_mode;

-- Drop additional indexes for transactions table
DROP INDEX IF EXISTS idx_transactions_payment_status;
DROP INDEX IF EXISTS idx_transactions_paid_amount;
DROP INDEX IF EXISTS idx_transactions_balance_amount;

-- Drop payment_settlements table (must be done before removing columns due to foreign key)
DROP TABLE IF EXISTS payment_settlements;

-- Remove columns from transactions table
ALTER TABLE transactions 
DROP COLUMN IF EXISTS paid_amount,
DROP COLUMN IF EXISTS balance_amount,
DROP COLUMN IF EXISTS payment_status;

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================
