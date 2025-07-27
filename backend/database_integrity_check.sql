-- Database Integrity Check Script
-- Identifies and flags rows with amount = 0 or NULL where payment_status = 'paid'
-- Created for data quality assurance and historical data repair

-- =============================================================================
-- PART 1: IDENTIFICATION QUERIES
-- =============================================================================

-- Query 1: Find transactions with amount = 0 but payment_status = 'paid'
SELECT 
    'ZERO_AMOUNT_PAID' as issue_type,
    id,
    or_number,
    amount,
    payment_status,
    customer_id,
    sales_agent_id,
    cashier_id,
    transaction_date,
    created_at,
    updated_at
FROM transactions 
WHERE amount = 0 
  AND payment_status = 'paid'
ORDER BY transaction_date DESC;

-- Query 2: Find transactions with amount IS NULL but payment_status = 'paid'  
-- Note: This should be rare given the NOT NULL constraint, but checking for completeness
SELECT 
    'NULL_AMOUNT_PAID' as issue_type,
    id,
    or_number,
    amount,
    payment_status,
    customer_id,
    sales_agent_id,
    cashier_id,
    transaction_date,
    created_at,
    updated_at
FROM transactions 
WHERE amount IS NULL 
  AND payment_status = 'paid'
ORDER BY transaction_date DESC;

-- Query 3: Combined query for all problematic records
SELECT 
    CASE 
        WHEN amount IS NULL THEN 'NULL_AMOUNT_PAID'
        WHEN amount = 0 THEN 'ZERO_AMOUNT_PAID'
        ELSE 'UNKNOWN_ISSUE'
    END as issue_type,
    id,
    or_number,
    amount,
    payment_status,
    customer_id,
    sales_agent_id,
    cashier_id,
    transaction_date,
    created_at,
    updated_at,
    -- Additional context from payment settlements if available
    (SELECT COUNT(*) FROM payment_settlements ps WHERE ps.transaction_id = transactions.id) as settlement_count,
    (SELECT COALESCE(SUM(ps.amount), 0) FROM payment_settlements ps WHERE ps.transaction_id = transactions.id) as total_settlements
FROM transactions 
WHERE (amount = 0 OR amount IS NULL) 
  AND payment_status = 'paid'
ORDER BY transaction_date DESC;

-- =============================================================================
-- PART 2: SUMMARY STATISTICS
-- =============================================================================

-- Summary count of problematic records
SELECT 
    'INTEGRITY_SUMMARY' as report_type,
    COUNT(CASE WHEN amount = 0 AND payment_status = 'paid' THEN 1 END) as zero_amount_paid_count,
    COUNT(CASE WHEN amount IS NULL AND payment_status = 'paid' THEN 1 END) as null_amount_paid_count,
    COUNT(CASE WHEN (amount = 0 OR amount IS NULL) AND payment_status = 'paid' THEN 1 END) as total_problematic_records,
    (SELECT COUNT(*) FROM transactions WHERE payment_status = 'paid') as total_paid_transactions,
    ROUND(
        (COUNT(CASE WHEN (amount = 0 OR amount IS NULL) AND payment_status = 'paid' THEN 1 END) * 100.0) / 
        NULLIF((SELECT COUNT(*) FROM transactions WHERE payment_status = 'paid'), 0), 2
    ) as problematic_percentage
FROM transactions;

-- =============================================================================
-- PART 3: DATA REPAIR SUGGESTIONS AND SCRIPTS
-- =============================================================================

-- Check if payment_settlements table has data that could help determine correct amounts
-- This query shows transactions that might have settlement data we can use
SELECT 
    t.id as transaction_id,
    t.or_number,
    t.amount as current_amount,
    t.payment_status,
    COUNT(ps.id) as settlement_count,
    COALESCE(SUM(ps.amount), 0) as total_settlement_amount,
    -- Suggest the settlement amount as the correct transaction amount
    CASE 
        WHEN COALESCE(SUM(ps.amount), 0) > 0 THEN COALESCE(SUM(ps.amount), 0)
        ELSE NULL
    END as suggested_amount
FROM transactions t
LEFT JOIN payment_settlements ps ON t.id = ps.transaction_id
WHERE (t.amount = 0 OR t.amount IS NULL) 
  AND t.payment_status = 'paid'
GROUP BY t.id, t.or_number, t.amount, t.payment_status
ORDER BY t.transaction_date DESC;

-- =============================================================================
-- PART 4: DATA REPAIR EXECUTION (COMMENTED FOR SAFETY)
-- Uncomment and modify these queries carefully after review
-- =============================================================================

/*
-- REPAIR SCRIPT 1: Update transaction amounts based on settlement data
-- WARNING: This will modify data. Review carefully before execution!
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

-- REPAIR SCRIPT 2: Reset payment status for transactions with no settlement data
-- WARNING: This will modify data. Review carefully before execution!
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

-- =============================================================================
-- PART 5: VERIFICATION QUERIES (Run after repairs)
-- =============================================================================

-- Verify no problematic records remain
SELECT 
    'POST_REPAIR_CHECK' as check_type,
    COUNT(*) as remaining_problematic_records
FROM transactions 
WHERE (amount = 0 OR amount IS NULL) 
  AND payment_status = 'paid';

-- =============================================================================
-- PART 6: BACKUP RECOMMENDATIONS
-- =============================================================================

-- Create a backup table before running repairs (uncomment if needed)
/*
CREATE TABLE transactions_backup_$(date +%Y%m%d) AS 
SELECT * FROM transactions 
WHERE (amount = 0 OR amount IS NULL) 
  AND payment_status = 'paid';
*/

-- =============================================================================
-- END OF SCRIPT
-- =============================================================================
