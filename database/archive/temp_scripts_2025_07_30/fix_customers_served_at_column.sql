-- Add missing served_at column to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS served_at TIMESTAMP WITHOUT TIME ZONE;

-- Add index for better performance on served_at queries
CREATE INDEX IF NOT EXISTS idx_customers_served_at ON customers(served_at);

-- Verify the added column
\d customers;
