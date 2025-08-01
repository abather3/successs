-- Back-fill script for served_at column in customers table
-- Step 3: Handle existing data for served_at

-- For completed customers, use their updated_at timestamp as served_at
-- This is reasonable because updated_at gets set when completeService() is called
UPDATE customers
SET served_at = updated_at
WHERE served_at IS NULL
  AND queue_status = 'completed'
  AND updated_at IS NOT NULL;

-- Optional: For customers that were cancelled, you might want to set served_at too
-- since they technically "finished" their queue experience
-- UPDATE customers
-- SET served_at = updated_at
-- WHERE served_at IS NULL
--   AND queue_status = 'cancelled'
--   AND updated_at IS NOT NULL;

-- Check the results
SELECT 
  queue_status,
  COUNT(*) as total_customers,
  COUNT(served_at) as customers_with_served_at,
  COUNT(*) - COUNT(served_at) as customers_missing_served_at
FROM customers
WHERE queue_status IN ('completed', 'cancelled')
GROUP BY queue_status
ORDER BY queue_status;
