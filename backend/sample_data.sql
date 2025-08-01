INSERT INTO customer_history (original_customer_id, name, email, phone, queue_status, token_number, priority_flags, created_at, served_at, archive_date, estimated_wait_time, counter_id, archived_at) VALUES 
(1, 'John Doe', 'john@example.com', '1234567890', 'completed', 1, '{"type": "normal"}', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', CURRENT_DATE, 15, 1, NOW()),
(2, 'Jane Smith', 'jane@example.com', '0987654321', 'cancelled', 2, '{"type": "priority"}', NOW() - INTERVAL '3 hours', NULL, CURRENT_DATE, 25, NULL, NOW()),
(3, 'Bob Wilson', 'bob@example.com', '5555555555', 'completed', 3, '{"type": "normal"}', NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours', CURRENT_DATE - 1, 12, 2, NOW());
