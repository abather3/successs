-- ==========================================
-- Migration 004: Payment System Enhancements
-- ==========================================
-- Purpose: Add payment tracking, duplicate prevention, and enhanced reporting
-- Author: System Migration
-- Date: 2025-01-26
-- Dependencies: 003_enhanced_analytics_sms.sql
-- ==========================================

-- Add paid_at column to payment_settlements if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settlements' AND column_name = 'paid_at') THEN
        ALTER TABLE payment_settlements ADD COLUMN paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        -- Update existing records to use settlement_date as paid_at
        UPDATE payment_settlements SET paid_at = settlement_date WHERE paid_at IS NULL;
    END IF;
END $$;

-- Create unique index to prevent duplicate payment settlements
-- This prevents accidental duplicate rows in payment_settlements table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_payment_settlements_unique_combo'
    ) THEN
        -- Create the unique index concurrently to avoid blocking
        CREATE UNIQUE INDEX CONCURRENTLY idx_payment_settlements_unique_combo
        ON payment_settlements (
            transaction_id, 
            date_trunc('second', paid_at),  -- Truncate to seconds to avoid microsecond duplicates
            amount, 
            cashier_id
        );
        
        RAISE NOTICE 'Created unique index idx_payment_settlements_unique_combo';
    ELSE
        RAISE NOTICE 'Index idx_payment_settlements_unique_combo already exists, skipping creation';
    END IF;
END
$$;

-- Add comment for documentation
COMMENT ON INDEX idx_payment_settlements_unique_combo IS 
'Prevents duplicate payment settlements for the same transaction, amount, cashier and timestamp (truncated to seconds). Created for settlement deduplication feature.';

-- Update daily_reports table to include funds column (JSONB format)
DO $$
BEGIN
    -- Check if funds column exists and is TEXT type, then convert to JSONB
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'daily_reports' 
        AND column_name = 'funds' 
        AND data_type = 'text'
    ) THEN
        -- Convert TEXT funds column to JSONB
        ALTER TABLE daily_reports ALTER COLUMN funds TYPE JSONB USING 
            CASE 
                WHEN funds = '[]' OR funds IS NULL THEN '[]'::jsonb
                ELSE funds::jsonb
            END;
        RAISE NOTICE 'Converted daily_reports.funds from TEXT to JSONB';
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'daily_reports' 
        AND column_name = 'funds'
    ) THEN
        -- Add funds column if it doesn't exist
        ALTER TABLE daily_reports ADD COLUMN funds JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Added funds column to daily_reports table';
    END IF;
END $$;

-- Update estimated_time format in customers table
DO $$
BEGIN
    -- Check if estimated_time is VARCHAR and contains non-integer values
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'customers' 
        AND column_name = 'estimated_time' 
        AND data_type = 'character varying'
    ) THEN
        -- Add new integer column
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'customers' 
            AND column_name = 'estimated_time_minutes'
        ) THEN
            ALTER TABLE customers ADD COLUMN estimated_time_minutes INTEGER;
            
            -- Convert existing data where possible
            UPDATE customers 
            SET estimated_time_minutes = 
                CASE 
                    WHEN estimated_time ~ '^[0-9]+$' THEN estimated_time::integer
                    ELSE NULL
                END
            WHERE estimated_time IS NOT NULL;
            
            RAISE NOTICE 'Added estimated_time_minutes column and migrated data';
        END IF;
    END IF;
END $$;

-- Create payment_tracking table for enhanced payment monitoring
CREATE TABLE IF NOT EXISTS payment_tracking (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL,
    payment_event VARCHAR(50) NOT NULL, -- 'initiated', 'processing', 'completed', 'failed', 'refunded'
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    external_reference VARCHAR(100), -- External payment gateway reference
    gateway_response JSONB, -- Full response from payment gateway
    status VARCHAR(50) NOT NULL,
    processed_by INTEGER, -- User ID who processed
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraints for payment_tracking
DO $$
BEGIN
    -- Payment Tracking -> Transactions
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_payment_tracking_transaction_id') THEN
        ALTER TABLE payment_tracking ADD CONSTRAINT fk_payment_tracking_transaction_id 
            FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE;
    END IF;

    -- Payment Tracking -> Users (processed_by)
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_payment_tracking_processed_by') THEN
        ALTER TABLE payment_tracking ADD CONSTRAINT fk_payment_tracking_processed_by 
            FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add indexes for payment_tracking
CREATE INDEX IF NOT EXISTS idx_payment_tracking_transaction_id ON payment_tracking(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_tracking_status ON payment_tracking(status);
CREATE INDEX IF NOT EXISTS idx_payment_tracking_payment_event ON payment_tracking(payment_event);
CREATE INDEX IF NOT EXISTS idx_payment_tracking_processed_at ON payment_tracking(processed_at);
CREATE INDEX IF NOT EXISTS idx_payment_tracking_created_at ON payment_tracking(created_at);

-- Add trigger for payment_tracking updated_at
DROP TRIGGER IF EXISTS update_payment_tracking_updated_at ON payment_tracking;
CREATE TRIGGER update_payment_tracking_updated_at
    BEFORE UPDATE ON payment_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update payment_status calculation for transactions
-- This function will be called to recalculate payment status based on settlements
CREATE OR REPLACE FUNCTION update_transaction_payment_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the transaction's paid_amount and payment_status
    UPDATE transactions 
    SET 
        paid_amount = COALESCE((
            SELECT SUM(amount) 
            FROM payment_settlements 
            WHERE transaction_id = COALESCE(NEW.transaction_id, OLD.transaction_id)
        ), 0),
        payment_status = CASE 
            WHEN COALESCE((
                SELECT SUM(amount) 
                FROM payment_settlements 
                WHERE transaction_id = COALESCE(NEW.transaction_id, OLD.transaction_id)
            ), 0) = 0 THEN 'unpaid'
            WHEN COALESCE((
                SELECT SUM(amount) 
                FROM payment_settlements 
                WHERE transaction_id = COALESCE(NEW.transaction_id, OLD.transaction_id)
            ), 0) >= amount THEN 'paid'
            ELSE 'partial'
        END
    WHERE id = COALESCE(NEW.transaction_id, OLD.transaction_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update payment status when settlements change
DROP TRIGGER IF EXISTS trigger_update_payment_status ON payment_settlements;
CREATE TRIGGER trigger_update_payment_status
    AFTER INSERT OR UPDATE OR DELETE ON payment_settlements
    FOR EACH ROW
    EXECUTE FUNCTION update_transaction_payment_status();

-- Add performance indexes for payment queries
CREATE INDEX IF NOT EXISTS idx_payment_settlements_paid_at ON payment_settlements(paid_at);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_paid_amount ON transactions(paid_amount);

-- Update existing transactions to have correct payment status
-- Note: balance_amount is excluded as it's a generated column
UPDATE transactions 
SET 
    paid_amount = COALESCE((
        SELECT SUM(amount) 
        FROM payment_settlements 
        WHERE transaction_id = transactions.id
    ), 0),
    payment_status = CASE 
        WHEN COALESCE((
            SELECT SUM(amount) 
            FROM payment_settlements 
            WHERE transaction_id = transactions.id
        ), 0) = 0 THEN 'unpaid'
        WHEN COALESCE((
            SELECT SUM(amount) 
            FROM payment_settlements 
            WHERE transaction_id = transactions.id
        ), 0) >= amount THEN 'paid'
        ELSE 'partial'
    END
WHERE EXISTS (SELECT 1 FROM payment_settlements WHERE transaction_id = transactions.id);

-- ==========================================
-- MIGRATION COMPLETION
-- ==========================================

INSERT INTO schema_migrations (version, name, checksum, status) 
VALUES ('004', '004_payment_system_enhancements.sql', 'd4e5f6g7h8i9', 'completed')
ON CONFLICT (version) DO UPDATE SET 
    status = 'completed',
    applied_at = CURRENT_TIMESTAMP;

-- Log completion
SELECT 'Migration 004: Payment System Enhancements - COMPLETED' as migration_status;
