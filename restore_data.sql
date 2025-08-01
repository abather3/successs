-- Insert customers data
INSERT INTO customers 
(id, or_number, name, contact_number, email, age, address, occupation, distribution_info, sales_agent_id, prescription, grade_type, lens_type, frame_code, payment_info, remarks, priority_flags, queue_status, token_number, priority_score, created_at, updated_at, doctor_assigned, estimated_time, served_at, carried_forward, reset_at) 
VALUES 
(12, 'OR027598JXD7EM', 'JP', '09491243800', 'jefor16@gmail.com', 30, 'binmaley', '', 'pickup', 6, '{"od": "11", "os": "11", "ou": "11", "pd": "11", "add": "11"}', 'Process-Progressive (PROC-PROG)', 'non-coated (ORD)', '23213', '{"mode": "gcash", "amount": 1000}', '', '{"pwd": false, "pregnant": false, "senior_citizen": false}', 'completed', 1, 0, '2025-07-09 09:38:07.12856', '2025-07-14 11:28:30.17713', NULL, 100, NULL, false, NULL);

-- Insert transactions data  
INSERT INTO transactions 
(id, customer_id, or_number, amount, payment_mode, sales_agent_id, cashier_id, transaction_date, created_at, paid_amount, payment_status, updated_at) 
VALUES 
(19, 12, 'OR027598JXD7EM', 1000.00, 'gcash', 6, 6, '2025-07-09 09:38:07.12856', '2025-07-09 09:38:07.12856', 1000.00, 'paid', DEFAULT);
