-- Complete migration script for payment tracking features
-- This script adds payment tracking capabilities to the transactions table
-- and creates a payment_settlements table for tracking partial payments

-- ============================================================================
-- MIGRATION UP
-- ============================================================================

-- Add new columns to transactions table (only if they don't exist)
DO $$
BEGIN
    -- Add updated_at column if it doesn't exist (needed for triggers)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'updated_at') THEN
        ALTER TABLE transactions ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
    
    -- Add paid_amount column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'paid_amount') THEN
        ALTER TABLE transactions ADD COLUMN paid_amount DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    -- Add balance_amount column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'balance_amount') THEN
        ALTER TABLE transactions ADD COLUMN balance_amount DECIMAL(10,2) GENERATED ALWAYS AS (amount - paid_amount) STORED;
    END IF;
    
    -- Add payment_status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'payment_status') THEN
        ALTER TABLE transactions ADD COLUMN payment_status VARCHAR(20) CHECK (payment_status IN ('unpaid', 'partial', 'paid')) DEFAULT 'unpaid';
    END IF;
END $$;

-- Create payment_settlements table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS payment_settlements (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    payment_mode VARCHAR(50) NOT NULL CHECK (payment_mode IN ('gcash', 'maya', 'bank_transfer', 'credit_card', 'cash')),
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cashier_id INTEGER REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns to payment_settlements table if they don't exist
DO $$
BEGIN
    -- Add notes column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settlements' AND column_name = 'notes') THEN
        ALTER TABLE payment_settlements ADD COLUMN notes TEXT;
    END IF;
    
    -- Add created_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settlements' AND column_name = 'created_at') THEN
        ALTER TABLE payment_settlements ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Create indexes for payment_settlements table (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_payment_settlements_transaction_id ON payment_settlements(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_settlements_paid_at ON payment_settlements(paid_at);
CREATE INDEX IF NOT EXISTS idx_payment_settlements_cashier_id ON payment_settlements(cashier_id);
CREATE INDEX IF NOT EXISTS idx_payment_settlements_payment_mode ON payment_settlements(payment_mode);

-- Create additional indexes for transactions table (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_paid_amount ON transactions(paid_amount);
CREATE INDEX IF NOT EXISTS idx_transactions_balance_amount ON transactions(balance_amount);

-- Create a function to update payment status based on paid amount
CREATE OR REPLACE FUNCTION update_payment_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update payment status based on paid amount vs total amount
    IF NEW.paid_amount = 0 THEN
        NEW.payment_status = 'unpaid';
    ELSIF NEW.paid_amount >= NEW.amount THEN
        NEW.payment_status = 'paid';
    ELSE
        NEW.payment_status = 'partial';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update payment status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_payment_status') THEN
        CREATE TRIGGER trigger_update_payment_status
            BEFORE UPDATE ON transactions
            FOR EACH ROW
            WHEN (OLD.paid_amount IS DISTINCT FROM NEW.paid_amount)
            EXECUTE FUNCTION update_payment_status();
    END IF;
END $$;

-- Create a function to update transaction paid amount after payment settlement
CREATE OR REPLACE FUNCTION update_transaction_paid_amount()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the paid amount in transactions table
    UPDATE transactions 
    SET paid_amount = COALESCE((
        SELECT SUM(amount) 
        FROM payment_settlements 
        WHERE transaction_id = NEW.transaction_id
    ), 0)
    WHERE id = NEW.transaction_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update transaction paid amount after payment settlement insert
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_transaction_paid_amount_insert') THEN
        CREATE TRIGGER trigger_update_transaction_paid_amount_insert
            AFTER INSERT ON payment_settlements
            FOR EACH ROW
            EXECUTE FUNCTION update_transaction_paid_amount();
    END IF;
END $$;

-- Create trigger to update transaction paid amount after payment settlement update
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_transaction_paid_amount_update') THEN
        CREATE TRIGGER trigger_update_transaction_paid_amount_update
            AFTER UPDATE ON payment_settlements
            FOR EACH ROW
            EXECUTE FUNCTION update_transaction_paid_amount();
    END IF;
END $$;

-- Create trigger to update transaction paid amount after payment settlement delete
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_transaction_paid_amount_delete') THEN
        CREATE TRIGGER trigger_update_transaction_paid_amount_delete
            AFTER DELETE ON payment_settlements
            FOR EACH ROW
            EXECUTE FUNCTION update_transaction_paid_amount();
    END IF;
END $$;

-- Update existing transactions to set initial payment status
UPDATE transactions 
SET payment_status = 'paid', 
    paid_amount = amount 
WHERE payment_status = 'unpaid';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Add comments for documentation (only for existing columns)
DO $$
BEGIN
    -- Add comments for transactions table columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'paid_amount') THEN
        EXECUTE 'COMMENT ON COLUMN transactions.paid_amount IS ''Total amount paid for this transaction''';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'balance_amount') THEN
        EXECUTE 'COMMENT ON COLUMN transactions.balance_amount IS ''Remaining balance (calculated as amount - paid_amount)''';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'payment_status') THEN
        EXECUTE 'COMMENT ON COLUMN transactions.payment_status IS ''Payment status: unpaid, partial, or paid''';
    END IF;
    
    -- Add comments for payment_settlements table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_settlements') THEN
        EXECUTE 'COMMENT ON TABLE payment_settlements IS ''Records of individual payment settlements for transactions''';
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settlements' AND column_name = 'transaction_id') THEN
            EXECUTE 'COMMENT ON COLUMN payment_settlements.transaction_id IS ''Reference to the transaction being paid''';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settlements' AND column_name = 'amount') THEN
            EXECUTE 'COMMENT ON COLUMN payment_settlements.amount IS ''Amount paid in this settlement''';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settlements' AND column_name = 'payment_mode') THEN
            EXECUTE 'COMMENT ON COLUMN payment_settlements.payment_mode IS ''Method of payment used''';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settlements' AND column_name = 'paid_at') THEN
            EXECUTE 'COMMENT ON COLUMN payment_settlements.paid_at IS ''Timestamp when payment was made''';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settlements' AND column_name = 'cashier_id') THEN
            EXECUTE 'COMMENT ON COLUMN payment_settlements.cashier_id IS ''User who processed the payment''';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payment_settlements' AND column_name = 'notes') THEN
            EXECUTE 'COMMENT ON COLUMN payment_settlements.notes IS ''Additional notes about the payment''';
        END IF;
    END IF;
END $$;
