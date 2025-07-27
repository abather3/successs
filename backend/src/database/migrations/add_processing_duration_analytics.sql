-- Add processing duration and processing count fields to analytics tables
-- This migration adds new columns for tracking processing duration metrics

-- Add processing duration fields to queue_analytics table
ALTER TABLE queue_analytics 
ADD COLUMN IF NOT EXISTS avg_processing_duration_minutes DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_processing_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_processing_duration_minutes DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_processing_duration_minutes DECIMAL(10,2) DEFAULT 0;

-- Add processing duration fields to daily_queue_summary table
ALTER TABLE daily_queue_summary 
ADD COLUMN IF NOT EXISTS avg_processing_duration_minutes DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_processing_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_processing_duration_minutes DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_processing_duration_minutes DECIMAL(10,2) DEFAULT 0;

-- Add processing duration field to queue_events table  
ALTER TABLE queue_events 
ADD COLUMN IF NOT EXISTS processing_duration_minutes DECIMAL(10,2);

-- Create index for better performance on processing duration queries
CREATE INDEX IF NOT EXISTS idx_queue_events_processing_duration ON queue_events(processing_duration_minutes);
CREATE INDEX IF NOT EXISTS idx_queue_analytics_processing ON queue_analytics(avg_processing_duration_minutes);
CREATE INDEX IF NOT EXISTS idx_daily_summary_processing ON daily_queue_summary(avg_processing_duration_minutes);

-- Update existing records with calculated processing duration where possible
UPDATE queue_events 
SET processing_duration_minutes = service_time_minutes 
WHERE processing_duration_minutes IS NULL AND service_time_minutes IS NOT NULL;

COMMIT;
