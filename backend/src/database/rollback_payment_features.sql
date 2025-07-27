-- Rollback script for removing payment tracking features

-- Drop payment_settlements table first (due to foreign key dependency)
DROP TABLE IF EXISTS payment_settlements;

-- Remove added columns from transactions
ALTER TABLE transactions
DROP COLUMN IF EXISTS paid_amount,
DROP COLUMN IF EXISTS balance_amount,
DROP COLUMN IF EXISTS payment_status;
