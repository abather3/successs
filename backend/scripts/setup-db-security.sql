-- Database Security Setup Script
-- This script creates a least-privilege database user for the application

-- Connect as a superuser (e.g., postgres) to execute these commands

-- Create a dedicated application user with limited privileges
CREATE USER escashop_app WITH PASSWORD 'your_secure_password_here';

-- Create a separate user for read-only operations (analytics, reports)
CREATE USER escashop_readonly WITH PASSWORD 'your_readonly_password_here';

-- Grant minimal necessary permissions to the application user
GRANT CONNECT ON DATABASE escashop TO escashop_app;
GRANT USAGE ON SCHEMA public TO escashop_app;

-- Grant table-level permissions (adjust based on your actual tables)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE customers TO escashop_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users TO escashop_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE transactions TO escashop_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE counters TO escashop_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sms_templates TO escashop_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE daily_reports TO escashop_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE queue_analytics TO escashop_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE system_settings TO escashop_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE activity_logs TO escashop_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notifications TO escashop_app;

-- Grant sequence permissions for auto-incrementing IDs
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO escashop_app;

-- Grant read-only permissions to the readonly user
GRANT CONNECT ON DATABASE escashop TO escashop_readonly;
GRANT USAGE ON SCHEMA public TO escashop_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO escashop_readonly;

-- Configure query logging for security monitoring
-- Add these settings to postgresql.conf:
-- log_statement = 'all'
-- log_min_duration_statement = 0
-- log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
-- log_connections = on
-- log_disconnections = on
-- log_duration = on

-- Create a function to log suspicious queries
CREATE OR REPLACE FUNCTION log_suspicious_query()
RETURNS event_trigger AS $$
BEGIN
    -- Log DDL statements that might be suspicious
    IF tg_tag IN ('DROP', 'ALTER', 'TRUNCATE', 'CREATE') THEN
        INSERT INTO activity_logs (user_id, action, details, created_at)
        VALUES (
            (SELECT id FROM users WHERE email = current_user LIMIT 1),
            'DDL_EXECUTED',
            json_build_object(
                'command', tg_tag,
                'user', current_user,
                'timestamp', now()
            ),
            now()
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create the event trigger
CREATE EVENT TRIGGER suspicious_ddl_trigger
ON ddl_command_end
EXECUTE FUNCTION log_suspicious_query();

-- Revoke dangerous permissions from the application user
REVOKE CREATE ON SCHEMA public FROM escashop_app;
REVOKE ALL ON SCHEMA information_schema FROM escashop_app;
REVOKE ALL ON SCHEMA pg_catalog FROM escashop_app;

-- Create a view for monitoring failed login attempts
CREATE OR REPLACE VIEW failed_login_attempts AS
SELECT 
    details->>'email' as email,
    COUNT(*) as attempt_count,
    MAX(created_at) as last_attempt
FROM activity_logs 
WHERE action = 'LOGIN_FAILED' 
    AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY details->>'email'
HAVING COUNT(*) > 3;

-- Grant access to the monitoring view
GRANT SELECT ON failed_login_attempts TO escashop_readonly;

-- Create a function to check for SQL injection patterns
CREATE OR REPLACE FUNCTION check_sql_injection(query_text TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    suspicious_patterns TEXT[] := ARRAY[
        ';\s*(DROP|DELETE|UPDATE|INSERT|CREATE|ALTER|TRUNCATE)',
        'UNION\s+SELECT',
        '--\s*$',
        '/\*.*\*/',
        '''\s*OR\s*''.*''=',
        '''\s*AND\s*''.*''='
    ];
    pattern TEXT;
BEGIN
    FOREACH pattern IN ARRAY suspicious_patterns
    LOOP
        IF query_text ~* pattern THEN
            RETURN TRUE;
        END IF;
    END LOOP;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Examples of secure parameterized queries:
-- SELECT * FROM users WHERE email = $1 AND password_hash = $2;
-- INSERT INTO customers (name, email, phone) VALUES ($1, $2, $3);
-- UPDATE users SET last_login = $1 WHERE id = $2;
