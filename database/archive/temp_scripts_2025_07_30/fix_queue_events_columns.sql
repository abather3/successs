-- Add missing columns to queue_events table
ALTER TABLE queue_events 
ADD COLUMN IF NOT EXISTS details JSONB,
ADD COLUMN IF NOT EXISTS processing_start_at TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN IF NOT EXISTS processing_end_at TIMESTAMP WITHOUT TIME ZONE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_queue_events_processing_start_at ON queue_events(processing_start_at);
CREATE INDEX IF NOT EXISTS idx_queue_events_processing_end_at ON queue_events(processing_end_at);

-- Verify the added columns
\d queue_events;
