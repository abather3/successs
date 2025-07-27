-- Performance Indexes for Customer Notifications Analytics & History
-- These indexes support the new API endpoints for stats and history

-- Index for read status and expiry queries (used in analytics)
CREATE INDEX IF NOT EXISTS idx_customer_notifications_is_read_expires 
ON customer_notifications(is_read, expires_at) 
WHERE expires_at > NOW();

-- Index for created_at DESC for history pagination
CREATE INDEX IF NOT EXISTS idx_customer_notifications_created_at_desc 
ON customer_notifications(created_at DESC);

-- Composite index for target_role filtering and ordering
CREATE INDEX IF NOT EXISTS idx_customer_notifications_target_created 
ON customer_notifications(target_role, created_at DESC);

-- Index for JSONB priority_type searches in history filtering  
CREATE INDEX IF NOT EXISTS idx_customer_notifications_priority_type 
ON customer_notifications USING GIN ((customer_data->>'priority_type'));

-- Index for JSONB customer name searches in history filtering
CREATE INDEX IF NOT EXISTS idx_customer_notifications_customer_name 
ON customer_notifications USING GIN ((customer_data->>'name'));

-- Index for JSONB OR number searches in history filtering
CREATE INDEX IF NOT EXISTS idx_customer_notifications_or_number 
ON customer_notifications USING GIN ((customer_data->>'or_number'));

-- Partial index for active notifications (main use case)
CREATE INDEX IF NOT EXISTS idx_customer_notifications_active 
ON customer_notifications(target_role, created_at DESC) 
WHERE is_read = FALSE AND expires_at > NOW();

-- Index for response time analytics (read_at - created_at calculations)
CREATE INDEX IF NOT EXISTS idx_customer_notifications_response_time 
ON customer_notifications(read_at, created_at) 
WHERE read_at IS NOT NULL;

-- Comments for documentation
COMMENT ON INDEX idx_customer_notifications_is_read_expires IS 'Supports analytics queries for active/read notification counts';
COMMENT ON INDEX idx_customer_notifications_created_at_desc IS 'Supports history pagination with created_at DESC ordering';
COMMENT ON INDEX idx_customer_notifications_target_created IS 'Supports role-based filtering with chronological ordering';
COMMENT ON INDEX idx_customer_notifications_priority_type IS 'Supports priority_type filtering in history queries';
COMMENT ON INDEX idx_customer_notifications_customer_name IS 'Supports customer name searches in history';
COMMENT ON INDEX idx_customer_notifications_or_number IS 'Supports OR number searches in history';
COMMENT ON INDEX idx_customer_notifications_active IS 'Optimizes active notifications retrieval (main dashboard use case)';
COMMENT ON INDEX idx_customer_notifications_response_time IS 'Supports average response time calculations in analytics';
