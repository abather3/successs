-- Migration: Create Daily Queue History Views
-- Purpose: Analytics views for daily queue history tables
-- Version: 1.0.0
-- Date: 2025-07-21
-- Note: This migration should run after create_daily_queue_history_tables.sql

-- =============================================
-- Create Views for Analytics Integration
-- =============================================

-- Daily Queue Summary View for Analytics Dashboard
CREATE OR REPLACE VIEW daily_queue_summary_view AS
SELECT 
    dqh.date,
    dqh.total_customers,
    dqh.completed_customers as customers_served,
    dqh.avg_wait_time_minutes,
    dqh.peak_queue_length,
    dqh.priority_customers,
    dqh.operating_hours,
    dmh.operating_efficiency,
    dqh.archived_at as summary_date
FROM daily_queue_history dqh
LEFT JOIN display_monitor_history dmh ON dqh.date = dmh.date
ORDER BY dqh.date DESC;

-- Monthly Queue Trends View
CREATE OR REPLACE VIEW monthly_queue_trends AS
SELECT 
    DATE_TRUNC('month', date) as month,
    COUNT(*) as total_days,
    SUM(total_customers) as total_customers,
    SUM(completed_customers) as total_served,
    AVG(avg_wait_time_minutes) as avg_wait_time,
    MAX(peak_queue_length) as max_peak_queue,
    AVG(operating_hours) as avg_operating_hours,
    AVG(NULLIF(operating_efficiency, 0)) as avg_efficiency
FROM daily_queue_summary_view
GROUP BY DATE_TRUNC('month', date)
ORDER BY month DESC;

-- Queue Performance Metrics View
CREATE OR REPLACE VIEW queue_performance_metrics AS
WITH recent_days AS (
    SELECT * FROM daily_queue_history 
    WHERE date >= CURRENT_DATE - INTERVAL '30 days'
),
performance_stats AS (
    SELECT
        AVG(total_customers) as avg_daily_customers,
        AVG(avg_wait_time_minutes) as avg_wait_time,
        AVG(peak_queue_length) as avg_peak_queue,
        AVG(CASE WHEN total_customers > 0 
            THEN (completed_customers::FLOAT / total_customers * 100) 
            ELSE 0 END) as completion_rate,
        STDDEV(total_customers) as customer_variance
    FROM recent_days
)
SELECT 
    ROUND(avg_daily_customers, 1) as avg_daily_customers,
    ROUND(avg_wait_time, 1) as avg_wait_time_minutes,
    ROUND(avg_peak_queue, 1) as avg_peak_queue_length,
    ROUND(completion_rate, 1) as completion_rate_percent,
    ROUND(customer_variance, 1) as customer_volume_variance
FROM performance_stats;

-- =============================================
-- Create Functions for Analytics
-- =============================================

-- Function to get queue history data for charts
CREATE OR REPLACE FUNCTION get_queue_history_chart_data(days_back INTEGER DEFAULT 30)
RETURNS TABLE(
    date DATE,
    total_customers INTEGER,
    completed_customers INTEGER,
    avg_wait_time DECIMAL,
    peak_queue_length INTEGER,
    efficiency_percent INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dqh.date,
        dqh.total_customers,
        dqh.completed_customers,
        dqh.avg_wait_time_minutes,
        dqh.peak_queue_length,
        dmh.operating_efficiency
    FROM daily_queue_history dqh
    LEFT JOIN display_monitor_history dmh ON dqh.date = dmh.date
    WHERE dqh.date >= CURRENT_DATE - INTERVAL '1 day' * days_back
    ORDER BY dqh.date;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate queue performance trends
CREATE OR REPLACE FUNCTION calculate_queue_trends(period_days INTEGER DEFAULT 7)
RETURNS TABLE(
    metric VARCHAR,
    current_value DECIMAL,
    previous_value DECIMAL,
    change_percent DECIMAL,
    trend VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    WITH current_period AS (
        SELECT 
            AVG(total_customers) as avg_customers,
            AVG(avg_wait_time_minutes) as avg_wait,
            AVG(peak_queue_length) as avg_peak
        FROM daily_queue_history
        WHERE date >= CURRENT_DATE - INTERVAL '1 day' * period_days
    ),
    previous_period AS (
        SELECT 
            AVG(total_customers) as avg_customers,
            AVG(avg_wait_time_minutes) as avg_wait,
            AVG(peak_queue_length) as avg_peak
        FROM daily_queue_history
        WHERE date >= CURRENT_DATE - INTERVAL '1 day' * (period_days * 2)
        AND date < CURRENT_DATE - INTERVAL '1 day' * period_days
    )
    SELECT 
        'Average Customers'::VARCHAR,
        ROUND(c.avg_customers, 1),
        ROUND(p.avg_customers, 1),
        CASE WHEN p.avg_customers > 0 
            THEN ROUND(((c.avg_customers - p.avg_customers) / p.avg_customers * 100), 1)
            ELSE 0 END,
        CASE 
            WHEN p.avg_customers = 0 THEN 'No Data'
            WHEN c.avg_customers > p.avg_customers THEN 'Increasing'
            WHEN c.avg_customers < p.avg_customers THEN 'Decreasing'
            ELSE 'Stable'
        END::VARCHAR
    FROM current_period c
    CROSS JOIN previous_period p
    
    UNION ALL
    
    SELECT 
        'Average Wait Time'::VARCHAR,
        ROUND(c.avg_wait, 1),
        ROUND(p.avg_wait, 1),
        CASE WHEN p.avg_wait > 0 
            THEN ROUND(((c.avg_wait - p.avg_wait) / p.avg_wait * 100), 1)
            ELSE 0 END,
        CASE 
            WHEN p.avg_wait = 0 THEN 'No Data'
            WHEN c.avg_wait > p.avg_wait THEN 'Worsening'
            WHEN c.avg_wait < p.avg_wait THEN 'Improving'
            ELSE 'Stable'
        END::VARCHAR
    FROM current_period c
    CROSS JOIN previous_period p;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Migration Complete
-- =============================================

-- Insert migration record
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('20250721_002', 'Create daily queue history views and functions', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;
