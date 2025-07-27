-- Add served_at field to customers table
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS served_at TIMESTAMPTZ;

-- Optional index for analytics speed
CREATE INDEX IF NOT EXISTS idx_customers_served_at ON customers(served_at);
