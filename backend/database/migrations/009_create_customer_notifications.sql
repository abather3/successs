-- Customer Registration Notifications System (Isolated from Queue Management)
-- This system operates completely separate from existing queue/SMS notifications

CREATE TABLE IF NOT EXISTS customer_notifications (
    id SERIAL PRIMARY KEY,
    notification_id VARCHAR(50) UNIQUE NOT NULL, -- UUID for frontend tracking
    type VARCHAR(50) NOT NULL DEFAULT 'customer_registration',
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    
    -- Customer data snapshot
    customer_data JSONB NOT NULL, -- Store customer info at notification time
    
    -- Creator information
    created_by_id INTEGER NOT NULL REFERENCES users(id),
    created_by_name VARCHAR(100) NOT NULL,
    created_by_role VARCHAR(20) NOT NULL,
    
    -- Notification targeting
    target_role VARCHAR(20) NOT NULL DEFAULT 'cashier',
    target_user_id INTEGER REFERENCES users(id), -- NULL for role-based notifications
    
    -- Notification state
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    read_by_user_id INTEGER REFERENCES users(id),
    
    -- Lifecycle
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Separate table for notification actions (Facebook-style buttons)
CREATE TABLE IF NOT EXISTS customer_notification_actions (
    id SERIAL PRIMARY KEY,
    notification_id VARCHAR(50) NOT NULL REFERENCES customer_notifications(notification_id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- 'view_customer', 'start_transaction', 'call_customer'
    label VARCHAR(100) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_notifications_target_role ON customer_notifications(target_role, is_read, expires_at);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_created_at ON customer_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_expires_at ON customer_notifications(expires_at);

-- Auto-cleanup trigger (remove expired notifications)
CREATE OR REPLACE FUNCTION cleanup_expired_customer_notifications()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM customer_notifications 
    WHERE expires_at < NOW() - INTERVAL '1 day';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_cleanup_expired_notifications
    AFTER INSERT ON customer_notifications
    FOR EACH STATEMENT
    EXECUTE FUNCTION cleanup_expired_customer_notifications();

-- Default notification actions will be created dynamically when notifications are created
-- No need for template inserts that would violate foreign key constraints
