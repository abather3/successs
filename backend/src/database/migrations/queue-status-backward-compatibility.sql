-- Queue Status Backward Compatibility Migration
-- This migration ensures backward compatibility for queue status changes

-- Step 1: First, let's check what queue statuses exist in the current data
DO $$
DECLARE
    status_record RECORD;
BEGIN
    RAISE NOTICE 'Checking existing queue statuses...';
    
    -- Get unique queue statuses from the database
    FOR status_record IN 
        SELECT queue_status, COUNT(*) as count
        FROM customers 
        GROUP BY queue_status 
        ORDER BY count DESC
    LOOP
        RAISE NOTICE 'Found status: % (count: %)', status_record.queue_status, status_record.count;
    END LOOP;
END $$;

-- Step 2: Update any non-standard queue statuses to 'waiting'
-- This handles legacy data that might have invalid statuses
UPDATE customers 
SET queue_status = 'waiting',
    updated_at = CURRENT_TIMESTAMP,
    remarks = COALESCE(remarks || ' | ', '') || 'Status normalized during backward compatibility migration (was: ' || queue_status || ')'
WHERE queue_status NOT IN ('waiting', 'serving', 'completed', 'cancelled')
  AND queue_status IS NOT NULL;

-- Log the number of records updated
DO $$
DECLARE
    update_count INTEGER;
BEGIN
    GET DIAGNOSTICS update_count = ROW_COUNT;
    RAISE NOTICE 'Updated % records with non-standard queue statuses to ''waiting''', update_count;
END $$;

-- Step 3: Handle NULL queue_status records
UPDATE customers 
SET queue_status = 'waiting',
    updated_at = CURRENT_TIMESTAMP,
    remarks = COALESCE(remarks || ' | ', '') || 'Status set to waiting during backward compatibility migration (was NULL)'
WHERE queue_status IS NULL;

-- Log the NULL records updated
DO $$
DECLARE
    null_update_count INTEGER;
BEGIN
    GET DIAGNOSTICS null_update_count = ROW_COUNT;
    RAISE NOTICE 'Updated % records with NULL queue_status to ''waiting''', null_update_count;
END $$;

-- Step 4: Update the constraint to allow temporary unknown status for graceful handling
-- This allows the system to handle unknown statuses without failing, they'll be processed by the application layer
ALTER TABLE customers 
DROP CONSTRAINT IF EXISTS customers_queue_status_check;

ALTER TABLE customers 
ADD CONSTRAINT customers_queue_status_check 
CHECK (queue_status IN ('waiting', 'serving', 'completed', 'cancelled', 'unknown'));

-- Step 5: Add an index for better performance on queue status queries
-- Only create if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'customers' 
        AND indexname = 'idx_customers_queue_status_updated'
    ) THEN
        CREATE INDEX idx_customers_queue_status_updated 
        ON customers(queue_status, updated_at) 
        WHERE queue_status IN ('waiting', 'serving');
        RAISE NOTICE 'Created index idx_customers_queue_status_updated';
    ELSE
        RAISE NOTICE 'Index idx_customers_queue_status_updated already exists';
    END IF;
END $$;

-- Step 6: Create a function to validate queue status with fallback
CREATE OR REPLACE FUNCTION validate_queue_status(input_status TEXT) 
RETURNS TEXT AS $$
BEGIN
    -- Return the input if it's valid
    IF input_status IN ('waiting', 'serving', 'completed', 'cancelled') THEN
        RETURN input_status;
    END IF;
    
    -- Log unknown status (in real implementation, this could send to monitoring)
    RAISE WARNING 'Unknown queue status "%" encountered, falling back to "waiting"', input_status;
    
    -- Return fallback
    RETURN 'waiting';
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create a trigger to automatically handle invalid statuses on insert/update
CREATE OR REPLACE FUNCTION validate_queue_status_trigger() 
RETURNS TRIGGER AS $$
BEGIN
    -- Validate and potentially correct the queue_status
    NEW.queue_status = validate_queue_status(NEW.queue_status);
    
    -- Add a note to remarks if status was corrected
    IF NEW.queue_status != OLD.queue_status AND TG_OP = 'UPDATE' THEN
        NEW.remarks = COALESCE(NEW.remarks || ' | ', '') || 
                      'Status auto-corrected from "' || OLD.queue_status || '" to "' || NEW.queue_status || '"';
    ELSIF NEW.queue_status = 'waiting' AND TG_OP = 'INSERT' AND 
          NEW.queue_status != COALESCE(OLD.queue_status, 'waiting') THEN
        NEW.remarks = COALESCE(NEW.remarks || ' | ', '') || 
                      'Status auto-corrected to "waiting" during insert';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'validate_queue_status_before_change'
    ) THEN
        CREATE TRIGGER validate_queue_status_before_change
        BEFORE INSERT OR UPDATE ON customers
        FOR EACH ROW
        EXECUTE FUNCTION validate_queue_status_trigger();
        
        RAISE NOTICE 'Created trigger validate_queue_status_before_change';
    ELSE
        RAISE NOTICE 'Trigger validate_queue_status_before_change already exists';
    END IF;
END $$;

-- Step 8: Create a monitoring view for queue status analysis
CREATE OR REPLACE VIEW queue_status_monitoring AS
SELECT 
    queue_status,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_count,
    COUNT(*) FILTER (WHERE updated_at >= CURRENT_DATE - INTERVAL '1 hour') as recent_updates,
    MIN(created_at) as first_seen,
    MAX(updated_at) as last_updated
FROM customers
GROUP BY queue_status
ORDER BY total_count DESC;

-- Grant appropriate permissions
GRANT SELECT ON queue_status_monitoring TO PUBLIC;

-- Step 9: Final verification and summary
DO $$
DECLARE
    summary_record RECORD;
    total_customers INTEGER;
BEGIN
    RAISE NOTICE '=== BACKWARD COMPATIBILITY MIGRATION SUMMARY ===';
    
    SELECT COUNT(*) INTO total_customers FROM customers;
    RAISE NOTICE 'Total customers: %', total_customers;
    
    FOR summary_record IN 
        SELECT queue_status, COUNT(*) as count, 
               ROUND(COUNT(*) * 100.0 / total_customers, 2) as percentage
        FROM customers 
        GROUP BY queue_status 
        ORDER BY count DESC
    LOOP
        RAISE NOTICE 'Status: % - Count: % (%.2%)', 
                     summary_record.queue_status, 
                     summary_record.count, 
                     summary_record.percentage;
    END LOOP;
    
    RAISE NOTICE '=== MIGRATION COMPLETED SUCCESSFULLY ===';
END $$;

-- Add comments for documentation
COMMENT ON FUNCTION validate_queue_status(TEXT) IS 
'Validates queue status input and provides fallback to waiting for unknown values. Used for backward compatibility.';

COMMENT ON FUNCTION validate_queue_status_trigger() IS 
'Trigger function that automatically validates and corrects queue status values on insert/update operations.';

COMMENT ON VIEW queue_status_monitoring IS 
'Monitoring view for analyzing queue status distribution and identifying potential issues with unknown statuses.';

-- Step 10: Create cleanup script for future use (commented out)
/*
-- CLEANUP SCRIPT (uncomment if needed to remove backward compatibility features)

-- Remove the trigger
DROP TRIGGER IF EXISTS validate_queue_status_before_change ON customers;

-- Remove the functions
DROP FUNCTION IF EXISTS validate_queue_status_trigger();
DROP FUNCTION IF EXISTS validate_queue_status(TEXT);

-- Remove the monitoring view
DROP VIEW IF EXISTS queue_status_monitoring;

-- Restore original constraint (remove 'unknown' status)
ALTER TABLE customers 
DROP CONSTRAINT IF EXISTS customers_queue_status_check;

ALTER TABLE customers 
ADD CONSTRAINT customers_queue_status_check 
CHECK (queue_status IN ('waiting', 'serving', 'completed', 'cancelled'));
*/
