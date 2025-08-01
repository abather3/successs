-- ==========================================
-- Apply Missing Customer Performance Indexes
-- ==========================================
-- This script adds the missing indexes that weren't applied yet.
-- Safe to run - uses CONCURRENTLY and IF NOT EXISTS.

-- Start transaction for safety
BEGIN;

-- Show current state before applying
SELECT 'BEFORE: Current customer indexes' as status;
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'customers' ORDER BY indexname;

-- 1. Composite index for status + date filtering (very common query pattern)
-- Speeds up queries like: "Show me all waiting customers sorted by registration time"
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_status_created 
ON customers(queue_status, created_at);

-- 2. GIN index for full-text search on customer names
-- Speeds up search functionality in your frontend
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_name_gin 
ON customers USING GIN (to_tsvector('simple', name));

-- 3. Index for contact_number (if you search by phone)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_contact 
ON customers(contact_number);

-- 4. Index for email (if you search by email)  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_email 
ON customers(email);

-- Show results after applying
SELECT 'AFTER: Updated customer indexes' as status;
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'customers' ORDER BY indexname;

-- Show table statistics
SELECT 
    tablename,
    n_tup_ins as "rows_inserted",
    n_tup_upd as "rows_updated", 
    n_tup_del as "rows_deleted",
    n_live_tup as "current_rows"
FROM pg_stat_user_tables 
WHERE tablename = 'customers';

SELECT 'SUCCESS: Missing customer indexes applied!' as result;

COMMIT;
