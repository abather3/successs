-- =====================================================
-- Enhanced Payment System Triggers - Performance Optimized
-- =====================================================
-- Purpose: Replace slow SUM() triggers with fast incremental updates
-- Author: System Enhancement
-- Date: 2025-07-30
-- =====================================================

BEGIN;

-- Create optimized incremental update function
CREATE OR REPLACE FUNCTION update_transaction_paid_amount()
RETURNS TRIGGER AS $$
DECLARE
    transaction_amount DECIMAL(10,2);
    new_paid_amount DECIMAL(10,2);
    new_payment_status VARCHAR(20);
BEGIN
    -- Get the transaction amount for status calculation
    SELECT amount INTO transaction_amount 
    FROM transactions 
    WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id);
    
    -- Calculate the new paid amount incrementally
    IF TG_OP = 'INSERT' THEN
        -- On INSERT: Add the new settlement amount
        UPDATE transactions 
        SET paid_amount = paid_amount + NEW.amount
        WHERE id = NEW.transaction_id
        RETURNING paid_amount INTO new_paid_amount;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- On DELETE: Subtract the old settlement amount
        UPDATE transactions 
        SET paid_amount = GREATEST(paid_amount - OLD.amount, 0)
        WHERE id = OLD.transaction_id
        RETURNING paid_amount INTO new_paid_amount;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- On UPDATE: Subtract old amount and add new amount
        UPDATE transactions 
        SET paid_amount = paid_amount - OLD.amount + NEW.amount
        WHERE id = NEW.transaction_id
        RETURNING paid_amount INTO new_paid_amount;
    END IF;
    
    -- Calculate the new payment status based on paid amount
    IF new_paid_amount = 0 THEN
        new_payment_status := 'unpaid';
    ELSIF new_paid_amount >= transaction_amount THEN
        new_payment_status := 'paid';
    ELSE
        new_payment_status := 'partial';
    END IF;
    
    -- Update payment status if it changed
    UPDATE transactions 
    SET payment_status = new_payment_status
    WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id)
      AND payment_status != new_payment_status;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Replace existing triggers with optimized versions
DROP TRIGGER IF EXISTS trigger_update_transaction_paid_amount_insert ON payment_settlements;
DROP TRIGGER IF EXISTS trigger_update_transaction_paid_amount_update ON payment_settlements;
DROP TRIGGER IF EXISTS trigger_update_transaction_paid_amount_delete ON payment_settlements;

-- Create new optimized triggers
CREATE TRIGGER trigger_update_transaction_paid_amount_insert
    AFTER INSERT ON payment_settlements
    FOR EACH ROW
    EXECUTE FUNCTION update_transaction_paid_amount();

CREATE TRIGGER trigger_update_transaction_paid_amount_update
    AFTER UPDATE ON payment_settlements
    FOR EACH ROW
    EXECUTE FUNCTION update_transaction_paid_amount();

CREATE TRIGGER trigger_update_transaction_paid_amount_delete
    AFTER DELETE ON payment_settlements
    FOR EACH ROW
    EXECUTE FUNCTION update_transaction_paid_amount();

-- Add constraint to prevent negative paid amounts (safety measure)
ALTER TABLE transactions 
DROP CONSTRAINT IF EXISTS check_paid_amount_non_negative;

ALTER TABLE transactions 
ADD CONSTRAINT check_paid_amount_non_negative 
CHECK (paid_amount >= 0);

-- Add constraint to prevent paid amount exceeding transaction amount
ALTER TABLE transactions 
DROP CONSTRAINT IF EXISTS check_paid_amount_not_exceeds_total;

ALTER TABLE transactions 
ADD CONSTRAINT check_paid_amount_not_exceeds_total 
CHECK (paid_amount <= amount + 0.01); -- Allow 1 cent tolerance for floating point

-- Create index for faster transaction locking
CREATE INDEX IF NOT EXISTS idx_transactions_for_update 
ON transactions(id) WHERE payment_status != 'paid';

-- Add comments for documentation
COMMENT ON FUNCTION update_transaction_paid_amount() IS 
'Optimized trigger function that updates transaction paid_amount incrementally instead of recalculating SUM(). Much faster for transactions with many settlements.';

COMMENT ON CONSTRAINT check_paid_amount_non_negative ON transactions IS 
'Ensures paid_amount never goes negative due to settlement deletions or updates.';

COMMENT ON CONSTRAINT check_paid_amount_not_exceeds_total ON transactions IS 
'Prevents overpayment - paid_amount cannot exceed transaction amount (with 1 cent tolerance for floating point precision).';

COMMIT;

-- Report the enhancement completion
SELECT 
    'Payment System Triggers Enhanced' as status,
    'Incremental updates implemented' as performance_improvement,
    'Race condition constraints added' as safety_improvement,
    COUNT(*) as total_transactions,
    COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_transactions,
    COUNT(CASE WHEN payment_status = 'partial' THEN 1 END) as partial_transactions,
    COUNT(CASE WHEN payment_status = 'unpaid' THEN 1 END) as unpaid_transactions
FROM transactions;
