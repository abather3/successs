-- Migration to add missing funds column to daily_reports table
-- This ensures backward compatibility with existing tables

-- Add funds column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'daily_reports' AND column_name = 'funds') THEN
        ALTER TABLE daily_reports ADD COLUMN funds JSONB DEFAULT '[]'::jsonb;
        COMMENT ON COLUMN daily_reports.funds IS 'JSON array of fund entries with description and amount';
    END IF;
END $$;

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'daily_reports' AND column_name = 'updated_at') THEN
        ALTER TABLE daily_reports ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        COMMENT ON COLUMN daily_reports.updated_at IS 'Timestamp when the record was last updated';
    END IF;
END $$;

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
