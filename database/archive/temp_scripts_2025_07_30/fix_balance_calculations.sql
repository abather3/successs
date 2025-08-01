-- Fix existing balance calculation issues
-- This script ensures paid_amount matches the sum of settlements

BEGIN;

-- Update all transactions to have correct paid_amount based on settlements
UPDATE transactions 
SET 
  paid_amount = COALESCE((
    SELECT SUM(amount) 
    FROM payment_settlements 
    WHERE transaction_id = transactions.id
  ), 0),
  payment_status = CASE 
    WHEN COALESCE((
      SELECT SUM(amount) 
      FROM payment_settlements 
      WHERE transaction_id = transactions.id
    ), 0) = 0 THEN 'unpaid'
    WHEN COALESCE((
      SELECT SUM(amount) 
      FROM payment_settlements 
      WHERE transaction_id = transactions.id
    ), 0) >= amount THEN 'paid'
    ELSE 'partial'
  END
WHERE 
  paid_amount != COALESCE((
    SELECT SUM(amount) 
    FROM payment_settlements 
    WHERE transaction_id = transactions.id
  ), 0);

-- Add trigger to automatically update transaction payment status when settlements change
CREATE OR REPLACE FUNCTION update_transaction_payment_status_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the transaction's paid_amount and payment_status
    UPDATE transactions 
    SET 
        paid_amount = COALESCE((
            SELECT SUM(amount) 
            FROM payment_settlements 
            WHERE transaction_id = COALESCE(NEW.transaction_id, OLD.transaction_id)
        ), 0),
        payment_status = CASE 
            WHEN COALESCE((
                SELECT SUM(amount) 
                FROM payment_settlements 
                WHERE transaction_id = COALESCE(NEW.transaction_id, OLD.transaction_id)
            ), 0) = 0 THEN 'unpaid'
            WHEN COALESCE((
                SELECT SUM(amount) 
                FROM payment_settlements 
                WHERE transaction_id = COALESCE(NEW.transaction_id, OLD.transaction_id)
            ), 0) >= amount THEN 'paid'
            ELSE 'partial'
        END
    WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create or replace the trigger
DROP TRIGGER IF EXISTS trigger_update_payment_status ON payment_settlements;
CREATE TRIGGER trigger_update_payment_status
    AFTER INSERT OR UPDATE OR DELETE ON payment_settlements
    FOR EACH ROW
    EXECUTE FUNCTION update_transaction_payment_status_trigger();

COMMIT;

-- Report results
SELECT 
  'Balance Fix Complete' as status,
  COUNT(*) as total_transactions,
  COUNT(CASE WHEN balance_amount = (amount - paid_amount) THEN 1 END) as correct_balances,
  COUNT(CASE WHEN payment_status = 
    CASE 
      WHEN paid_amount = 0 THEN 'unpaid'
      WHEN paid_amount >= amount THEN 'paid'
      ELSE 'partial'
    END THEN 1 END) as correct_statuses
FROM transactions;
