-- Add missing columns to daily_queue_history table
ALTER TABLE daily_queue_history 
ADD COLUMN IF NOT EXISTS waiting_customers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS serving_customers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS processing_customers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS completed_customers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cancelled_customers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS priority_customers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS peak_queue_length INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS operating_hours NUMERIC(4,2) DEFAULT 8.0;

-- Verify the added columns
\d daily_queue_history;
