-- =========================================
-- Transaction Management Performance Improvements
-- =========================================
-- Additional indexes and optimizations for transaction system

-- 1. Composite index for transaction listing with date range filtering (very common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_date_customer 
ON transactions(transaction_date, customer_id);

-- 2. Index for payment status and date filtering (common in reports)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_payment_status_date 
ON transactions(payment_status, transaction_date);

-- 3. Index for sales agent performance queries  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_sales_agent_date_amount 
ON transactions(sales_agent_id, transaction_date, amount);

-- 4. Index for cashier performance queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_cashier_date_amount 
ON transactions(cashier_id, transaction_date, amount) 
WHERE cashier_id IS NOT NULL;

-- 5. Optimize payment settlements for transaction balance calculations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_settlements_transaction_amount 
ON payment_settlements(transaction_id, amount);

-- 6. Index for payment tracking audit queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_tracking_transaction_status 
ON payment_tracking(transaction_id, status, processed_at);

-- 7. Partial index for unpaid transactions (frequently accessed)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_unpaid_active 
ON transactions(id, customer_id, amount, created_at) 
WHERE payment_status IN ('unpaid', 'partial');

-- 8. Index for OR number lookups with payment status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_or_payment_status 
ON transactions(or_number, payment_status);

-- 9. Index for monthly reporting queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_monthly_reports 
ON transactions(DATE_TRUNC('month', transaction_date), payment_mode, amount);

-- 10. Optimize settlement history queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_settlements_date_cashier 
ON payment_settlements(paid_at, cashier_id, transaction_id);

-- Show index effectiveness
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_indexes 
WHERE tablename IN ('transactions', 'payment_settlements', 'payment_tracking')
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
