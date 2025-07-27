-- Only work with existing tables, don't create new ones to avoid conflicts

-- Create counters table if it doesn't exist
CREATE TABLE IF NOT EXISTS counters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add display_order column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'counters' AND column_name = 'display_order') THEN
        ALTER TABLE counters ADD COLUMN display_order INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add current_customer_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'counters' AND column_name = 'current_customer_id') THEN
        ALTER TABLE counters ADD COLUMN current_customer_id INTEGER;
        -- Add foreign key constraint if customers table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
            ALTER TABLE counters ADD CONSTRAINT fk_counters_current_customer 
                FOREIGN KEY (current_customer_id) REFERENCES customers(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- Create index for display_order after ensuring column exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'counters' AND column_name = 'display_order') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'counters' AND indexname = 'idx_counters_display_order') THEN
            CREATE INDEX idx_counters_display_order ON counters(display_order);
        END IF;
    END IF;
END $$;

-- Insert some default counters if they don't exist
INSERT INTO counters (name, display_order, is_active)
SELECT 'Counter 1', 1, true
WHERE NOT EXISTS (SELECT 1 FROM counters WHERE name = 'Counter 1');

INSERT INTO counters (name, display_order, is_active)
SELECT 'Counter 2', 2, true
WHERE NOT EXISTS (SELECT 1 FROM counters WHERE name = 'Counter 2');

-- Create grade_types table if it doesn't exist
CREATE TABLE IF NOT EXISTS grade_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create lens_types table if it doesn't exist
CREATE TABLE IF NOT EXISTS lens_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default grade types if they don't exist
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
SELECT 'Single Vision Hi-Cylinder (SV-HC)', 'Single vision with high cylinder correction'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Single Vision Hi-Cylinder (SV-HC)');

INSERT INTO grade_types (name, description)
SELECT 'Process Single Vision (PROC-SV)', 'Processed single vision lenses'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Process Single Vision (PROC-SV)');

INSERT INTO grade_types (name, description)
SELECT 'Progressive (PROG)', 'Progressive lenses with gradual power change'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Progressive (PROG)');

INSERT INTO grade_types (name, description)
SELECT 'Process-Progressive (PROC-PROG)', 'Processed progressive lenses'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Process-Progressive (PROC-PROG)');

INSERT INTO grade_types (name, description)
SELECT 'Doble Vista (KK)', 'Double vision correction'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Doble Vista (KK)');

INSERT INTO grade_types (name, description)
SELECT 'Process Doble Vista (PROC-KK)', 'Processed double vision correction'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Process Doble Vista (PROC-KK)');

INSERT INTO grade_types (name, description)
SELECT 'Single Vision-Ultra Thin 1.61 (SV-UTH 1.61)', 'Single vision with ultra-thin 1.61 index'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Single Vision-Ultra Thin 1.61 (SV-UTH 1.61)');

INSERT INTO grade_types (name, description)
SELECT 'Single Vision-Ultra Thin 1.67 (SV-UTH 1.67)', 'Single vision with ultra-thin 1.67 index'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Single Vision-Ultra Thin 1.67 (SV-UTH 1.67)');

INSERT INTO grade_types (name, description)
SELECT 'Flat-Top (F.T)', 'Flat-top bifocal lenses'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Flat-Top (F.T)');

INSERT INTO grade_types (name, description)
SELECT 'Process Flat-Top (Proc-F.T)', 'Processed flat-top bifocal lenses'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Process Flat-Top (Proc-F.T)');

INSERT INTO grade_types (name, description)
SELECT 'Ultra-Thin High Cylinder 1.61 (UTH 1.61 HC)', 'Ultra-thin high cylinder 1.61 index'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Ultra-Thin High Cylinder 1.61 (UTH 1.61 HC)');

INSERT INTO grade_types (name, description)
SELECT 'Ultra-Thin High Cylinder 1.67 (UTH 1.67 HC)', 'Ultra-thin high cylinder 1.67 index'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Ultra-Thin High Cylinder 1.67 (UTH 1.67 HC)');

INSERT INTO grade_types (name, description)
SELECT 'Process High Cylinder Ultra Thin 1.61 (PROC-HC-UTH 1.61)', 'Processed high cylinder ultra-thin 1.61'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Process High Cylinder Ultra Thin 1.61 (PROC-HC-UTH 1.61)');

INSERT INTO grade_types (name, description)
SELECT 'Process High Cylinder Ultra Thin 1.67 (PROC-HC-UTH 1.67)', 'Processed high cylinder ultra-thin 1.67'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Process High Cylinder Ultra Thin 1.67 (PROC-HC-UTH 1.67)');

INSERT INTO grade_types (name, description)
SELECT 'other', 'Other grade type not listed'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'other');

-- Insert default lens types if they don't exist
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

INSERT INTO lens_types (name, description)
SELECT 'ambermatic tinted (AMB)', 'Ambermatic tinted lenses - specify color'
WHERE NOT EXISTS (SELECT 1 FROM lens_types WHERE name = 'ambermatic tinted (AMB)');

INSERT INTO lens_types (name, description)
SELECT 'essilor', 'Essilor brand lenses'
WHERE NOT EXISTS (SELECT 1 FROM lens_types WHERE name = 'essilor');

INSERT INTO lens_types (name, description)
SELECT 'hoya', 'Hoya brand lenses'
WHERE NOT EXISTS (SELECT 1 FROM lens_types WHERE name = 'hoya');

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

-- SMS templates table is now handled by the migration script
-- migrate-sms-templates.sql runs before this file

-- Add reset_token and reset_token_expiry columns to users table if they don't exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'reset_token') THEN
            ALTER TABLE users ADD COLUMN reset_token VARCHAR(255);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'reset_token_expiry') THEN
            ALTER TABLE users ADD COLUMN reset_token_expiry TIMESTAMP;
        END IF;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_queue_analytics_date_hour ON queue_analytics(date, hour);
CREATE INDEX IF NOT EXISTS idx_daily_queue_summary_date ON daily_queue_summary(date);
CREATE INDEX IF NOT EXISTS idx_queue_events_customer_id ON queue_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_queue_events_created_at ON queue_events(created_at);
CREATE INDEX IF NOT EXISTS idx_sms_notifications_customer_id ON sms_notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_sms_notifications_status ON sms_notifications(status);
CREATE INDEX IF NOT EXISTS idx_sms_notifications_created_at ON sms_notifications(created_at);

-- Create index for reset_token if users table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexname = 'idx_users_reset_token') THEN
            CREATE INDEX idx_users_reset_token ON users(reset_token);
        END IF;
    END IF;
END $$;
