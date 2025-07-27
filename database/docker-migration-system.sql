-- Docker-Optimized Migration System for EscaShop
-- This script creates a robust migration system that works reliably in Docker environments

-- ==========================================
-- 1. MIGRATION TRACKING SYSTEM
-- ==========================================

-- Create migration tracking table with enhanced metadata
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(500) NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER,
    checksum VARCHAR(64), -- For detecting migration file changes
    rollback_sql TEXT,     -- Store rollback commands
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'failed', 'rolled_back'))
);

-- Create migration lock table to prevent concurrent migrations
CREATE TABLE IF NOT EXISTS migration_locks (
    id INTEGER PRIMARY KEY DEFAULT 1,
    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    locked_by VARCHAR(255), -- Container/process identifier
    migration_version VARCHAR(255),
    CONSTRAINT single_lock CHECK (id = 1)
);

-- ==========================================
-- 2. SAFE BASE SCHEMA CREATION
-- ==========================================

-- Create all tables with IF NOT EXISTS to handle any order
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'admin', 'sales', 'cashier')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System user for automated operations (must exist first)
INSERT INTO users (id, email, full_name, password_hash, role, status) 
VALUES (-1, 'system@escashop.com', 'System User', '$2b$12$dummy.hash.for.system.user', 'admin', 'active')
ON CONFLICT (id) DO NOTHING;

-- Reset sequence to avoid conflicts
SELECT setval('users_id_seq', GREATEST(1, (SELECT COALESCE(MAX(id), 0) FROM users WHERE id > 0)), false);

-- Create customers table with all current columns
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    or_number VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    contact_number VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    age INTEGER NOT NULL,
    address TEXT NOT NULL,
    occupation VARCHAR(255),
    distribution_info VARCHAR(50) NOT NULL CHECK (distribution_info IN ('lalamove', 'lbc', 'pickup')),
    sales_agent_id INTEGER REFERENCES users(id),
    doctor_assigned VARCHAR(255),
    prescription JSONB,
    grade_type VARCHAR(100) NOT NULL,
    lens_type VARCHAR(100) NOT NULL,
    frame_code VARCHAR(100),
    estimated_time INTEGER NOT NULL,
    payment_info JSONB NOT NULL,
    remarks TEXT,
    priority_flags JSONB NOT NULL,
    queue_status VARCHAR(50) NOT NULL DEFAULT 'waiting' CHECK (queue_status IN ('waiting', 'serving', 'completed', 'cancelled', 'unknown')),
    token_number INTEGER NOT NULL,
    priority_score INTEGER DEFAULT 0,
    served_at TIMESTAMPTZ,
    carried_forward BOOLEAN DEFAULT false,
    reset_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create all other tables in dependency order
CREATE TABLE IF NOT EXISTS grade_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lens_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS counters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    current_customer_id INTEGER REFERENCES customers(id),
    status VARCHAR(50) DEFAULT 'available',
    last_reset_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    or_number VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_mode VARCHAR(50) NOT NULL CHECK (payment_mode IN ('gcash', 'maya', 'bank_transfer', 'credit_card', 'cash')),
    sales_agent_id INTEGER REFERENCES users(id),
    cashier_id INTEGER REFERENCES users(id),
    transaction_date TIMESTAMP NOT NULL,
    paid_amount DECIMAL(10,2) DEFAULT 0,
    balance_amount DECIMAL(10,2) GENERATED ALWAYS AS (amount - paid_amount) STORED,
    payment_status VARCHAR(20) CHECK (payment_status IN ('unpaid', 'partial', 'paid')) DEFAULT 'unpaid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_settlements (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_mode VARCHAR(50) NOT NULL CHECK (payment_mode IN ('gcash', 'maya', 'bank_transfer', 'credit_card', 'cash')),
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cashier_id INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_reports (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    total_cash DECIMAL(10, 2) DEFAULT 0,
    total_gcash DECIMAL(10, 2) DEFAULT 0,
    total_maya DECIMAL(10, 2) DEFAULT 0,
    total_credit_card DECIMAL(10, 2) DEFAULT 0,
    total_bank_transfer DECIMAL(10, 2) DEFAULT 0,
    petty_cash_start DECIMAL(10, 2) DEFAULT 0,
    petty_cash_end DECIMAL(10, 2) DEFAULT 0,
    expenses JSONB,
    funds JSONB DEFAULT '[]'::jsonb,
    cash_turnover DECIMAL(10, 2) DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sms_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    template TEXT NOT NULL,
    variables JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_logs (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    message TEXT NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('sent', 'delivered', 'failed')),
    delivery_status TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dropdown_options (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL CHECK (category IN ('grade_type', 'lens_type')),
    value VARCHAR(255) NOT NULL,
    display_text VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    data_type VARCHAR(20) NOT NULL CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- History and logging tables
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

CREATE TABLE IF NOT EXISTS customer_notifications (
    id SERIAL PRIMARY KEY,
    notification_id VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'customer_registration',
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    customer_data JSONB NOT NULL,
    created_by_id INTEGER NOT NULL REFERENCES users(id),
    created_by_name VARCHAR(100) NOT NULL,
    created_by_role VARCHAR(20) NOT NULL,
    target_role VARCHAR(20) NOT NULL DEFAULT 'cashier',
    target_user_id INTEGER REFERENCES users(id),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    read_by_user_id INTEGER REFERENCES users(id),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_notification_actions (
    id SERIAL PRIMARY KEY,
    notification_id VARCHAR(50) NOT NULL REFERENCES customer_notifications(notification_id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    label VARCHAR(100) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 3. CREATE ALL INDEXES
-- ==========================================

-- Create all indexes with IF NOT EXISTS
CREATE INDEX IF NOT EXISTS idx_customers_queue_status ON customers(queue_status);
CREATE INDEX IF NOT EXISTS idx_customers_sales_agent ON customers(sales_agent_id);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);
CREATE INDEX IF NOT EXISTS idx_customers_served_at ON customers(served_at);
CREATE INDEX IF NOT EXISTS idx_customers_carried_forward ON customers(carried_forward);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_settlements_transaction_id ON payment_settlements(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_settlements_paid_at ON payment_settlements(paid_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
CREATE INDEX IF NOT EXISTS idx_system_settings_is_public ON system_settings(is_public);
CREATE INDEX IF NOT EXISTS idx_daily_reset_log_date ON daily_reset_log(reset_date);
CREATE INDEX IF NOT EXISTS idx_daily_queue_history_date ON daily_queue_history(date);
CREATE INDEX IF NOT EXISTS idx_customer_history_archive_date ON customer_history(archive_date);
CREATE INDEX IF NOT EXISTS idx_customer_history_customer_id ON customer_history(original_customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_target_role ON customer_notifications(target_role, is_read, expires_at);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_created_at ON customer_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_expires_at ON customer_notifications(expires_at);

-- ==========================================
-- 4. INSERT DEFAULT DATA
-- ==========================================

-- Insert default admin user (only if not exists)
INSERT INTO users (email, full_name, password_hash, role) VALUES 
('admin@escashop.com', 'System Administrator', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewgCT7jXX5rYm8Ri', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Insert sample counters
INSERT INTO counters (name, display_order) VALUES 
('JA', 1),
('Jil', 2),
('Counter 3', 3)
ON CONFLICT (name) DO NOTHING;

-- Insert default grade types
INSERT INTO grade_types (name, description) VALUES 
('Reading', 'Reading glasses for close-up vision'),
('Distance', 'Distance glasses for far vision'),
('Progressive', 'Progressive lenses with multiple focal points'),
('Bifocal', 'Bifocal lenses with two focal points')
ON CONFLICT (name) DO NOTHING;

-- Insert default lens types
INSERT INTO lens_types (name, description) VALUES 
('Single Vision', 'Standard single vision lenses'),
('Progressive', 'Progressive lenses with smooth transition'),
('Bifocal', 'Traditional bifocal lenses'),
('Photochromic', 'Light-adaptive transition lenses'),
('Anti-Blue Light', 'Blue light blocking lenses')
ON CONFLICT (name) DO NOTHING;

-- Insert default dropdown options
INSERT INTO dropdown_options (category, value, display_text, sort_order) VALUES 
('grade_type', 'reading', 'Reading', 1),
('grade_type', 'distance', 'Distance', 2),
('grade_type', 'progressive', 'Progressive', 3),
('grade_type', 'bifocal', 'Bifocal', 4),
('lens_type', 'single_vision', 'Single Vision', 1),
('lens_type', 'progressive', 'Progressive', 2),
('lens_type', 'bifocal', 'Bifocal', 3),
('lens_type', 'photochromic', 'Photochromic', 4),
('lens_type', 'anti_blue', 'Anti-Blue Light', 5)
ON CONFLICT (category, value) DO NOTHING;

-- Insert default SMS templates
INSERT INTO sms_templates (name, template, variables) VALUES 
('customer_ready', 'Hi {{customer_name}}, your eyeglasses are ready for pickup at {{shop_name}}. Thank you!', '["customer_name", "shop_name"]'),
('delay_notification', 'Hi {{customer_name}}, there will be a slight delay in your order. New estimated time: {{estimated_time}} minutes. We apologize for the inconvenience. - {{shop_name}}', '["customer_name", "estimated_time", "shop_name"]'),
('pickup_reminder', 'Hi {{customer_name}}, friendly reminder that your eyeglasses are ready for pickup at {{shop_name}}. Please visit us during business hours.', '["customer_name", "shop_name"]'),
('appointment_confirmation', 'Hi {{customer_name}}, your appointment at {{shop_name}} is confirmed for {{appointment_date}} at {{appointment_time}}.', '["customer_name", "shop_name", "appointment_date", "appointment_time"]')
ON CONFLICT (name) DO NOTHING;

-- Insert essential system settings
INSERT INTO system_settings (key, value, description, category, data_type, is_public) VALUES 
('daily_token_counter', '1', 'Daily token counter for queue management', 'queue', 'number', false),
('shop_name', 'EscaShop Optical', 'Shop name for SMS templates', 'general', 'string', true),
('sms_enabled', 'true', 'Enable/disable SMS notifications', 'notifications', 'boolean', false),
('queue_reset_time', '00:00', 'Daily queue reset time', 'queue', 'string', false)
ON CONFLICT (key) DO NOTHING;

-- Mark this comprehensive migration as applied
INSERT INTO schema_migrations (version, name, execution_time_ms) 
VALUES ('000_docker_base_schema', 'Docker-optimized base schema creation', 0)
ON CONFLICT (version) DO NOTHING;

-- ==========================================
-- 5. FUNCTIONS AND TRIGGERS
-- ==========================================

-- Function to update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to relevant tables
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-cleanup function for expired notifications
CREATE OR REPLACE FUNCTION cleanup_expired_customer_notifications()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM customer_notifications 
    WHERE expires_at < NOW() - INTERVAL '1 day';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cleanup_expired_notifications ON customer_notifications;
CREATE TRIGGER trigger_cleanup_expired_notifications
    AFTER INSERT ON customer_notifications
    FOR EACH STATEMENT
    EXECUTE FUNCTION cleanup_expired_customer_notifications();

COMMIT;
