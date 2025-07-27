-- Create materialized view for queue analytics with processing duration
-- This view provides aggregated queue analytics data for better performance

DROP MATERIALIZED VIEW IF EXISTS queue_analytics_mv CASCADE;

CREATE MATERIALIZED VIEW queue_analytics_mv AS
WITH recent_events AS (
  SELECT 
    DATE(created_at) as event_date,
    EXTRACT(HOUR FROM created_at) as event_hour,
    customer_id,
    event_type,
    counter_id,
    queue_position,
    wait_time_minutes,
    service_time_minutes,
    processing_duration_minutes,
    is_priority,
    created_at
  FROM queue_events
  WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'  -- Keep last 30 days for performance
),
hourly_metrics AS (
  SELECT 
    event_date,
    event_hour,
    COUNT(DISTINCT customer_id) FILTER (WHERE event_type = 'joined') as total_customers,
    COUNT(DISTINCT customer_id) FILTER (WHERE event_type = 'joined' AND is_priority = true) as priority_customers,
    AVG(wait_time_minutes) FILTER (WHERE wait_time_minutes IS NOT NULL) as avg_wait_time_minutes,
    AVG(service_time_minutes) FILTER (WHERE service_time_minutes IS NOT NULL) as avg_service_time_minutes,
    MAX(queue_position) as peak_queue_length,
    COUNT(DISTINCT customer_id) FILTER (WHERE event_type = 'served') as customers_served,
    AVG(processing_duration_minutes) FILTER (WHERE processing_duration_minutes IS NOT NULL) as avg_processing_duration_minutes,
    COUNT(*) FILTER (WHERE processing_duration_minutes IS NOT NULL) as total_processing_count,
    MAX(processing_duration_minutes) as max_processing_duration_minutes,
    MIN(processing_duration_minutes) FILTER (WHERE processing_duration_minutes IS NOT NULL) as min_processing_duration_minutes,
    MAX(created_at) as last_updated
  FROM recent_events
  GROUP BY event_date, event_hour
),
daily_metrics AS (
  SELECT 
    event_date,
    SUM(total_customers) as daily_total_customers,
    SUM(priority_customers) as daily_priority_customers,
    AVG(avg_wait_time_minutes) as daily_avg_wait_time,
    AVG(avg_service_time_minutes) as daily_avg_service_time,
    MAX(peak_queue_length) as daily_peak_queue_length,
    SUM(customers_served) as daily_customers_served,
    AVG(avg_processing_duration_minutes) as daily_avg_processing_duration,
    SUM(total_processing_count) as daily_total_processing_count,
    MAX(max_processing_duration_minutes) as daily_max_processing_duration,
    MIN(min_processing_duration_minutes) as daily_min_processing_duration,
    -- Find busiest hour
    (
      SELECT event_hour 
      FROM hourly_metrics hm2 
      WHERE hm2.event_date = hm.event_date 
      ORDER BY total_customers DESC 
      LIMIT 1
    ) as peak_hour,
    MAX(last_updated) as last_updated
  FROM hourly_metrics hm
  GROUP BY event_date
)
SELECT 
  hm.event_date,
  hm.event_hour,
  hm.total_customers,
  hm.priority_customers,
  hm.avg_wait_time_minutes,
  hm.avg_service_time_minutes,
  hm.peak_queue_length,
  hm.customers_served,
  hm.avg_processing_duration_minutes,
  hm.total_processing_count,
  hm.max_processing_duration_minutes,
  hm.min_processing_duration_minutes,
  dm.daily_total_customers,
  dm.daily_priority_customers,
  dm.daily_avg_wait_time,
  dm.daily_avg_service_time,
  dm.daily_peak_queue_length,
  dm.daily_customers_served,
  dm.daily_avg_processing_duration,
  dm.daily_total_processing_count,
  dm.daily_max_processing_duration,
  dm.daily_min_processing_duration,
  dm.peak_hour,
  hm.last_updated
FROM hourly_metrics hm
JOIN daily_metrics dm ON hm.event_date = dm.event_date;

-- Create indexes on the materialized view for better query performance
CREATE INDEX idx_queue_analytics_mv_date ON queue_analytics_mv(event_date);
CREATE INDEX idx_queue_analytics_mv_date_hour ON queue_analytics_mv(event_date, event_hour);
CREATE INDEX idx_queue_analytics_mv_updated ON queue_analytics_mv(last_updated);

-- Grant appropriate permissions
GRANT SELECT ON queue_analytics_mv TO PUBLIC;

COMMIT;
