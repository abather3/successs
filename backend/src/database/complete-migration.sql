-- Complete PostgreSQL Database Schema Migration
-- This script creates all necessary tables for the EscaShop application

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    reset_token VARCHAR(255),
    reset_token_expiry TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    or_number VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    age INTEGER NOT NULL,
    address TEXT NOT NULL,
    occupation VARCHAR(255),
    distribution_info TEXT NOT NULL,
    sales_agent_id INTEGER,
    doctor_assigned VARCHAR(255),
    prescription TEXT,
    grade_type VARCHAR(255) NOT NULL,
    lens_type VARCHAR(255) NOT NULL,
    frame_code VARCHAR(255),
    payment_info TEXT NOT NULL,
    remarks TEXT,
    priority_flags TEXT NOT NULL,
    queue_status VARCHAR(50) NOT NULL,
    token_number INTEGER NOT NULL,
    priority_score INTEGER,
    estimated_time VARCHAR(50),
    manual_position INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    or_number VARCHAR(255) NOT NULL UNIQUE,
    amount DECIMAL(10,2) NOT NULL,
    payment_mode VARCHAR(50) NOT NULL,
    sales_agent_id INTEGER NOT NULL,
    cashier_id INTEGER,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_amount DECIMAL(10,2) DEFAULT 0,
    balance_amount DECIMAL(10,2) DEFAULT 0,
    payment_status VARCHAR(50) DEFAULT 'unpaid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create payment_settlements table
CREATE TABLE IF NOT EXISTS payment_settlements (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_mode VARCHAR(50) NOT NULL,
    cashier_id INTEGER NOT NULL,
    settlement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create queue table
CREATE TABLE IF NOT EXISTS queue (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'waiting',
    estimated_time INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create notification_logs table
CREATE TABLE IF NOT EXISTS notification_logs (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER,
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'sent',
    delivery_status VARCHAR(50),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create daily_reports table
CREATE TABLE IF NOT EXISTS daily_reports (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    total_cash DECIMAL(10,2) DEFAULT 0,
    total_gcash DECIMAL(10,2) DEFAULT 0,
    total_maya DECIMAL(10,2) DEFAULT 0,
    total_credit_card DECIMAL(10,2) DEFAULT 0,
    total_bank_transfer DECIMAL(10,2) DEFAULT 0,
    petty_cash_start DECIMAL(10,2) DEFAULT 0,
    petty_cash_end DECIMAL(10,2) DEFAULT 0,
    expenses TEXT DEFAULT '[]',
    funds TEXT DEFAULT '[]',
    cash_turnover DECIMAL(10,2) DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create grade_types table
CREATE TABLE IF NOT EXISTS grade_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create lens_types table
CREATE TABLE IF NOT EXISTS lens_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create counters table
CREATE TABLE IF NOT EXISTS counters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    current_customer_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create SMS templates table
CREATE TABLE IF NOT EXISTS sms_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    template TEXT NOT NULL,
    variables TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraints
ALTER TABLE customers DROP CONSTRAINT IF EXISTS fk_customers_sales_agent_id;
ALTER TABLE customers ADD CONSTRAINT fk_customers_sales_agent_id 
    FOREIGN KEY (sales_agent_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS fk_transactions_customer_id;
ALTER TABLE transactions ADD CONSTRAINT fk_transactions_customer_id 
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS fk_transactions_sales_agent_id;
ALTER TABLE transactions ADD CONSTRAINT fk_transactions_sales_agent_id 
    FOREIGN KEY (sales_agent_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS fk_transactions_cashier_id;
ALTER TABLE transactions ADD CONSTRAINT fk_transactions_cashier_id 
    FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE payment_settlements DROP CONSTRAINT IF EXISTS fk_payment_settlements_transaction_id;
ALTER TABLE payment_settlements ADD CONSTRAINT fk_payment_settlements_transaction_id 
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE;

ALTER TABLE payment_settlements DROP CONSTRAINT IF EXISTS fk_payment_settlements_cashier_id;
ALTER TABLE payment_settlements ADD CONSTRAINT fk_payment_settlements_cashier_id 
    FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE queue DROP CONSTRAINT IF EXISTS fk_queue_customer_id;
ALTER TABLE queue ADD CONSTRAINT fk_queue_customer_id 
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS fk_activity_logs_user_id;
ALTER TABLE activity_logs ADD CONSTRAINT fk_activity_logs_user_id 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE notification_logs DROP CONSTRAINT IF EXISTS fk_notification_logs_customer_id;
ALTER TABLE notification_logs ADD CONSTRAINT fk_notification_logs_customer_id 
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

ALTER TABLE counters DROP CONSTRAINT IF EXISTS fk_counters_current_customer;
ALTER TABLE counters ADD CONSTRAINT fk_counters_current_customer 
    FOREIGN KEY (current_customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_or_number ON customers(or_number);
CREATE INDEX IF NOT EXISTS idx_customers_sales_agent_id ON customers(sales_agent_id);
CREATE INDEX IF NOT EXISTS idx_customers_queue_status ON customers(queue_status);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);

CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_or_number ON transactions(or_number);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_mode ON transactions(payment_mode);
CREATE INDEX IF NOT EXISTS idx_transactions_sales_agent_id ON transactions(sales_agent_id);
CREATE INDEX IF NOT EXISTS idx_transactions_cashier_id ON transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_payment_settlements_transaction_id ON payment_settlements(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_settlements_cashier_id ON payment_settlements(cashier_id);
CREATE INDEX IF NOT EXISTS idx_payment_settlements_created_at ON payment_settlements(created_at);

CREATE INDEX IF NOT EXISTS idx_queue_customer_id ON queue(customer_id);
CREATE INDEX IF NOT EXISTS idx_queue_position ON queue(position);
CREATE INDEX IF NOT EXISTS idx_queue_status ON queue(status);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);

-- Create triggers for updating updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers and create new ones
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

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user if not exists
INSERT INTO users (email, full_name, password_hash, role, status)
SELECT 'admin@escashop.com', 'System Administrator', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewmCvjk9VtTHNzLO', 'admin', 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@escashop.com');

-- Insert default grade types
INSERT INTO grade_types (name, description)
SELECT 'No Grade', 'No prescription grade required'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'No Grade');
INSERT INTO grade_types (name, description)
SELECT 'Single Grade (SV)', 'Single vision correction'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Single Grade (SV)');
INSERT INTO grade_types (name, description)
SELECT 'Single Vision-Reading (SV-READING)', 'Single vision for reading'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Single Vision-Reading (SV-READING)');
INSERT INTO grade_types (name, description)
SELECT 'Progressive (PROG)', 'Progressive lenses with gradual power change'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Progressive (PROG)');
INSERT INTO grade_types (name, description)
SELECT 'Flat-Top (F.T)', 'Flat-top bifocal lenses'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Flat-Top (F.T)');

-- Insert default lens types
INSERT INTO lens_types (name, description)
SELECT 'non-coated (ORD)', 'Non-coated ordinary lenses'
WHERE NOT EXISTS (SELECT 1 FROM lens_types WHERE name = 'non-coated (ORD)');
INSERT INTO lens_types (name, description)
SELECT 'anti-radiation (MC)', 'Anti-radiation multi-coated lenses'
WHERE NOT EXISTS (SELECT 1 FROM lens_types WHERE name = 'anti-radiation (MC)');
INSERT INTO lens_types (name, description)
SELECT 'photochromic anti-radiation (TRG)', 'Photochromic anti-radiation lenses'
WHERE NOT EXISTS (SELECT 1 FROM lens_types WHERE name = 'photochromic anti-radiation (TRG)');
INSERT INTO lens_types (name, description)
SELECT 'anti-blue light (BB)', 'Anti-blue light lenses'
WHERE NOT EXISTS (SELECT 1 FROM lens_types WHERE name = 'anti-blue light (BB)');
INSERT INTO lens_types (name, description)
SELECT 'photochromic anti-blue light (BTS)', 'Photochromic anti-blue light lenses'
WHERE NOT EXISTS (SELECT 1 FROM lens_types WHERE name = 'photochromic anti-blue light (BTS)');

-- Insert default counters
INSERT INTO counters (name, display_order, is_active)
SELECT 'Counter 1', 1, true
WHERE NOT EXISTS (SELECT 1 FROM counters WHERE name = 'Counter 1');
INSERT INTO counters (name, display_order, is_active)
SELECT 'Counter 2', 2, true
WHERE NOT EXISTS (SELECT 1 FROM counters WHERE name = 'Counter 2');

-- Insert default SMS templates (temporarily disabled)
-- INSERT INTO sms_templates (name, template, variables, is_active)
-- SELECT 'queue_position', 'Hello {{customer_name}}, you are number {{position}} in queue. Estimated wait time: {{estimated_time}} minutes.', '["customer_name", "position", "estimated_time"]', true
-- WHERE NOT EXISTS (SELECT 1 FROM sms_templates WHERE name = 'queue_position');
-- INSERT INTO sms_templates (name, template, variables, is_active)
-- SELECT 'ready_to_serve', 'Hello {{customer_name}}, please proceed to {{counter_name}} for your service.', '["customer_name", "counter_name"]', true
-- WHERE NOT EXISTS (SELECT 1 FROM sms_templates WHERE name = 'ready_to_serve');
-- INSERT INTO sms_templates (name, template, variables, is_active)
-- SELECT 'appointment_reminder', 'Hello {{customer_name}}, this is a reminder for your appointment tomorrow at {{time}}.', '["customer_name", "time"]', true
-- WHERE NOT EXISTS (SELECT 1 FROM sms_templates WHERE name = 'appointment_reminder');

-- Update balance_amount and payment_status based on paid_amount (temporarily disabled)
-- UPDATE transactions 
-- SET balance_amount = amount - paid_amount,
--     payment_status = CASE 
--         WHEN paid_amount = 0 THEN 'unpaid'
--         WHEN paid_amount >= amount THEN 'paid'
--         ELSE 'partial'
--     END
-- WHERE balance_amount IS NULL OR payment_status IS NULL;

-- Create queue_analytics table for storing queue metrics
CREATE TABLE IF NOT EXISTS queue_analytics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
    total_customers INTEGER DEFAULT 0,
    priority_customers INTEGER DEFAULT 0,
    avg_wait_time_minutes DECIMAL(10,2) DEFAULT 0,
    avg_service_time_minutes DECIMAL(10,2) DEFAULT 0,
    peak_queue_length INTEGER DEFAULT 0,
    customers_served INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, hour)
);

-- Create daily_queue_summary table for daily aggregated metrics
CREATE TABLE IF NOT EXISTS daily_queue_summary (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    total_customers INTEGER DEFAULT 0,
    priority_customers INTEGER DEFAULT 0,
    avg_wait_time_minutes DECIMAL(10,2) DEFAULT 0,
    avg_service_time_minutes DECIMAL(10,2) DEFAULT 0,
    peak_hour INTEGER,
    peak_queue_length INTEGER DEFAULT 0,
    customers_served INTEGER DEFAULT 0,
    busiest_counter_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create queue_events table for tracking detailed queue events
CREATE TABLE IF NOT EXISTS queue_events (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER,
    event_type VARCHAR(50) NOT NULL, -- 'joined', 'called', 'served', 'left'
    counter_id INTEGER,
    queue_position INTEGER,
    wait_time_minutes DECIMAL(10,2),
    service_time_minutes DECIMAL(10,2),
    is_priority BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sms_notifications table for enhanced SMS tracking
CREATE TABLE IF NOT EXISTS sms_notifications (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER,
    phone_number VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL, -- 'queue_position', 'ready_to_serve', 'delay_notification'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
    delivery_status TEXT,
    queue_position INTEGER,
    estimated_wait_minutes INTEGER,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for analytics tables
CREATE INDEX IF NOT EXISTS idx_queue_analytics_date_hour ON queue_analytics(date, hour);
CREATE INDEX IF NOT EXISTS idx_daily_queue_summary_date ON daily_queue_summary(date);
CREATE INDEX IF NOT EXISTS idx_queue_events_customer_id ON queue_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_queue_events_created_at ON queue_events(created_at);
CREATE INDEX IF NOT EXISTS idx_sms_notifications_customer_id ON sms_notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_sms_notifications_status ON sms_notifications(status);
CREATE INDEX IF NOT EXISTS idx_sms_notifications_created_at ON sms_notifications(created_at);
