-- Zero-Cost Database Performance Indexes
-- Run these commands to optimize query performance

-- Queue Management Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_queue_status_priority 
ON customers (queue_status, priority_flags, created_at) 
WHERE queue_status IN ('waiting', 'serving');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_queue_number_status 
ON customers (queue_number, queue_status) 
WHERE queue_status != 'completed';

-- Counter Management Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_counters_active_customer 
ON counters (current_customer_id, is_active, counter_number) 
WHERE current_customer_id IS NOT NULL;

-- Transaction Performance Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_date_status 
ON transactions (DATE(created_at), payment_status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_settlements_transaction 
ON payment_settlements (transaction_id, created_at);

-- Notification Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_status_type 
ON notifications (status, notification_type, created_at);

-- Activity Logs (for audit performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_user_date 
ON activity_logs (user_id, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_action_date 
ON activity_logs (action, created_at);

-- Analytics Performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_created_date 
ON customers (DATE(created_at), queue_status);

-- Partial indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_waiting 
ON customers (priority_flags, created_at) 
WHERE queue_status = 'waiting';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_serving 
ON customers (counter_id, created_at) 
WHERE queue_status = 'serving';

-- Cleanup old data indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_completed_old 
ON customers (created_at) 
WHERE queue_status = 'completed' AND created_at < NOW() - INTERVAL '30 days';

-- Statistics update for better query planning
ANALYZE customers;
ANALYZE counters;
ANALYZE transactions;
ANALYZE notifications;
ANALYZE activity_logs;
