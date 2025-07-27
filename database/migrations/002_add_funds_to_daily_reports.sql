-- Add funds field to daily_reports table
ALTER TABLE daily_reports ADD COLUMN funds JSONB DEFAULT '[]'::jsonb;
