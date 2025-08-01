-- ============================================================================
-- BALANCE CALCULATION FIX: GENERATED COLUMN APPROACH
-- ============================================================================
-- This migration converts balance_amount to a GENERATED column that is 
-- automatically calculated by PostgreSQL as (amount - paid_amount)

BEGIN;

-- Step 1: Drop the existing balance_amount column
-- (We need to drop it because PostgreSQL doesn't allow changing a regular column to generated)
ALTER TABLE transactions DROP COLUMN IF EXISTS balance_amount;

-- Step 2: Add balance_amount as a GENERATED ALWAYS column
-- This will be automatically calculated whenever amount or paid_amount changes
ALTER TABLE transactions 
ADD COLUMN balance_amount DECIMAL(10,2) 
GENERATED ALWAYS AS (amount - paid_amount) STORED;

-- Step 3: Add index on the generated column for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_balance_amount 
ON transactions(balance_amount) WHERE balance_amount > 0;

-- Step 4: Add check constraint to ensure data integrity
ALTER TABLE transactions 
ADD CONSTRAINT chk_transactions_balance_positive 
CHECK (balance_amount >= 0);

-- Step 5: Update payment status trigger to work with the new structure
-- The trigger should now only update payment_status since balance_amount is auto-calculated
CREATE OR REPLACE FUNCTION update_payment_status_with_generated_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update payment_status since balance_amount is now auto-calculated
    IF NEW.paid_amount = 0 THEN
        NEW.payment_status = 'unpaid';
    ELSIF NEW.paid_amount >= NEW.amount THEN
        NEW.payment_status = 'paid';
    ELSE
        NEW.payment_status = 'partial';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger and create new one
DROP TRIGGER IF EXISTS trigger_update_payment_status ON transactions;
CREATE TRIGGER trigger_update_payment_status
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    WHEN (OLD.paid_amount IS DISTINCT FROM NEW.paid_amount)
    EXECUTE FUNCTION update_payment_status_with_generated_balance();

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify the new structure
SELECT column_name, data_type, column_default, generation_expression 
FROM information_schema.columns 
WHERE table_name = 'transactions' 
AND column_name IN ('amount', 'paid_amount', 'balance_amount');

-- Test that balance_amount is calculated correctly
SELECT 
    id, 
    or_number, 
    amount, 
    paid_amount, 
    balance_amount,
    (amount - paid_amount) as manual_calculation,
    CASE 
        WHEN balance_amount = (amount - paid_amount) THEN '✅ CORRECT'
        ELSE '❌ INCORRECT'
    END as validation
FROM transactions 
LIMIT 5;

-- Summary report
SELECT 
    'GENERATED COLUMN IMPLEMENTATION' as feature,
    COUNT(*) as total_transactions,
    COUNT(CASE WHEN balance_amount = (amount - paid_amount) THEN 1 END) as correct_calculations,
    COUNT(CASE WHEN balance_amount != (amount - paid_amount) THEN 1 END) as incorrect_calculations
FROM transactions;
