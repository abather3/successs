-- Description: Adds crucial indexes to the customers table for performance.
-- Migration version: 013

-- Index for sales_agent_id to speed up filtering by sales agent
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_sales_agent_id ON customers(sales_agent_id);

-- Index for queue_status to speed up filtering by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_queue_status ON customers(queue_status);

-- Index for created_at to speed up sorting by registration date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_created_at ON customers(created_at);

-- Index for or_number for faster lookups
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_or_number ON customers(or_number);

-- A composite index for common filtering combinations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_status_created ON customers(queue_status, created_at);

-- A GIN index for faster full-text search on the customer's name
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_name_gin ON customers USING GIN (to_tsvector('simple', name));

