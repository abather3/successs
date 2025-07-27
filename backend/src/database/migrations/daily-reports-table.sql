-- Migration script to create daily_reports table
-- This table stores daily financial reports with transaction summaries

-- Create daily_reports table if it doesn't exist
CREATE TABLE IF NOT EXISTS daily_reports (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    total_cash DECIMAL(10,2) DEFAULT 0.00,
    total_gcash DECIMAL(10,2) DEFAULT 0.00,
    total_maya DECIMAL(10,2) DEFAULT 0.00,
    total_credit_card DECIMAL(10,2) DEFAULT 0.00,
    total_bank_transfer DECIMAL(10,2) DEFAULT 0.00,
    petty_cash_start DECIMAL(10,2) DEFAULT 0.00,
    petty_cash_end DECIMAL(10,2) DEFAULT 0.00,
    expenses JSONB DEFAULT '[]'::jsonb,
    funds JSONB DEFAULT '[]'::jsonb,
    cash_turnover DECIMAL(10,2) DEFAULT 0.00,
    transaction_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_created_at ON daily_reports(created_at);

-- Create an update trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_daily_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop the trigger if it exists and create a new one
DROP TRIGGER IF EXISTS update_daily_reports_updated_at ON daily_reports;
CREATE TRIGGER update_daily_reports_updated_at
    BEFORE UPDATE ON daily_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_reports_updated_at();
