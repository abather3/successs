-- EscaShop Database Schema

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'sales', 'cashier')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers table
CREATE TABLE customers (
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
    queue_status VARCHAR(50) NOT NULL DEFAULT 'waiting' CHECK (queue_status IN ('waiting', 'serving', 'completed', 'cancelled') OR queue_status = 'unknown'),
    token_number INTEGER NOT NULL,
    priority_score INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Grade types table
CREATE TABLE grade_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lens types table
CREATE TABLE lens_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Counters table
CREATE TABLE counters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    current_customer_id INTEGER REFERENCES customers(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions table
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    or_number VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_mode VARCHAR(50) NOT NULL CHECK (payment_mode IN ('gcash', 'maya', 'bank_transfer', 'credit_card', 'cash')),
    sales_agent_id INTEGER REFERENCES users(id),
    cashier_id INTEGER REFERENCES users(id),
    transaction_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity logs table
CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily reports table
CREATE TABLE daily_reports (
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
    cash_turnover DECIMAL(10, 2) DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SMS templates table
CREATE TABLE sms_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    template TEXT NOT NULL,
    variables JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification logs table
CREATE TABLE notification_logs (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    message TEXT NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('sent', 'delivered', 'failed')),
    delivery_status TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dropdown options table
CREATE TABLE dropdown_options (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL CHECK (category IN ('grade_type', 'lens_type')),
    value VARCHAR(255) NOT NULL,
    display_text VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_customers_queue_status ON customers(queue_status);
CREATE INDEX idx_customers_sales_agent ON customers(sales_agent_id);
CREATE INDEX idx_customers_created_at ON customers(created_at);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_customer ON transactions(customer_id);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

-- Insert default admin user (password: admin123)
INSERT INTO users (email, full_name, password_hash, role) VALUES 
('admin@escashop.com', 'System Administrator', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewgCT7jXX5rYm8Ri', 'admin');

-- Insert sample counters
INSERT INTO counters (name, display_order) VALUES 
('JA', 1),
('Jil', 2),
('Counter 3', 3);

-- Insert default grade types
INSERT INTO grade_types (name, description) VALUES 
('Reading', 'Reading glasses for close-up vision'),
('Distance', 'Distance glasses for far vision'),
('Progressive', 'Progressive lenses with multiple focal points'),
('Bifocal', 'Bifocal lenses with two focal points');

-- Insert default lens types
INSERT INTO lens_types (name, description) VALUES 
('Single Vision', 'Standard single vision lenses'),
('Progressive', 'Progressive lenses with smooth transition'),
('Bifocal', 'Traditional bifocal lenses'),
('Photochromic', 'Light-adaptive transition lenses'),
('Anti-Blue Light', 'Blue light blocking lenses');

-- Insert default dropdown options (kept for backward compatibility)
INSERT INTO dropdown_options (category, value, display_text, sort_order) VALUES 
('grade_type', 'reading', 'Reading', 1),
('grade_type', 'distance', 'Distance', 2),
('grade_type', 'progressive', 'Progressive', 3),
('grade_type', 'bifocal', 'Bifocal', 4),
('lens_type', 'single_vision', 'Single Vision', 1),
('lens_type', 'progressive', 'Progressive', 2),
('lens_type', 'bifocal', 'Bifocal', 3),
('lens_type', 'photochromic', 'Photochromic', 4),
('lens_type', 'anti_blue', 'Anti-Blue Light', 5);

-- Insert default SMS templates
INSERT INTO sms_templates (name, template, variables) VALUES 
('customer_ready', 'Hi {{customer_name}}, your eyeglasses are ready for pickup at {{shop_name}}. Thank you!', '["customer_name", "shop_name"]'),
('delay_notification', 'Hi {{customer_name}}, there will be a slight delay in your order. New estimated time: {{estimated_time}} minutes. We apologize for the inconvenience. - {{shop_name}}', '["customer_name", "estimated_time", "shop_name"]'),
('pickup_reminder', 'Hi {{customer_name}}, friendly reminder that your eyeglasses are ready for pickup at {{shop_name}}. Please visit us during business hours.', '["customer_name", "shop_name"]'),
('appointment_confirmation', 'Hi {{customer_name}}, your appointment at {{shop_name}} is confirmed for {{appointment_date}} at {{appointment_time}}.', '["customer_name", "shop_name", "appointment_date", "appointment_time"]');
