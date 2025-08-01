-- =========================================
-- Queue Management Performance Improvements
-- =========================================
-- Additional indexes and optimizations for queue system

-- 1. Composite index for queue events date+event filtering (very common in analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_queue_events_date_event 
ON queue_events(DATE(created_at), event_type);

-- 2. Index for processing duration analytics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_queue_events_processing_analytics 
ON queue_events(customer_id, processing_start_at, processing_end_at) 
WHERE processing_start_at IS NOT NULL;

-- 3. Partial index for active queue monitoring (only waiting/serving customers)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_active_queue 
ON customers(queue_status, created_at, priority_flags) 
WHERE queue_status IN ('waiting', 'serving');

-- 4. Index for counter performance analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_queue_events_counter_analytics 
ON queue_events(counter_id, created_at, event_type, service_time_minutes) 
WHERE counter_id IS NOT NULL;

-- 5. Index for priority customer analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_queue_events_priority_analytics 
ON queue_events(is_priority, created_at, wait_time_minutes) 
WHERE is_priority = true;

-- 6. Optimize daily queue history queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_queue_history_analytics 
ON daily_queue_history(date, total_customers, avg_wait_time_minutes);

-- Verify new indexes
SELECT 
    indexname, 
    indexdef,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_indexes 
WHERE tablename IN ('queue_events', 'customers', 'daily_queue_history')
AND indexname LIKE '%queue%'
ORDER BY tablename, indexname;
