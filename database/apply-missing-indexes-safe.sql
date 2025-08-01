-- ==========================================
-- Apply Missing Customer Performance Indexes (Safe Version)
-- ==========================================
-- This script adds the missing indexes that weren't applied yet.
-- Uses CONCURRENTLY (no transaction block needed) and IF NOT EXISTS.

-- Show current state before applying
SELECT 'BEFORE: Current customer indexes' as status;
\echo 'Current indexes on customers table:'
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'customers' ORDER BY indexname;

\echo '';
\echo 'Applying missing indexes...';

-- 1. Composite index for status + date filtering (very common query pattern)
-- Speeds up queries like: "Show me all waiting customers sorted by registration time"
\echo 'Creating composite index (status + created_at)...';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_status_created 
ON customers(queue_status, created_at);

-- 2. GIN index for full-text search on customer names
-- Speeds up search functionality in your frontend
\echo 'Creating full-text search index on names...';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_name_gin 
ON customers USING GIN (to_tsvector('simple', name));

-- 3. Index for contact_number (if you search by phone)
\echo 'Creating index on contact_number...';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_contact 
ON customers(contact_number);

-- 4. Index for email (if you search by email)  
\echo 'Creating index on email...';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_email 
ON customers(email);

\echo '';
\echo 'Index creation complete. Showing results...';

-- Show results after applying
SELECT 'AFTER: Updated customer indexes' as status;
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'customers' ORDER BY indexname;

-- Show table statistics
\echo '';
\echo 'Customer table statistics:';
SELECT 
    tablename,
    n_tup_ins as "rows_inserted",
    n_tup_upd as "rows_updated", 
    n_tup_del as "rows_deleted",
    n_live_tup as "current_rows"
FROM pg_stat_user_tables 
WHERE tablename = 'customers';

\echo '';
\echo 'SUCCESS: Missing customer indexes applied successfully!';
\echo 'Your Customer Management system should now have enhanced performance for:';
\echo '- Combined status and date filtering';
\echo '- Full-text search on customer names';  
\echo '- Contact number lookups';
\echo '- Email address lookups';
