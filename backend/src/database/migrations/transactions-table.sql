-- Migration script to create transactions table
-- This table stores all transaction records with payment information

-- Create transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    or_number VARCHAR(255) NOT NULL UNIQUE,
    amount DECIMAL(10,2) NOT NULL,
    payment_mode VARCHAR(50) NOT NULL,
    sales_agent_id INTEGER NOT NULL,
    cashier_id INTEGER,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_or_number ON transactions(or_number);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_mode ON transactions(payment_mode);
CREATE INDEX IF NOT EXISTS idx_transactions_sales_agent_id ON transactions(sales_agent_id);
CREATE INDEX IF NOT EXISTS idx_transactions_cashier_id ON transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- Create an update trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop the trigger if it exists and create a new one
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_transactions_updated_at();

-- Add foreign key constraints if referenced tables exist
-- Note: These constraints will be added only if the referenced tables exist
DO $$
BEGIN
    -- Add foreign key for customer_id if customers table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                       WHERE constraint_name = 'fk_transactions_customer_id' 
                       AND table_name = 'transactions') THEN
            ALTER TABLE transactions 
            ADD CONSTRAINT fk_transactions_customer_id 
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- Add foreign key for sales_agent_id if users table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                       WHERE constraint_name = 'fk_transactions_sales_agent_id' 
                       AND table_name = 'transactions') THEN
            ALTER TABLE transactions 
            ADD CONSTRAINT fk_transactions_sales_agent_id 
            FOREIGN KEY (sales_agent_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- Add foreign key for cashier_id if users table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                       WHERE constraint_name = 'fk_transactions_cashier_id' 
                       AND table_name = 'transactions') THEN
            ALTER TABLE transactions 
            ADD CONSTRAINT fk_transactions_cashier_id 
            FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;
