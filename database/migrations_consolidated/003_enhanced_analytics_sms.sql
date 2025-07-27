-- ==========================================
-- Migration 003: Enhanced Analytics and SMS System
-- ==========================================
-- Purpose: Add queue analytics, enhanced SMS notifications, and performance tracking
-- Author: System Migration
-- Date: 2025-01-26
-- Dependencies: 002_initial_data_seeding.sql
-- ==========================================

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

-- Create enhanced SMS notifications table
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

-- Create customer_notifications table for enhanced notification tracking
CREATE TABLE IF NOT EXISTS customer_notifications (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER, -- Allow NULL for existing compatibility
    notification_type VARCHAR(50) NOT NULL, -- 'sms', 'email', 'push'
    title VARCHAR(255),
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed', 'read'
    delivery_method VARCHAR(50), -- 'sms_gateway', 'email_service', 'push_service'
    external_id VARCHAR(100), -- External service message ID
    metadata JSONB, -- Additional data (phone, email, etc.)
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Check and add missing columns to customer_notifications if needed
DO $$
BEGIN
    -- Ensure customer_id column exists (allow NULL initially for existing data)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_notifications' AND column_name = 'customer_id') THEN
        ALTER TABLE customer_notifications ADD COLUMN customer_id INTEGER;
        RAISE NOTICE 'Added customer_id column to customer_notifications';
    END IF;
    
    -- Ensure notification_type column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_notifications' AND column_name = 'notification_type') THEN
        ALTER TABLE customer_notifications ADD COLUMN notification_type VARCHAR(50) NOT NULL DEFAULT 'sms';
        RAISE NOTICE 'Added notification_type column to customer_notifications';
    END IF;
    
    -- Ensure status column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_notifications' AND column_name = 'status') THEN
        ALTER TABLE customer_notifications ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
        RAISE NOTICE 'Added status column to customer_notifications';
    END IF;
    
    -- Ensure title column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_notifications' AND column_name = 'title') THEN
        ALTER TABLE customer_notifications ADD COLUMN title VARCHAR(255);
        RAISE NOTICE 'Added title column to customer_notifications';
    END IF;
    
    -- Ensure delivery_method column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_notifications' AND column_name = 'delivery_method') THEN
        ALTER TABLE customer_notifications ADD COLUMN delivery_method VARCHAR(50);
        RAISE NOTICE 'Added delivery_method column to customer_notifications';
    END IF;
    
    -- Ensure external_id column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_notifications' AND column_name = 'external_id') THEN
        ALTER TABLE customer_notifications ADD COLUMN external_id VARCHAR(100);
        RAISE NOTICE 'Added external_id column to customer_notifications';
    END IF;
    
    -- Ensure metadata column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_notifications' AND column_name = 'metadata') THEN
        ALTER TABLE customer_notifications ADD COLUMN metadata JSONB;
        RAISE NOTICE 'Added metadata column to customer_notifications';
    END IF;
    
    -- Ensure sent_at column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_notifications' AND column_name = 'sent_at') THEN
        ALTER TABLE customer_notifications ADD COLUMN sent_at TIMESTAMP;
        RAISE NOTICE 'Added sent_at column to customer_notifications';
    END IF;
    
    -- Ensure delivered_at column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_notifications' AND column_name = 'delivered_at') THEN
        ALTER TABLE customer_notifications ADD COLUMN delivered_at TIMESTAMP;
        RAISE NOTICE 'Added delivered_at column to customer_notifications';
    END IF;
    
    -- Ensure read_at column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_notifications' AND column_name = 'read_at') THEN
        ALTER TABLE customer_notifications ADD COLUMN read_at TIMESTAMP;
        RAISE NOTICE 'Added read_at column to customer_notifications';
    END IF;
    
    -- Ensure error_message column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_notifications' AND column_name = 'error_message') THEN
        ALTER TABLE customer_notifications ADD COLUMN error_message TEXT;
        RAISE NOTICE 'Added error_message column to customer_notifications';
    END IF;
    
    -- Ensure retry_count column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_notifications' AND column_name = 'retry_count') THEN
        ALTER TABLE customer_notifications ADD COLUMN retry_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Added retry_count column to customer_notifications';
    END IF;
    
    -- Ensure updated_at column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_notifications' AND column_name = 'updated_at') THEN
        ALTER TABLE customer_notifications ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added updated_at column to customer_notifications';
    END IF;
END $$;

-- Add foreign key constraints for new tables
DO $$
BEGIN
    -- Queue Events -> Customers
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_queue_events_customer_id') THEN
        ALTER TABLE queue_events ADD CONSTRAINT fk_queue_events_customer_id 
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
    END IF;

    -- Queue Events -> Counters
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_queue_events_counter_id') THEN
        ALTER TABLE queue_events ADD CONSTRAINT fk_queue_events_counter_id 
            FOREIGN KEY (counter_id) REFERENCES counters(id) ON DELETE SET NULL;
    END IF;

    -- SMS Notifications -> Customers
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_sms_notifications_customer_id') THEN
        ALTER TABLE sms_notifications ADD CONSTRAINT fk_sms_notifications_customer_id 
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
    END IF;

    -- Customer Notifications -> Customers
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_customer_notifications_customer_id') THEN
        ALTER TABLE customer_notifications ADD CONSTRAINT fk_customer_notifications_customer_id 
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
    END IF;

    -- Daily Queue Summary -> Counters (busiest_counter_id)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_daily_queue_summary_busiest_counter') THEN
        ALTER TABLE daily_queue_summary ADD CONSTRAINT fk_daily_queue_summary_busiest_counter 
            FOREIGN KEY (busiest_counter_id) REFERENCES counters(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create indexes for analytics tables
CREATE INDEX IF NOT EXISTS idx_queue_analytics_date_hour ON queue_analytics(date, hour);
CREATE INDEX IF NOT EXISTS idx_daily_queue_summary_date ON daily_queue_summary(date);
CREATE INDEX IF NOT EXISTS idx_queue_events_customer_id ON queue_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_queue_events_created_at ON queue_events(created_at);
CREATE INDEX IF NOT EXISTS idx_queue_events_event_type ON queue_events(event_type);

CREATE INDEX IF NOT EXISTS idx_sms_notifications_customer_id ON sms_notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_sms_notifications_status ON sms_notifications(status);
CREATE INDEX IF NOT EXISTS idx_sms_notifications_created_at ON sms_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_sms_notifications_notification_type ON sms_notifications(notification_type);

CREATE INDEX IF NOT EXISTS idx_customer_notifications_customer_id ON customer_notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_status ON customer_notifications(status);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_type ON customer_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_customer_notifications_created_at ON customer_notifications(created_at);

-- Create or replace the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at on new tables
DROP TRIGGER IF EXISTS update_queue_analytics_updated_at ON queue_analytics;
CREATE TRIGGER update_queue_analytics_updated_at
    BEFORE UPDATE ON queue_analytics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_queue_summary_updated_at ON daily_queue_summary;
CREATE TRIGGER update_daily_queue_summary_updated_at
    BEFORE UPDATE ON daily_queue_summary
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_notifications_updated_at ON customer_notifications;
CREATE TRIGGER update_customer_notifications_updated_at
    BEFORE UPDATE ON customer_notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add performance indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_token_number ON customers(token_number);
CREATE INDEX IF NOT EXISTS idx_customers_served_at ON customers(served_at);
CREATE INDEX IF NOT EXISTS idx_customers_priority_score ON customers(priority_score);

CREATE INDEX IF NOT EXISTS idx_counters_display_order ON counters(display_order);
CREATE INDEX IF NOT EXISTS idx_counters_is_active ON counters(is_active);

-- ==========================================
-- MIGRATION COMPLETION
-- ==========================================

INSERT INTO schema_migrations (version, name, checksum, status) 
VALUES ('003', '003_enhanced_analytics_sms.sql', 'c3d4e5f6g7h8', 'completed')
ON CONFLICT (version) DO UPDATE SET 
    status = 'completed',
    applied_at = CURRENT_TIMESTAMP;

-- Log completion
SELECT 'Migration 003: Enhanced Analytics and SMS System - COMPLETED' as migration_status;
