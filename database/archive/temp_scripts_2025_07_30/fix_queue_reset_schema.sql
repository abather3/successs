-- Fix schema issues for daily queue reset functionality

-- First, add missing columns to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS served_at TIMESTAMP;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS carried_forward BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS reset_at TIMESTAMP;

-- Add missing columns to counters table  
ALTER TABLE counters ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'available';
ALTER TABLE counters ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMP;

-- Create system user for automated operations (user_id = -1)
INSERT INTO users (id, email, full_name, password_hash, role, status) 
VALUES (-1, 'system@escashop.com', 'System User', '$2b$12$dummy.hash.for.system.user', 'admin', 'active')
ON CONFLICT (id) DO NOTHING;

-- Reset the sequence to avoid conflicts with the system user ID
SELECT setval('users_id_seq', GREATEST(1, (SELECT MAX(id) FROM users WHERE id > 0)), false);

-- Create daily_reset_log table
CREATE TABLE IF NOT EXISTS daily_reset_log (
    id SERIAL PRIMARY KEY,
    reset_date DATE NOT NULL,
    customers_processed INTEGER DEFAULT 0,
    customers_carried_forward INTEGER DEFAULT 0,
    reset_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    duration_ms INTEGER
);

-- Create daily_queue_history table
CREATE TABLE IF NOT EXISTS daily_queue_history (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    total_customers INTEGER DEFAULT 0,
    waiting_customers INTEGER DEFAULT 0,
    serving_customers INTEGER DEFAULT 0,
    processing_customers INTEGER DEFAULT 0,
    completed_customers INTEGER DEFAULT 0,
    cancelled_customers INTEGER DEFAULT 0,
    priority_customers INTEGER DEFAULT 0,
    avg_wait_time_minutes DECIMAL(10,2) DEFAULT 0,
    peak_queue_length INTEGER DEFAULT 0,
    operating_hours INTEGER DEFAULT 0,
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create customer_history table
CREATE TABLE IF NOT EXISTS customer_history (
    id SERIAL PRIMARY KEY,
    original_customer_id INTEGER NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    queue_status VARCHAR(50),
    token_number INTEGER,
    priority_flags JSONB,
    created_at TIMESTAMP,
    served_at TIMESTAMP,
    counter_id INTEGER,
    estimated_wait_time INTEGER,
    archive_date DATE NOT NULL,
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(original_customer_id, archive_date)
);

-- Create display_monitor_history table
CREATE TABLE IF NOT EXISTS display_monitor_history (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    daily_customers_served INTEGER DEFAULT 0,
    daily_avg_wait_time INTEGER DEFAULT 0,
    daily_peak_queue_length INTEGER DEFAULT 0,
    daily_priority_customers INTEGER DEFAULT 0,
    operating_efficiency INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default daily_token_counter setting
INSERT INTO system_settings (key, value) 
VALUES ('daily_token_counter', '1')
ON CONFLICT (key) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_daily_reset_log_date ON daily_reset_log(reset_date);
CREATE INDEX IF NOT EXISTS idx_daily_queue_history_date ON daily_queue_history(date);
CREATE INDEX IF NOT EXISTS idx_customer_history_archive_date ON customer_history(archive_date);
CREATE INDEX IF NOT EXISTS idx_customer_history_customer_id ON customer_history(original_customer_id);
CREATE INDEX IF NOT EXISTS idx_display_monitor_history_date ON display_monitor_history(date);
CREATE INDEX IF NOT EXISTS idx_customers_served_at ON customers(served_at);
CREATE INDEX IF NOT EXISTS idx_customers_carried_forward ON customers(carried_forward);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- Update the activity_logs foreign key to allow NULL user_id
ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Make user_id nullable in activity_logs if it isn't already
ALTER TABLE activity_logs ALTER COLUMN user_id DROP NOT NULL;

-- Update any existing activity logs with invalid user_id to use system user
UPDATE activity_logs SET user_id = -1 WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users);

COMMIT;
