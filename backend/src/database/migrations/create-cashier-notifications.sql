-- Create cashier_notifications table for persistent notification storage
-- This table is optional - notifications can work entirely through WebSocket real-time events
-- But having persistence allows for features like notification history and missed notifications

CREATE TABLE IF NOT EXISTS cashier_notifications (
  id SERIAL PRIMARY KEY,
  notification_id VARCHAR(100) UNIQUE NOT NULL, -- Unique identifier from WebSocket payload
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  customer_name VARCHAR(255) NOT NULL,
  or_number VARCHAR(50) NOT NULL,
  token_number INTEGER NOT NULL,
  payment_amount DECIMAL(10,2) DEFAULT 0,
  payment_mode VARCHAR(50),
  distribution_method VARCHAR(50),
  priority_type VARCHAR(50) NOT NULL DEFAULT 'Standard Customer', -- Senior Citizen, Pregnant, PWD, Standard Customer
  is_priority BOOLEAN DEFAULT FALSE,
  priority_flags JSONB DEFAULT '{"senior_citizen": false, "pregnant": false, "pwd": false}',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by_name VARCHAR(255) NOT NULL,
  location_id INTEGER DEFAULT 1, -- For multi-location support
  message TEXT NOT NULL,
  notification_type VARCHAR(50) DEFAULT 'customer_registration',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL, -- When notification should be automatically cleared
  acknowledged_at TIMESTAMP, -- When cashier acknowledged/viewed the notification
  acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}', -- Additional data like estimated_time, contact_number, age
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMP,
  dismissed_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cashier_notifications_customer_id ON cashier_notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_cashier_notifications_created_at ON cashier_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cashier_notifications_expires_at ON cashier_notifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_cashier_notifications_location_id ON cashier_notifications(location_id);
CREATE INDEX IF NOT EXISTS idx_cashier_notifications_priority ON cashier_notifications(is_priority, priority_type);
CREATE INDEX IF NOT EXISTS idx_cashier_notifications_unread ON cashier_notifications(is_read, is_dismissed) WHERE is_read = FALSE AND is_dismissed = FALSE;

-- Add comments for documentation
COMMENT ON TABLE cashier_notifications IS 'Stores customer registration notifications for cashiers with priority-based filtering';
COMMENT ON COLUMN cashier_notifications.priority_type IS 'Customer priority type: Senior Citizen, Pregnant, PWD, or Standard Customer';
COMMENT ON COLUMN cashier_notifications.priority_flags IS 'JSON object containing boolean flags for senior_citizen, pregnant, and pwd';
COMMENT ON COLUMN cashier_notifications.expires_at IS 'Notification expiration time (8 hours from creation for business day scope)';
COMMENT ON COLUMN cashier_notifications.metadata IS 'Additional customer data for notification context';
