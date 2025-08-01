-- Populate daily_queue_history with today's data
INSERT INTO daily_queue_history (
    date, 
    total_customers, 
    waiting_customers,
    serving_customers,
    processing_customers,
    completed_customers,
    cancelled_customers,
    priority_customers,
    avg_wait_time_minutes,
    peak_queue_length,
    operating_hours
) VALUES (
    CURRENT_DATE,
    (SELECT COUNT(*) FROM customers WHERE DATE(created_at) = CURRENT_DATE),
    (SELECT COUNT(*) FROM customers WHERE DATE(created_at) = CURRENT_DATE AND queue_status = 'waiting'),
    (SELECT COUNT(*) FROM customers WHERE DATE(created_at) = CURRENT_DATE AND queue_status = 'serving'),
    (SELECT COUNT(*) FROM customers WHERE DATE(created_at) = CURRENT_DATE AND queue_status = 'processing'),
    (SELECT COUNT(*) FROM customers WHERE DATE(created_at) = CURRENT_DATE AND queue_status = 'completed'),
    (SELECT COUNT(*) FROM customers WHERE DATE(created_at) = CURRENT_DATE AND queue_status = 'cancelled'),
    (SELECT COUNT(*) FROM customers WHERE DATE(created_at) = CURRENT_DATE AND (
        (priority_flags::jsonb->>'senior_citizen')::boolean = true OR
        (priority_flags::jsonb->>'pwd')::boolean = true OR
        (priority_flags::jsonb->>'pregnant')::boolean = true
    )),
    5.5, -- Sample average wait time
    9, -- Sample peak queue length
    8.0 -- Sample operating hours
)
ON CONFLICT (date) DO UPDATE SET
    total_customers = EXCLUDED.total_customers,
    waiting_customers = EXCLUDED.waiting_customers,
    serving_customers = EXCLUDED.serving_customers,
    processing_customers = EXCLUDED.processing_customers,
    completed_customers = EXCLUDED.completed_customers,
    cancelled_customers = EXCLUDED.cancelled_customers,
    priority_customers = EXCLUDED.priority_customers,
    updated_at = CURRENT_TIMESTAMP;

-- Populate daily_queue_summary with today's data
INSERT INTO daily_queue_summary (
    date,
    total_customers,
    priority_customers,
    avg_wait_time_minutes,
    avg_service_time_minutes,
    peak_hour,
    peak_queue_length,
    customers_served,
    busiest_counter_id
) VALUES (
    CURRENT_DATE,
    (SELECT COUNT(*) FROM customers WHERE DATE(created_at) = CURRENT_DATE),
    (SELECT COUNT(*) FROM customers WHERE DATE(created_at) = CURRENT_DATE AND (
        (priority_flags::jsonb->>'senior_citizen')::boolean = true OR
        (priority_flags::jsonb->>'pwd')::boolean = true OR
        (priority_flags::jsonb->>'pregnant')::boolean = true
    )),
    5.5, -- Sample average wait time
    3.2, -- Sample average service time
    14, -- Sample peak hour (2 PM)
    9, -- Sample peak queue length
    (SELECT COUNT(*) FROM customers WHERE DATE(created_at) = CURRENT_DATE AND queue_status = 'completed'),
    1 -- Sample busiest counter ID
)
ON CONFLICT (date) DO UPDATE SET
    total_customers = EXCLUDED.total_customers,
    priority_customers = EXCLUDED.priority_customers,
    customers_served = EXCLUDED.customers_served,
    updated_at = CURRENT_TIMESTAMP;

-- Populate display_monitor_history with today's data
INSERT INTO display_monitor_history (
    date,
    daily_customers_served,
    daily_avg_wait_time,
    daily_peak_queue_length,
    daily_priority_customers,
    operating_efficiency
) VALUES (
    CURRENT_DATE,
    (SELECT COUNT(*) FROM customers WHERE DATE(created_at) = CURRENT_DATE AND queue_status = 'completed'),
    5.5, -- Sample average wait time
    9, -- Sample peak queue length
    (SELECT COUNT(*) FROM customers WHERE DATE(created_at) = CURRENT_DATE AND (
        (priority_flags::jsonb->>'senior_citizen')::boolean = true OR
        (priority_flags::jsonb->>'pwd')::boolean = true OR
        (priority_flags::jsonb->>'pregnant')::boolean = true
    )),
    85.5 -- Sample operating efficiency percentage
)
ON CONFLICT (date) DO UPDATE SET
    daily_customers_served = EXCLUDED.daily_customers_served,
    daily_priority_customers = EXCLUDED.daily_priority_customers,
    updated_at = CURRENT_TIMESTAMP;

-- Add some sample data for yesterday to show trends
INSERT INTO daily_queue_history (
    date, 
    total_customers, 
    waiting_customers,
    serving_customers,
    processing_customers,
    completed_customers,
    cancelled_customers,
    priority_customers,
    avg_wait_time_minutes,
    peak_queue_length,
    operating_hours
) VALUES (
    CURRENT_DATE - INTERVAL '1 day',
    12, 0, 0, 0, 10, 2, 3, 4.8, 8, 8.0
)
ON CONFLICT (date) DO NOTHING;

INSERT INTO daily_queue_summary (
    date,
    total_customers,
    priority_customers,
    avg_wait_time_minutes,
    avg_service_time_minutes,
    peak_hour,
    peak_queue_length,
    customers_served,
    busiest_counter_id
) VALUES (
    CURRENT_DATE - INTERVAL '1 day',
    12, 3, 4.8, 3.5, 15, 8, 10, 2
)
ON CONFLICT (date) DO NOTHING;

INSERT INTO display_monitor_history (
    date,
    daily_customers_served,
    daily_avg_wait_time,
    daily_peak_queue_length,
    daily_priority_customers,
    operating_efficiency
) VALUES (
    CURRENT_DATE - INTERVAL '1 day',
    10, 4.8, 8, 3, 83.3
)
ON CONFLICT (date) DO NOTHING;

-- Verify the data was inserted
SELECT 'daily_queue_history' as table_name, COUNT(*) as count FROM daily_queue_history
UNION ALL
SELECT 'daily_queue_summary' as table_name, COUNT(*) as count FROM daily_queue_summary  
UNION ALL
SELECT 'display_monitor_history' as table_name, COUNT(*) as count FROM display_monitor_history;
