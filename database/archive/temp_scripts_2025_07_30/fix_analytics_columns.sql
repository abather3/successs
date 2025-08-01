-- Add missing columns to queue_analytics table
ALTER TABLE queue_analytics 
ADD COLUMN IF NOT EXISTS avg_processing_duration_minutes NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_processing_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_processing_duration_minutes NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_processing_duration_minutes NUMERIC(10,2) DEFAULT 0;

-- Add missing columns to daily_queue_summary table
ALTER TABLE daily_queue_summary 
ADD COLUMN IF NOT EXISTS avg_processing_duration_minutes NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_processing_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_processing_duration_minutes NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_processing_duration_minutes NUMERIC(10,2) DEFAULT 0;
