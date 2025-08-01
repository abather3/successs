-- Test database connection
SELECT version();

-- List existing tables
\dt

-- Create a simple test table if needed
CREATE TABLE IF NOT EXISTS test_connection (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Show all tables
\dt
