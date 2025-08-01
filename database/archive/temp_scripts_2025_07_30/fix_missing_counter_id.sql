-- Add missing column to customer_history table
ALTER TABLE customer_history ADD COLUMN IF NOT EXISTS counter_id INTEGER;

-- Commit changes
COMMIT;

