-- Enhanced Triggers Migration for Balance Calculation
-- Safe execution script

BEGIN;

-- Step 1: Create the comprehensive balance update function
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
    
    -- Update timestamp
    NEW.updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create settlement update function
CREATE OR REPLACE FUNCTION update_transaction_from_settlements()
RETURNS TRIGGER AS $$
DECLARE
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
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Step 3: Drop old triggers
DROP TRIGGER IF EXISTS trigger_update_payment_status ON transactions;
DROP TRIGGER IF EXISTS trigger_update_transaction_paid_amount_insert ON payment_settlements;
DROP TRIGGER IF EXISTS trigger_update_transaction_paid_amount_update ON payment_settlements;
DROP TRIGGER IF EXISTS trigger_update_transaction_paid_amount_delete ON payment_settlements;

-- Step 4: Create new comprehensive triggers
CREATE TRIGGER trigger_update_transaction_balance_and_status
    BEFORE INSERT OR UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_transaction_balance_and_status();

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

-- Step 5: Fix all existing data
UPDATE transactions 
SET paid_amount = COALESCE((
    SELECT SUM(amount) 
    FROM payment_settlements 
    WHERE transaction_id = transactions.id
), 0);

COMMIT;
