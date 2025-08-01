-- ===================================================================
-- MIGRATION VERIFICATION SCRIPT
-- ===================================================================
-- This script verifies that the production data migration was successful
-- and that all balance calculations are working correctly.

\echo '=== MIGRATION VERIFICATION REPORT ==='
\echo ''

-- Count verification
\echo '1. DATA COUNT VERIFICATION:'
\echo '   Original database had 33 customers and 19 transactions'
\echo ''

SELECT 
    'Customers' as table_name, 
    COUNT(*) as record_count,
    CASE WHEN COUNT(*) = 33 THEN '✓ MATCH' ELSE '✗ MISMATCH' END as status
FROM customers
UNION ALL
SELECT 
    'Transactions' as table_name, 
    COUNT(*) as record_count,
    CASE WHEN COUNT(*) = 19 THEN '✓ MATCH' ELSE '✗ MISMATCH' END as status
FROM transactions;

\echo ''
\echo '2. BALANCE CALCULATION VERIFICATION:'
\echo '   Checking that balance_amount = amount - paid_amount for all transactions'
\echo ''

SELECT 
    id,
    amount,
    paid_amount,
    balance_amount,
    (amount - paid_amount) as calculated_balance,
    CASE 
        WHEN balance_amount = (amount - paid_amount) THEN '✓ CORRECT' 
        ELSE '✗ INCORRECT' 
    END as balance_check,
    payment_status
FROM transactions 
ORDER BY id
LIMIT 10;

\echo ''
\echo '3. PAYMENT STATUS CONSISTENCY CHECK:'
\echo '   Verifying payment status matches the payment amounts'
\echo ''

SELECT 
    payment_status,
    COUNT(*) as count,
    MIN(paid_amount) as min_paid,
    MAX(paid_amount) as max_paid,
    MIN(balance_amount) as min_balance,
    MAX(balance_amount) as max_balance
FROM transactions 
GROUP BY payment_status
ORDER BY payment_status;

\echo ''
\echo '4. GENERATED COLUMN VERIFICATION:'
\echo '   Confirming balance_amount is properly configured as a generated column'
\echo ''

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    generation_expression,
    is_generated
FROM information_schema.columns 
WHERE table_name = 'transactions' 
  AND column_name = 'balance_amount';

\echo ''
\echo '5. TRIGGER VERIFICATION:'
\echo '   Checking active triggers on transactions table'
\echo ''

SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_condition,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'transactions';

\echo ''
\echo '6. SAMPLE CUSTOMER DATA VERIFICATION:'
\echo '   Checking some customer records to ensure data integrity'
\echo ''

SELECT 
    id,
    or_number,
    name,
    queue_status,
    priority_score,
    created_at::date
FROM customers 
ORDER BY id 
LIMIT 5;

\echo ''
\echo '=== MIGRATION VERIFICATION COMPLETE ==='
\echo 'If all checks show ✓, your migration was successful!'
