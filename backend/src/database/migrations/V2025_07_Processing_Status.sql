-- V2025_07_Processing_Status.sql
-- Migration: Add 'processing' queue status and SLA tracking columns
-- Date: 2025-07-21
-- Purpose: Enhance queue management with processing status and SLA metrics

-- This migration is idempotent and backward-compatible

BEGIN;

-- Step 1: Add 'processing' status to queue_status enum constraint
-- First check current queue_status constraint and update it
DO $$
BEGIN
    RAISE NOTICE 'Updating queue_status constraint to include processing status...';
    
    -- Drop the existing constraint
    ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_queue_status_check;
    
    -- Add the new constraint with processing status
    ALTER TABLE customers ADD CONSTRAINT customers_queue_status_check 
    CHECK (queue_status IN ('waiting', 'serving', 'completed', 'cancelled', 'processing') OR queue_status = 'unknown');
    
    RAISE NOTICE 'Queue status constraint updated successfully.';
END $$;

-- Step 2: Add nullable TIMESTAMPTZ columns to queue_events for SLA metrics
DO $$
BEGIN
    RAISE NOTICE 'Adding SLA tracking columns to queue_events table...';
    
    -- Add processing_start_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'queue_events' AND column_name = 'processing_start_at') THEN
        ALTER TABLE queue_events ADD COLUMN processing_start_at TIMESTAMPTZ;
        RAISE NOTICE 'Added processing_start_at column to queue_events.';
    ELSE
        RAISE NOTICE 'Column processing_start_at already exists in queue_events.';
    END IF;
    
    -- Add processing_end_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'queue_events' AND column_name = 'processing_end_at') THEN
        ALTER TABLE queue_events ADD COLUMN processing_end_at TIMESTAMPTZ;
        RAISE NOTICE 'Added processing_end_at column to queue_events.';
    ELSE
        RAISE NOTICE 'Column processing_end_at already exists in queue_events.';
    END IF;
END $$;

-- Step 3: Create indexes for better performance on new columns
DO $$
BEGIN
    -- Create index for processing_start_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                   WHERE tablename = 'queue_events' AND indexname = 'idx_queue_events_processing_start_at') THEN
        CREATE INDEX idx_queue_events_processing_start_at ON queue_events(processing_start_at) 
        WHERE processing_start_at IS NOT NULL;
        RAISE NOTICE 'Created index idx_queue_events_processing_start_at.';
    ELSE
        RAISE NOTICE 'Index idx_queue_events_processing_start_at already exists.';
    END IF;
    
    -- Create index for processing_end_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                   WHERE tablename = 'queue_events' AND indexname = 'idx_queue_events_processing_end_at') THEN
        CREATE INDEX idx_queue_events_processing_end_at ON queue_events(processing_end_at) 
        WHERE processing_end_at IS NOT NULL;
        RAISE NOTICE 'Created index idx_queue_events_processing_end_at.';
    ELSE
        RAISE NOTICE 'Index idx_queue_events_processing_end_at already exists.';
    END IF;
    
    -- Create composite index for SLA calculations
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                   WHERE tablename = 'queue_events' AND indexname = 'idx_queue_events_processing_sla') THEN
        CREATE INDEX idx_queue_events_processing_sla ON queue_events(customer_id, processing_start_at, processing_end_at) 
        WHERE processing_start_at IS NOT NULL;
        RAISE NOTICE 'Created index idx_queue_events_processing_sla.';
    ELSE
        RAISE NOTICE 'Index idx_queue_events_processing_sla already exists.';
    END IF;
END $$;

-- Step 4: Update existing 'unknown' status to 'waiting' for backward compatibility
DO $$
DECLARE
    unknown_count INTEGER;
BEGIN
    -- Count customers with unknown status
    SELECT COUNT(*) INTO unknown_count FROM customers WHERE queue_status = 'unknown';
    
    IF unknown_count > 0 THEN
        RAISE NOTICE 'Found % customers with unknown queue_status, updating to waiting...', unknown_count;
        
        UPDATE customers 
        SET queue_status = 'waiting',
            updated_at = CURRENT_TIMESTAMP,
            remarks = COALESCE(remarks || ' | ', '') || 'Status updated from unknown to waiting during processing status migration'
        WHERE queue_status = 'unknown';
        
        RAISE NOTICE 'Updated % customers from unknown to waiting status.', unknown_count;
    ELSE
        RAISE NOTICE 'No customers with unknown queue_status found.';
    END IF;
END $$;

-- Step 5: Update validation functions if they exist
-- Update validate_queue_status function to include 'processing' status
CREATE OR REPLACE FUNCTION validate_queue_status(input_status TEXT) 
RETURNS TEXT AS $$
BEGIN
    -- Return the input if it's valid (including new processing status)
    IF input_status IN ('waiting', 'serving', 'completed', 'cancelled', 'processing') THEN
        RETURN input_status;
    END IF;
    
    -- Log unknown status
    RAISE WARNING 'Unknown queue status "%" encountered, falling back to "waiting"', input_status;
    
    -- Return fallback
    RETURN 'waiting';
END;
$$ LANGUAGE plpgsql;

-- Step 6: Add comments for documentation
COMMENT ON COLUMN queue_events.processing_start_at IS 
'Timestamp when customer processing started - used for SLA metrics calculation';

COMMENT ON COLUMN queue_events.processing_end_at IS 
'Timestamp when customer processing ended - used for SLA metrics calculation';

-- Step 7: Create view for SLA metrics calculation
CREATE OR REPLACE VIEW queue_processing_sla_metrics AS
SELECT 
    qe.customer_id,
    c.name as customer_name,
    c.or_number,
    qe.processing_start_at,
    qe.processing_end_at,
    CASE 
        WHEN qe.processing_start_at IS NOT NULL AND qe.processing_end_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (qe.processing_end_at - qe.processing_start_at)) / 60.0
        ELSE NULL
    END as processing_time_minutes,
    qe.event_type,
    qe.created_at as event_created_at,
    c.queue_status as current_status
FROM queue_events qe
JOIN customers c ON qe.customer_id = c.id
WHERE qe.processing_start_at IS NOT NULL
ORDER BY qe.processing_start_at DESC;

-- Grant select permissions on the view
GRANT SELECT ON queue_processing_sla_metrics TO PUBLIC;

-- Step 8: Final verification and summary
DO $$
DECLARE
    status_summary RECORD;
    total_customers INTEGER;
BEGIN
    RAISE NOTICE '=== PROCESSING STATUS MIGRATION SUMMARY ===';
    
    -- Get total customer count
    SELECT COUNT(*) INTO total_customers FROM customers;
    RAISE NOTICE 'Total customers in database: %', total_customers;
    
    -- Show queue status distribution
    FOR status_summary IN 
        SELECT queue_status, COUNT(*) as count,
               ROUND(COUNT(*) * 100.0 / NULLIF(total_customers, 0), 2) as percentage
        FROM customers 
        GROUP BY queue_status 
        ORDER BY count DESC
    LOOP
        RAISE NOTICE 'Queue Status: % - Count: % (%.2%%)', 
                     status_summary.queue_status, 
                     status_summary.count, 
                     status_summary.percentage;
    END LOOP;
    
    -- Verify new columns exist
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'queue_events' AND column_name = 'processing_start_at') AND
       EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'queue_events' AND column_name = 'processing_end_at') THEN
        RAISE NOTICE 'SLA tracking columns successfully added to queue_events table.';
    ELSE
        RAISE WARNING 'SLA tracking columns may not have been added correctly!';
    END IF;
    
    RAISE NOTICE '=== MIGRATION COMPLETED SUCCESSFULLY ===';
END $$;

COMMIT;
