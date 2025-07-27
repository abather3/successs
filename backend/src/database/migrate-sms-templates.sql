-- Migration script to clean up sms_templates table structure
-- This should be run before the main init.sql to ensure clean state

-- Drop the table completely if it exists to start fresh
DROP TABLE IF EXISTS sms_templates CASCADE;

-- Recreate the table with proper structure
CREATE TABLE sms_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    template_content TEXT NOT NULL,
    variables JSONB, -- JSON array of available variables
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default SMS templates
INSERT INTO sms_templates (name, template_content, variables) VALUES
('ready_to_serve', 'Hi [CustomerName], your order with token #[TokenNumber] at EscaShop Optical is now ready. Please proceed to counter [CounterName].', '["CustomerName", "TokenNumber", "CounterName"]'::JSONB),
('queue_position', 'Hello [CustomerName], you are currently #[QueuePosition] in line. Estimated wait time: [EstimatedWait] minutes. Thank you for your patience!', '["CustomerName", "QueuePosition", "EstimatedWait"]'::JSONB),
('delay_notification', 'Hi [CustomerName], there is a slight delay in processing. Your new estimated wait time is [EstimatedWait] minutes. We apologize for the inconvenience.', '["CustomerName", "EstimatedWait"]'::JSONB),
('customer_ready', 'Hi [CustomerName], your order #[OrderNumber] at EscaShop Optical is ready for pickup! Please visit our store at your convenience.', '["CustomerName", "OrderNumber"]'::JSONB),
('pickup_reminder', 'Dear [CustomerName], this is a friendly reminder that your order #[OrderNumber] is ready for pickup at EscaShop Optical. Please collect it soon.', '["CustomerName", "OrderNumber"]'::JSONB),
('delivery_ready', 'Hi [CustomerName], your order #[OrderNumber] is ready for delivery! Estimated delivery time: [EstimatedDeliveryTime]. Thank you for choosing EscaShop Optical.', '["CustomerName", "OrderNumber", "EstimatedDeliveryTime"]'::JSONB);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sms_templates_name ON sms_templates(name);
CREATE INDEX IF NOT EXISTS idx_sms_templates_is_active ON sms_templates(is_active);
