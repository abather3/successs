-- Migration: Create Daily Queue History Tables
-- Purpose: Support daily queue reset and historical analytics
-- Version: 1.0.0
-- Date: 2025-07-21

-- =============================================
-- 0. Create schema_migrations table if it doesn't exist
-- =============================================
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    description TEXT,
    applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 1. Daily Queue History Table
-- =============================================
CREATE TABLE IF NOT EXISTS daily_queue_history (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    total_customers INTEGER DEFAULT 0,
    waiting_customers INTEGER DEFAULT 0,
    serving_customers INTEGER DEFAULT 0,
    processing_customers INTEGER DEFAULT 0,
    completed_customers INTEGER DEFAULT 0,
    cancelled_customers INTEGER DEFAULT 0,
    priority_customers INTEGER DEFAULT 0,
    avg_wait_time_minutes DECIMAL(10,2) DEFAULT 0,
    peak_queue_length INTEGER DEFAULT 0,
    operating_hours DECIMAL(4,2) DEFAULT 0,
    archived_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_daily_queue_history_date ON daily_queue_history(date);
CREATE INDEX IF NOT EXISTS idx_daily_queue_history_archived_at ON daily_queue_history(archived_at);

-- =============================================
-- 2. Customer History Archive Table
-- =============================================
CREATE TABLE IF NOT EXISTS customer_history (
    id SERIAL PRIMARY KEY,
    original_customer_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    queue_status VARCHAR(20) NOT NULL,
    token_number INTEGER NOT NULL,
    priority_flags JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL,
    served_at TIMESTAMPTZ,
    counter_id INTEGER,
    estimated_wait_time INTEGER DEFAULT 0,
    archive_date DATE NOT NULL,
    archived_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one record per customer per day
    UNIQUE(original_customer_id, archive_date)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_customer_history_archive_date ON customer_history(archive_date);
CREATE INDEX IF NOT EXISTS idx_customer_history_original_id ON customer_history(original_customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_history_queue_status ON customer_history(queue_status);
CREATE INDEX IF NOT EXISTS idx_customer_history_token_number ON customer_history(token_number);

-- =============================================
-- 3. Display Monitor History Table
-- =============================================
CREATE TABLE IF NOT EXISTS display_monitor_history (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    daily_customers_served INTEGER DEFAULT 0,
    daily_avg_wait_time INTEGER DEFAULT 0, -- in minutes
    daily_peak_queue_length INTEGER DEFAULT 0,
    daily_priority_customers INTEGER DEFAULT 0,
    operating_efficiency INTEGER DEFAULT 0, -- percentage
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_display_monitor_history_date ON display_monitor_history(date);

-- =============================================
-- 4. Daily Reset Log Table
-- =============================================
CREATE TABLE IF NOT EXISTS daily_reset_log (
    id SERIAL PRIMARY KEY,
    reset_date DATE NOT NULL,
    customers_processed INTEGER DEFAULT 0,
    customers_carried_forward INTEGER DEFAULT 0,
    reset_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    reset_duration_ms INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    
    -- Ensure one log per day
    UNIQUE(reset_date)
);

-- Index for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_daily_reset_log_date ON daily_reset_log(reset_date);
CREATE INDEX IF NOT EXISTS idx_daily_reset_log_timestamp ON daily_reset_log(reset_timestamp);

-- =============================================
-- 5. Initialize System Settings
-- =============================================
-- Initialize daily token counter setting
INSERT INTO system_settings (key, value, description, category, data_type, is_public)
VALUES ('daily_token_counter', '1', 'Daily token number counter for queue numbering', 'queue', 'number', false)
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- 6. Add columns to existing customers table
-- =============================================
-- Add carried_forward flag to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS carried_forward BOOLEAN DEFAULT FALSE;

-- Add reset tracking to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS reset_at TIMESTAMPTZ;

-- Add reset tracking to counters table
ALTER TABLE counters 
ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMPTZ;

-- =============================================
-- 7. Comments and Documentation
-- =============================================

COMMENT ON TABLE daily_queue_history IS 'Historical daily queue snapshots for analytics and reporting';
COMMENT ON TABLE customer_history IS 'Archived customer records from daily queue operations';
COMMENT ON TABLE display_monitor_history IS 'Daily display monitor metrics for analytics dashboard integration';
COMMENT ON TABLE daily_reset_log IS 'Audit log of daily queue reset operations';

COMMENT ON COLUMN daily_queue_history.operating_hours IS 'Number of hours the queue was operational';
COMMENT ON COLUMN customer_history.served_at IS 'Timestamp when customer was served';
COMMENT ON COLUMN display_monitor_history.operating_efficiency IS 'Daily operating efficiency as percentage';

-- =============================================
-- Migration Complete
-- =============================================

-- Insert migration record
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('20250721_001', 'Create daily queue history tables for reset and analytics', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;
