-- ==========================================
-- Migration 001: Base Schema Setup
-- ==========================================
-- Purpose: Create the complete base schema for EscaShop application
-- Author: System Migration
-- Date: 2025-01-26
-- Dependencies: None (initial schema)
-- ==========================================

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
    served_at TIMESTAMPTZ,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Check and alter missing columns for schema_migrations
DO $$
BEGIN
  -- Add 'name' column if it does not exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'schema_migrations' AND column_name = 'name'
  ) THEN
    ALTER TABLE schema_migrations ADD COLUMN name VARCHAR(500);
    RAISE NOTICE 'Added `name` column to schema_migrations';
  ELSE
    RAISE NOTICE '`name` column already exists in schema_migrations';
  END IF;
  
  -- Add 'checksum' column if it does not exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'schema_migrations' AND column_name = 'checksum'
  ) THEN
    ALTER TABLE schema_migrations ADD COLUMN checksum VARCHAR(64);
    RAISE NOTICE 'Added `checksum` column to schema_migrations';
  END IF;
  
  -- Add 'status' column if it does not exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'schema_migrations' AND column_name = 'status'
  ) THEN
    ALTER TABLE schema_migrations ADD COLUMN status VARCHAR(20) DEFAULT 'completed';
    RAISE NOTICE 'Added `status` column to schema_migrations';
  END IF;
  
  -- Add 'execution_time_ms' column if it does not exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'schema_migrations' AND column_name = 'execution_time_ms'
  ) THEN
    ALTER TABLE schema_migrations ADD COLUMN execution_time_ms INTEGER;
    RAISE NOTICE 'Added `execution_time_ms` column to schema_migrations';
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- Table doesn't exist, create it with full structure
    CREATE TABLE schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(500) NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      execution_time_ms INTEGER,
      checksum VARCHAR(64),
      rollback_sql TEXT,
      status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'failed', 'rolled_back'))
    );
    RAISE NOTICE 'Created schema_migrations table with full structure';
END $$;

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

-- ==========================================
-- FOREIGN KEY CONSTRAINTS
-- ==========================================

-- Add foreign key constraints (safe with IF EXISTS checks)
DO $$
BEGIN
    -- Customers -> Users (sales_agent_id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_customers_sales_agent_id') THEN
        ALTER TABLE customers ADD CONSTRAINT fk_customers_sales_agent_id 
            FOREIGN KEY (sales_agent_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    -- Transactions -> Customers
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_transactions_customer_id') THEN
        ALTER TABLE transactions ADD CONSTRAINT fk_transactions_customer_id 
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
    END IF;

    -- Transactions -> Users (sales_agent_id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_transactions_sales_agent_id') THEN
        ALTER TABLE transactions ADD CONSTRAINT fk_transactions_sales_agent_id 
            FOREIGN KEY (sales_agent_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    -- Transactions -> Users (cashier_id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_transactions_cashier_id') THEN
        ALTER TABLE transactions ADD CONSTRAINT fk_transactions_cashier_id 
            FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    -- Payment Settlements -> Transactions
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_payment_settlements_transaction_id') THEN
        ALTER TABLE payment_settlements ADD CONSTRAINT fk_payment_settlements_transaction_id 
            FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE;
    END IF;

    -- Payment Settlements -> Users (cashier_id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_payment_settlements_cashier_id') THEN
        ALTER TABLE payment_settlements ADD CONSTRAINT fk_payment_settlements_cashier_id 
            FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    -- Queue -> Customers
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_queue_customer_id') THEN
        ALTER TABLE queue ADD CONSTRAINT fk_queue_customer_id 
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
    END IF;

    -- Activity Logs -> Users
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_activity_logs_user_id') THEN
        ALTER TABLE activity_logs ADD CONSTRAINT fk_activity_logs_user_id 
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    -- Notification Logs -> Customers
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_notification_logs_customer_id') THEN
        ALTER TABLE notification_logs ADD CONSTRAINT fk_notification_logs_customer_id 
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
    END IF;

    -- Counters -> Customers (current_customer_id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_counters_current_customer') THEN
        ALTER TABLE counters ADD CONSTRAINT fk_counters_current_customer 
            FOREIGN KEY (current_customer_id) REFERENCES customers(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ==========================================
-- PERFORMANCE INDEXES
-- ==========================================

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

-- ==========================================
-- TRIGGERS FOR UPDATED_AT
-- ==========================================

-- Create function for updating updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating updated_at timestamps
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

-- ==========================================
-- MIGRATION COMPLETION
-- ==========================================

INSERT INTO schema_migrations (version, name, checksum, status) 
VALUES ('001', '001_base_schema_setup.sql', 'a1b2c3d4e5f6', 'completed')
ON CONFLICT (version) DO UPDATE SET 
    status = 'completed',
    applied_at = CURRENT_TIMESTAMP;

-- Log completion
SELECT 'Migration 001: Base Schema Setup - COMPLETED' as migration_status;
