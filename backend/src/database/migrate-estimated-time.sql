-- Migration to change estimated_time column from integer to jsonb
-- This migration handles the conversion of existing integer values to EstimatedTime objects

-- First, let's check if the customers table exists and has the estimated_time column
DO $$
BEGIN
    -- Check if customers table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
        -- Check if estimated_time column exists and is of integer type
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'customers' 
            AND column_name = 'estimated_time' 
            AND data_type = 'integer'
        ) THEN
            -- Step 1: Add a temporary column for the new jsonb data
            ALTER TABLE customers ADD COLUMN estimated_time_temp jsonb;
            
            -- Step 2: Convert existing integer values to EstimatedTime objects
            -- Assuming existing values are in minutes, convert to {days: 0, hours: 0, minutes: value}
            UPDATE customers 
            SET estimated_time_temp = json_build_object(
                'days', FLOOR(estimated_time / (24 * 60)),
                'hours', FLOOR((estimated_time % (24 * 60)) / 60),
                'minutes', estimated_time % 60
            )
            WHERE estimated_time IS NOT NULL;
            
            -- Step 3: Drop the old integer column
            ALTER TABLE customers DROP COLUMN estimated_time;
            
            -- Step 4: Rename the temporary column to the original name
            ALTER TABLE customers RENAME COLUMN estimated_time_temp TO estimated_time;
            
            RAISE NOTICE 'Successfully migrated estimated_time column from integer to jsonb';
        ELSIF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'customers' 
            AND column_name = 'estimated_time'
        ) THEN
            -- Column exists but is not integer type, check if it's already jsonb
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'customers' 
                AND column_name = 'estimated_time' 
                AND data_type = 'jsonb'
            ) THEN
                RAISE NOTICE 'estimated_time column is already jsonb type, no migration needed';
            ELSE
                -- Column exists but is neither integer nor jsonb, try to convert it
                RAISE NOTICE 'estimated_time column exists but is not integer or jsonb type, attempting conversion';
                ALTER TABLE customers ALTER COLUMN estimated_time SET DATA TYPE jsonb USING estimated_time::jsonb;
            END IF;
        ELSE
            -- Column doesn't exist, create it as jsonb
            ALTER TABLE customers ADD COLUMN estimated_time jsonb;
            RAISE NOTICE 'Added estimated_time column as jsonb type';
        END IF;
    ELSE
        RAISE NOTICE 'customers table does not exist, skipping migration';
    END IF;
END $$;

-- Create an index on estimated_time for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_estimated_time ON customers USING GIN (estimated_time);

-- Update any existing NULL values with default EstimatedTime object
UPDATE customers 
SET estimated_time = json_build_object('days', 0, 'hours', 0, 'minutes', 0)
WHERE estimated_time IS NULL;
