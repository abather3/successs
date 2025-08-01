-- Create the missing display_monitor_history table
CREATE TABLE IF NOT EXISTS display_monitor_history (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    daily_customers_served INTEGER DEFAULT 0,
    daily_avg_wait_time NUMERIC(10,2) DEFAULT 0,
    daily_peak_queue_length INTEGER DEFAULT 0,
    daily_priority_customers INTEGER DEFAULT 0,
    operating_efficiency NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_display_monitor_history_date ON display_monitor_history(date);

-- Verify the table creation
\d display_monitor_history;
