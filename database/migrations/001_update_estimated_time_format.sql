-- Migration to update estimated_time field to support days and hours
-- This migration converts the existing integer minutes to a JSON format

-- First, add a new column for the JSON format
ALTER TABLE customers ADD COLUMN estimated_time_new JSONB;

-- Update the new column with converted data (convert existing minutes to hours/days)
UPDATE customers SET estimated_time_new = 
    CASE 
        WHEN estimated_time >= 1440 THEN -- 1440 minutes = 1 day
            json_build_object(
                'days', estimated_time / 1440,
                'hours', (estimated_time % 1440) / 60
            )::jsonb
        WHEN estimated_time >= 60 THEN -- 60 minutes = 1 hour
            json_build_object(
                'days', 0,
                'hours', estimated_time / 60
            )::jsonb
        ELSE 
            json_build_object(
                'days', 0,
                'hours', ROUND(estimated_time::numeric / 60, 2)
            )::jsonb
    END;

-- Drop the old column
ALTER TABLE customers DROP COLUMN estimated_time;

-- Rename the new column to the original name
ALTER TABLE customers RENAME COLUMN estimated_time_new TO estimated_time;

-- Update the constraint to ensure the JSON structure is valid
ALTER TABLE customers ADD CONSTRAINT check_estimated_time_format 
    CHECK (
        estimated_time ? 'days' AND 
        estimated_time ? 'hours' AND 
        (estimated_time->>'days')::numeric >= 0 AND 
        (estimated_time->>'hours')::numeric >= 0 AND
        (estimated_time->>'hours')::numeric < 24
    );

-- Add a comment to document the new format
COMMENT ON COLUMN customers.estimated_time IS 'Estimated time in JSON format: {"days": number, "hours": number}';
