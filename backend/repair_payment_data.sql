-- Data Repair Script for Payment Integrity Issues
-- Use this script ONLY when problematic records are found during integrity checks
-- IMPORTANT: Always create backups before running repair operations

-- =============================================================================
-- BACKUP CREATION (UNCOMMENT BEFORE RUNNING REPAIRS)
-- =============================================================================

-- Create backup table with timestamp
-- Replace YYYYMMDD with actual date
/*
CREATE TABLE transactions_backup_integrity_fix AS 
SELECT * FROM transactions 
WHERE (amount = 0 OR amount IS NULL) 
  AND payment_status = 'paid';
*/

-- =============================================================================
-- DATA REPAIR OPERATIONS
-- =============================================================================

-- REPAIR OPTION 1: Fix amounts using payment settlement data
-- This updates transaction amounts based on the sum of actual payments received
/*
UPDATE transactions 
SET amount = subquery.total_settlement_amount,
    updated_at = CURRENT_TIMESTAMP
FROM (
    SELECT 
        t.id,
        COALESCE(SUM(ps.amount), 0) as total_settlement_amount
    FROM transactions t
    LEFT JOIN payment_settlements ps ON t.id = ps.transaction_id
    WHERE (t.amount = 0 OR t.amount IS NULL) 
      AND t.payment_status = 'paid'
      AND EXISTS (SELECT 1 FROM payment_settlements ps2 WHERE ps2.transaction_id = t.id)
    GROUP BY t.id
    HAVING COALESCE(SUM(ps.amount), 0) > 0
) as subquery
WHERE transactions.id = subquery.id;
*/

-- REPAIR OPTION 2: Reset payment status to 'unpaid' for records with no settlement data
-- This corrects the payment status when no actual payments have been recorded
/*
UPDATE transactions 
SET payment_status = 'unpaid',
    updated_at = CURRENT_TIMESTAMP
WHERE (amount = 0 OR amount IS NULL) 
  AND payment_status = 'paid'
  AND NOT EXISTS (
      SELECT 1 FROM payment_settlements ps 
      WHERE ps.transaction_id = transactions.id
  );
*/

-- REPAIR OPTION 3: Manual correction template
-- Use this template when you need to manually set specific amounts
-- Replace the values as needed for each problematic record
/*
UPDATE transactions 
SET amount = 1000.00,  -- Replace with correct amount
    updated_at = CURRENT_TIMESTAMP
WHERE id = 123;  -- Replace with specific transaction ID
*/

-- =============================================================================
-- VERIFICATION QUERIES (RUN AFTER REPAIRS)
-- =============================================================================

-- Verify repair results
/*
SELECT 'After Repair Check' as check_phase,
       COUNT(*) as remaining_issues
FROM transactions 
WHERE (amount = 0 OR amount IS NULL) 
  AND payment_status = 'paid';

-- Show repaired records
SELECT 'Repaired Records' as record_type,
       id, or_number, amount, payment_status, 
       updated_at
FROM transactions 
WHERE updated_at >= CURRENT_DATE
  AND payment_status IN ('paid', 'unpaid')
ORDER BY updated_at DESC;
*/

-- =============================================================================
-- PREVENTION MEASURES (OPTIONAL ENHANCEMENTS)
-- =============================================================================

-- Add database constraint to prevent zero amounts for paid transactions
-- WARNING: This will prevent ALL future transactions with amount = 0 and payment_status = 'paid'
/*
ALTER TABLE transactions 
ADD CONSTRAINT chk_paid_amount_not_zero 
CHECK (
    NOT (payment_status = 'paid' AND (amount IS NULL OR amount <= 0))
);
*/

-- Create trigger to validate payment status changes
/*
CREATE OR REPLACE FUNCTION validate_payment_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent marking as paid if amount is zero or null
    IF NEW.payment_status = 'paid' AND (NEW.amount IS NULL OR NEW.amount <= 0) THEN
        RAISE EXCEPTION 'Cannot mark transaction as paid when amount is zero or null';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_payment_status ON transactions;
CREATE TRIGGER trg_validate_payment_status
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION validate_payment_status();
*/

-- =============================================================================
-- USAGE INSTRUCTIONS
-- =============================================================================

/*
STEP-BY-STEP REPAIR PROCESS:

1. Run integrity check first:
   node run_integrity_check.js

2. If issues found, create backup:
   Uncomment and run backup creation section above

3. Choose appropriate repair option:
   - Option 1: When settlement data exists
   - Option 2: When no settlement data exists  
   - Option 3: For manual corrections

4. Uncomment and run chosen repair queries

5. Run verification queries to confirm fixes

6. Optionally add prevention measures

7. Update documentation with actions taken

SAFETY REMINDERS:
- Always backup data before repairs
- Test repairs on non-production first
- Review each query before execution
- Document all changes made
*/
