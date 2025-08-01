-- ============================================================================
-- BALANCE CALCULATION FIX: ENHANCED TRIGGERS APPROACH
-- ============================================================================
-- This approach keeps the current structure but adds comprehensive triggers
-- to ensure balance_amount is ALWAYS calculated correctly

BEGIN;

-- ============================================================================
-- STEP 1: CREATE COMPREHENSIVE BALANCE UPDATE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_transaction_balance_and_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Always recalculate balance_amount from paid_amount
    NEW.balance_amount = NEW.amount - NEW.paid_amount;
    
    -- Update payment_status based on the payment amounts
    IF NEW.paid_amount = 0 THEN
        NEW.payment_status = 'unpaid';
    ELSIF NEW.paid_amount >= NEW.amount THEN
        NEW.payment_status = 'paid';
    ELSE
        NEW.payment_status = 'partial';
    END IF;
    
    -- Ensure balance_amount is never negative (business rule)
    IF NEW.balance_amount < 0 THEN
        RAISE EXCEPTION 'Balance amount cannot be negative. Paid amount (%) exceeds transaction amount (%)', 
                        NEW.paid_amount, NEW.amount;
    END IF;
    
    -- Update timestamp
    NEW.updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2: CREATE SETTLEMENT BALANCE UPDATE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_transaction_from_settlements()
RETURNS TRIGGER AS $$
DECLARE
    transaction_record RECORD;
    total_settlements DECIMAL(10,2);
    target_transaction_id INTEGER;
BEGIN
    -- Determine which transaction to update based on the operation
    IF TG_OP = 'DELETE' THEN
        target_transaction_id = OLD.transaction_id;
    ELSE
        target_transaction_id = NEW.transaction_id;
    END IF;
    
    -- Calculate total settlements for this transaction
    SELECT COALESCE(SUM(amount), 0) INTO total_settlements
    FROM payment_settlements 
    WHERE transaction_id = target_transaction_id;
    
    -- Update the transaction with the new paid amount
    UPDATE transactions 
    SET paid_amount = total_settlements,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = target_transaction_id;
    
    -- The BEFORE UPDATE trigger on transactions will handle balance_amount and payment_status
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 3: DROP OLD TRIGGERS AND CREATE COMPREHENSIVE NEW ONES
-- ============================================================================

-- Drop existing triggers
DROP TRIGGER IF EXISTS trigger_update_payment_status ON transactions;
DROP TRIGGER IF EXISTS trigger_update_transaction_paid_amount_insert ON payment_settlements;
DROP TRIGGER IF EXISTS trigger_update_transaction_paid_amount_update ON payment_settlements;
DROP TRIGGER IF EXISTS trigger_update_transaction_paid_amount_delete ON payment_settlements;

-- Create comprehensive transaction trigger (handles balance_amount AND payment_status)
CREATE TRIGGER trigger_update_transaction_balance_and_status
    BEFORE INSERT OR UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_transaction_balance_and_status();

-- Create settlement triggers to update transactions when settlements change
CREATE TRIGGER trigger_settlement_insert
    AFTER INSERT ON payment_settlements
    FOR EACH ROW
    EXECUTE FUNCTION update_transaction_from_settlements();

CREATE TRIGGER trigger_settlement_update
    AFTER UPDATE ON payment_settlements
    FOR EACH ROW
    EXECUTE FUNCTION update_transaction_from_settlements();

CREATE TRIGGER trigger_settlement_delete
    AFTER DELETE ON payment_settlements
    FOR EACH ROW
    EXECUTE FUNCTION update_transaction_from_settlements();

-- ============================================================================
-- STEP 4: FIX ALL EXISTING DATA
-- ============================================================================

-- Update all transactions to have correct balance calculations
UPDATE transactions 
SET paid_amount = COALESCE((
    SELECT SUM(amount) 
    FROM payment_settlements 
    WHERE transaction_id = transactions.id
), 0);

-- The BEFORE UPDATE trigger will automatically calculate balance_amount and payment_status

-- ============================================================================
-- STEP 5: ADD DATA INTEGRITY CONSTRAINTS
-- ============================================================================

-- Ensure balance_amount is never negative
ALTER TABLE transactions 
DROP CONSTRAINT IF EXISTS chk_balance_non_negative;

ALTER TABLE transactions 
ADD CONSTRAINT chk_balance_non_negative 
CHECK (balance_amount >= 0);

-- Ensure paid_amount doesn't exceed amount (with small tolerance for rounding)
ALTER TABLE transactions 
DROP CONSTRAINT IF EXISTS chk_paid_amount_valid;

ALTER TABLE transactions 
ADD CONSTRAINT chk_paid_amount_valid 
CHECK (paid_amount <= amount + 0.01);

-- Ensure settlement amounts are positive
ALTER TABLE payment_settlements 
DROP CONSTRAINT IF EXISTS chk_settlement_amount_positive;

ALTER TABLE payment_settlements 
ADD CONSTRAINT chk_settlement_amount_positive 
CHECK (amount > 0);

COMMIT;

-- ============================================================================
-- VERIFICATION AND MONITORING QUERIES
-- ============================================================================

-- Check that all triggers are installed
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table IN ('transactions', 'payment_settlements')
ORDER BY event_object_table, trigger_name;

-- Verify balance calculations are correct
SELECT 
    'TRIGGER-BASED IMPLEMENTATION' as approach,
    COUNT(*) as total_transactions,
    COUNT(CASE WHEN balance_amount = (amount - paid_amount) THEN 1 END) as correct_balances,
    COUNT(CASE WHEN balance_amount != (amount - paid_amount) THEN 1 END) as incorrect_balances,
    COUNT(CASE WHEN paid_amount = COALESCE((
        SELECT SUM(ps.amount) 
        FROM payment_settlements ps 
        WHERE ps.transaction_id = transactions.id
    ), 0) THEN 1 END) as correct_paid_amounts
FROM transactions;

-- Check for any data integrity issues
SELECT 
    id,
    or_number,
    amount,
    paid_amount,
    balance_amount,
    payment_status,
    CASE 
        WHEN balance_amount != (amount - paid_amount) THEN 'BALANCE_MISMATCH'
        WHEN balance_amount < 0 THEN 'NEGATIVE_BALANCE'
        WHEN paid_amount > amount THEN 'OVERPAYMENT'
        ELSE 'OK'
    END as issue_type
FROM transactions 
WHERE balance_amount != (amount - paid_amount) 
   OR balance_amount < 0 
   OR paid_amount > amount;
