-- Migration: Add UNIQUE index for preventing duplicate payment settlements
-- Version: 1.0.0
-- Date: 2024-01-XX
-- Description: Prevents duplicate payment settlement rows with proper rollback safety

-- Step 1: Check if index already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_payment_settlements_unique_combo'
    ) THEN
        -- Create the unique index concurrently to avoid blocking
        CREATE UNIQUE INDEX CONCURRENTLY idx_payment_settlements_unique_combo
        ON payment_settlements (
            transaction_id, 
            date_trunc('second', paid_at),  -- Truncate to seconds to avoid microsecond duplicates
            amount, 
            cashier_id
        );
        
        RAISE NOTICE 'Created unique index idx_payment_settlements_unique_combo';
    ELSE
        RAISE NOTICE 'Index idx_payment_settlements_unique_combo already exists, skipping creation';
    END IF;
END
$$;

-- Step 2: Add comment for documentation
COMMENT ON INDEX idx_payment_settlements_unique_combo IS 
'Prevents duplicate payment settlements for the same transaction, amount, cashier and timestamp (truncated to seconds). Created for settlement deduplication feature.';

-- Step 3: Validate the index
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payment_settlements_unique_combo'
    ) THEN
        RAISE NOTICE 'Index validation successful - idx_payment_settlements_unique_combo exists and ready';
    ELSE
        RAISE EXCEPTION 'Index validation failed - idx_payment_settlements_unique_combo does not exist';
    END IF;
END
$$;

-- Rollback script (to be executed separately if needed)
/*
-- ROLLBACK: Drop the unique index
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_payment_settlements_unique_combo'
    ) THEN
        DROP INDEX CONCURRENTLY idx_payment_settlements_unique_combo;
        RAISE NOTICE 'Dropped unique index idx_payment_settlements_unique_combo';
    END IF;
END
$$;
*/
