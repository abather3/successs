-- ==========================================
-- Backfill Historical Queue Analytics Data
-- ==========================================
-- This script manually backfills missing historical data for the past few days

-- Function to create snapshot data for a specific date
CREATE OR REPLACE FUNCTION create_historical_snapshot(target_date DATE)
RETURNS TABLE(
  date DATE,
  total_customers INT,
  waiting_customers INT,
  serving_customers INT,
  processing_customers INT,
  completed_customers INT,
  cancelled_customers INT,
  priority_customers INT,
  avg_wait_time NUMERIC,
  peak_queue_length INT,
  operating_hours INT
) AS $$
BEGIN
  RETURN QUERY
  WITH queue_stats AS (
    SELECT 
      COUNT(*) as total_customers,
      COUNT(*) FILTER (WHERE queue_status = 'waiting') as waiting_customers,
      COUNT(*) FILTER (WHERE queue_status = 'serving') as serving_customers,
      COUNT(*) FILTER (WHERE queue_status = 'processing') as processing_customers,
      COUNT(*) FILTER (WHERE queue_status = 'completed') as completed_customers,
      COUNT(*) FILTER (WHERE queue_status = 'cancelled') as cancelled_customers,
      COUNT(*) FILTER (WHERE 
        priority_flags->>'senior_citizen' = 'true' OR 
        priority_flags->>'pregnant' = 'true' OR 
        priority_flags->>'pwd' = 'true'
      ) as priority_customers
    FROM customers 
    WHERE DATE(created_at) = target_date
  ),
  wait_time_stats AS (
    SELECT 
      AVG(
        CASE 
          WHEN queue_status IN ('serving', 'processing', 'completed') 
          THEN EXTRACT(EPOCH FROM (served_at - created_at))/60.0
          ELSE EXTRACT(EPOCH FROM (NOW() - created_at))/60.0
        END
      ) as avg_wait_time
    FROM customers 
    WHERE DATE(created_at) = target_date
  ),
  peak_stats AS (
    SELECT 
      MAX(hourly_count) as peak_queue_length
    FROM (
      SELECT 
        COUNT(*) as hourly_count
      FROM customers 
      WHERE DATE(created_at) = target_date
      GROUP BY EXTRACT(HOUR FROM created_at)
    ) hourly_counts
  )
  SELECT 
    target_date as date,
    COALESCE(qs.total_customers, 0)::INT as total_customers,
    COALESCE(qs.waiting_customers, 0)::INT as waiting_customers,
    COALESCE(qs.serving_customers, 0)::INT as serving_customers,
    COALESCE(qs.processing_customers, 0)::INT as processing_customers,
    COALESCE(qs.completed_customers, 0)::INT as completed_customers,
    COALESCE(qs.cancelled_customers, 0)::INT as cancelled_customers,
    COALESCE(qs.priority_customers, 0)::INT as priority_customers,
    COALESCE(wts.avg_wait_time, 0) as avg_wait_time,
    COALESCE(ps.peak_queue_length, 0)::INT as peak_queue_length,
    24 as operating_hours -- Full 24-hour day for completed day
  FROM queue_stats qs
  CROSS JOIN wait_time_stats wts
  CROSS JOIN peak_stats ps;
END;
$$ LANGUAGE plpgsql;

-- Backfill data for each missing date
DO $$
DECLARE
  target_date DATE;
  snapshot_data RECORD;
  customer_count INT;
BEGIN
  -- Array of dates to backfill
  FOR target_date IN 
    SELECT unnest(ARRAY['2025-07-25', '2025-07-26', '2025-07-27', '2025-07-28', '2025-07-29']::DATE[])
  LOOP
    RAISE NOTICE '[BACKFILL] Processing date: %', target_date;
    
    -- Check if we have customers for this date
    SELECT COUNT(*) INTO customer_count 
    FROM customers 
    WHERE DATE(created_at) = target_date;
    
    RAISE NOTICE '[BACKFILL] Found % customers for %', customer_count, target_date;
    
    IF customer_count = 0 THEN
      RAISE NOTICE '[BACKFILL] No customers found for %, skipping', target_date;
      CONTINUE;
    END IF;
    
    -- Get snapshot data
    SELECT * INTO snapshot_data
    FROM create_historical_snapshot(target_date);
    
    RAISE NOTICE '[BACKFILL] Snapshot for %: % total, % completed, % waiting', 
      target_date, snapshot_data.total_customers, snapshot_data.completed_customers, snapshot_data.waiting_customers;
    
    -- Insert into daily_queue_history
    INSERT INTO daily_queue_history (
      date, total_customers, waiting_customers, serving_customers, 
      processing_customers, completed_customers, cancelled_customers,
      priority_customers, avg_wait_time_minutes, peak_queue_length,
      operating_hours, archived_at
    ) VALUES (
      snapshot_data.date,
      snapshot_data.total_customers,
      snapshot_data.waiting_customers,
      snapshot_data.serving_customers,
      snapshot_data.processing_customers,
      snapshot_data.completed_customers,
      snapshot_data.cancelled_customers,
      snapshot_data.priority_customers,
      snapshot_data.avg_wait_time,
      snapshot_data.peak_queue_length,
      snapshot_data.operating_hours,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (date) 
    DO UPDATE SET
      total_customers = EXCLUDED.total_customers,
      waiting_customers = EXCLUDED.waiting_customers,
      serving_customers = EXCLUDED.serving_customers,
      processing_customers = EXCLUDED.processing_customers,
      completed_customers = EXCLUDED.completed_customers,
      cancelled_customers = EXCLUDED.cancelled_customers,
      priority_customers = EXCLUDED.priority_customers,
      avg_wait_time_minutes = EXCLUDED.avg_wait_time_minutes,
      peak_queue_length = EXCLUDED.peak_queue_length,
      operating_hours = EXCLUDED.operating_hours,
      archived_at = CURRENT_TIMESTAMP;
    
    -- Update display_monitor_history
    INSERT INTO display_monitor_history (
      date, daily_customers_served, daily_avg_wait_time,
      daily_peak_queue_length, daily_priority_customers,
      operating_efficiency, created_at
    ) VALUES (
      snapshot_data.date,
      snapshot_data.completed_customers,
      ROUND(snapshot_data.avg_wait_time),
      snapshot_data.peak_queue_length,
      snapshot_data.priority_customers,
      CASE 
        WHEN snapshot_data.total_customers > 0 
        THEN ROUND((snapshot_data.completed_customers::NUMERIC / snapshot_data.total_customers) * 100)
        ELSE 0 
      END,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (date)
    DO UPDATE SET
      daily_customers_served = EXCLUDED.daily_customers_served,
      daily_avg_wait_time = EXCLUDED.daily_avg_wait_time,
      daily_peak_queue_length = EXCLUDED.daily_peak_queue_length,
      daily_priority_customers = EXCLUDED.daily_priority_customers,
      operating_efficiency = EXCLUDED.operating_efficiency,
      created_at = CURRENT_TIMESTAMP;
      
    RAISE NOTICE '[BACKFILL] Successfully backfilled data for %', target_date;
  END LOOP;
  
  RAISE NOTICE '[BACKFILL] All missing historical data has been successfully backfilled!';
END;
$$;

-- Clean up the temporary function
DROP FUNCTION create_historical_snapshot(DATE);

-- Verify the backfill results
SELECT 
  date,
  total_customers,
  completed_customers,
  avg_wait_time_minutes,
  peak_queue_length,
  operating_hours
FROM daily_queue_history 
WHERE date >= '2025-07-25' 
ORDER BY date DESC;

SELECT 'Backfill completed successfully!' as status;
