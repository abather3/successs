-- Migration script for adding payment tracking features

-- Add new columns to transactions (only if they don't exist)
DO $$
BEGIN
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
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_mode VARCHAR(50) NOT NULL CHECK (payment_mode IN ('gcash', 'maya', 'bank_transfer', 'credit_card', 'cash')),
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cashier_id INTEGER REFERENCES users(id)
);

-- Create indexes for payment_settlements (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_payment_settlements_transaction_id ON payment_settlements(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_settlements_paid_at ON payment_settlements(paid_at);
