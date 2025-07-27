-- ==========================================
-- Migration 002: Initial Data Seeding
-- ==========================================
-- Purpose: Insert default data required for system operation
-- Author: System Migration
-- Date: 2025-01-26
-- Dependencies: 001_base_schema_setup.sql
-- ==========================================

-- Insert default admin user if not exists
INSERT INTO users (email, full_name, password_hash, role, status)
SELECT 'admin@escashop.com', 'System Administrator', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewmCvjk9VtTHNzLO', 'admin', 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@escashop.com');

-- Insert default grade types
INSERT INTO grade_types (name, description)
SELECT 'No Grade', 'No prescription grade required'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'No Grade');

INSERT INTO grade_types (name, description)
SELECT 'Single Grade (SV)', 'Single vision correction'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Single Grade (SV)');

INSERT INTO grade_types (name, description)
SELECT 'Single Vision-Reading (SV-READING)', 'Single vision for reading'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Single Vision-Reading (SV-READING)');

INSERT INTO grade_types (name, description)
SELECT 'Single Vision Hi-Cylinder (SV-HC)', 'Single vision with high cylinder correction'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Single Vision Hi-Cylinder (SV-HC)');

INSERT INTO grade_types (name, description)
SELECT 'Process Single Vision (PROC-SV)', 'Processed single vision lenses'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Process Single Vision (PROC-SV)');

INSERT INTO grade_types (name, description)
SELECT 'Progressive (PROG)', 'Progressive lenses with gradual power change'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Progressive (PROG)');

INSERT INTO grade_types (name, description)
SELECT 'Process-Progressive (PROC-PROG)', 'Processed progressive lenses'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Process-Progressive (PROC-PROG)');

INSERT INTO grade_types (name, description)
SELECT 'Doble Vista (KK)', 'Double vision correction'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Doble Vista (KK)');

INSERT INTO grade_types (name, description)
SELECT 'Process Doble Vista (PROC-KK)', 'Processed double vision correction'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Process Doble Vista (PROC-KK)');

INSERT INTO grade_types (name, description)
SELECT 'Single Vision-Ultra Thin 1.61 (SV-UTH 1.61)', 'Single vision with ultra-thin 1.61 index'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Single Vision-Ultra Thin 1.61 (SV-UTH 1.61)');

INSERT INTO grade_types (name, description)
SELECT 'Single Vision-Ultra Thin 1.67 (SV-UTH 1.67)', 'Single vision with ultra-thin 1.67 index'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Single Vision-Ultra Thin 1.67 (SV-UTH 1.67)');

INSERT INTO grade_types (name, description)
SELECT 'Flat-Top (F.T)', 'Flat-top bifocal lenses'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Flat-Top (F.T)');

INSERT INTO grade_types (name, description)
SELECT 'Process Flat-Top (Proc-F.T)', 'Processed flat-top bifocal lenses'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Process Flat-Top (Proc-F.T)');

INSERT INTO grade_types (name, description)
SELECT 'Ultra-Thin High Cylinder 1.61 (UTH 1.61 HC)', 'Ultra-thin high cylinder 1.61 index'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Ultra-Thin High Cylinder 1.61 (UTH 1.61 HC)');

INSERT INTO grade_types (name, description)
SELECT 'Ultra-Thin High Cylinder 1.67 (UTH 1.67 HC)', 'Ultra-thin high cylinder 1.67 index'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Ultra-Thin High Cylinder 1.67 (UTH 1.67 HC)');

INSERT INTO grade_types (name, description)
SELECT 'Process High Cylinder Ultra Thin 1.61 (PROC-HC-UTH 1.61)', 'Processed high cylinder ultra-thin 1.61'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Process High Cylinder Ultra Thin 1.61 (PROC-HC-UTH 1.61)');

INSERT INTO grade_types (name, description)
SELECT 'Process High Cylinder Ultra Thin 1.67 (PROC-HC-UTH 1.67)', 'Processed high cylinder ultra-thin 1.67'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'Process High Cylinder Ultra Thin 1.67 (PROC-HC-UTH 1.67)');

INSERT INTO grade_types (name, description)
SELECT 'other', 'Other grade type not listed'
WHERE NOT EXISTS (SELECT 1 FROM grade_types WHERE name = 'other');

-- Insert default lens types
INSERT INTO lens_types (name, description)
SELECT 'non-coated (ORD)', 'Non-coated ordinary lenses'
WHERE NOT EXISTS (SELECT 1 FROM lens_types WHERE name = 'non-coated (ORD)');

INSERT INTO lens_types (name, description)
SELECT 'anti-radiation (MC)', 'Anti-radiation multi-coated lenses'
WHERE NOT EXISTS (SELECT 1 FROM lens_types WHERE name = 'anti-radiation (MC)');

INSERT INTO lens_types (name, description)
SELECT 'photochromic anti-radiation (TRG)', 'Photochromic anti-radiation lenses'
WHERE NOT EXISTS (SELECT 1 FROM lens_types WHERE name = 'photochromic anti-radiation (TRG)');

INSERT INTO lens_types (name, description)
SELECT 'anti-blue light (BB)', 'Anti-blue light lenses'
WHERE NOT EXISTS (SELECT 1 FROM lens_types WHERE name = 'anti-blue light (BB)');

INSERT INTO lens_types (name, description)
SELECT 'photochromic anti-blue light (BTS)', 'Photochromic anti-blue light lenses'
WHERE NOT EXISTS (SELECT 1 FROM lens_types WHERE name = 'photochromic anti-blue light (BTS)');

INSERT INTO lens_types (name, description)
SELECT 'ambermatic tinted (AMB)', 'Ambermatic tinted lenses - specify color'
WHERE NOT EXISTS (SELECT 1 FROM lens_types WHERE name = 'ambermatic tinted (AMB)');

INSERT INTO lens_types (name, description)
SELECT 'essilor', 'Essilor brand lenses'
WHERE NOT EXISTS (SELECT 1 FROM lens_types WHERE name = 'essilor');

INSERT INTO lens_types (name, description)
SELECT 'hoya', 'Hoya brand lenses'
WHERE NOT EXISTS (SELECT 1 FROM lens_types WHERE name = 'hoya');

-- Insert default counters
INSERT INTO counters (name, display_order, is_active)
SELECT 'Counter 1', 1, true
WHERE NOT EXISTS (SELECT 1 FROM counters WHERE name = 'Counter 1');

INSERT INTO counters (name, display_order, is_active)
SELECT 'Counter 2', 2, true
WHERE NOT EXISTS (SELECT 1 FROM counters WHERE name = 'Counter 2');

-- Check and alter missing columns for sms_templates table
DO $$
BEGIN
  DECLARE
    template_col_name TEXT;
    variables_col_name TEXT;
  BEGIN
    -- Check which template column exists (template_content vs template)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_templates' AND column_name = 'template_content') THEN
      template_col_name := 'template_content';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_templates' AND column_name = 'template') THEN
      template_col_name := 'template';
    ELSE
      ALTER TABLE sms_templates ADD COLUMN template TEXT NOT NULL DEFAULT '';
      template_col_name := 'template';
      RAISE NOTICE 'Added `template` column to sms_templates';
    END IF;
    
    -- Check which variables column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_templates' AND column_name = 'variables') THEN
      ALTER TABLE sms_templates ADD COLUMN variables TEXT;
      RAISE NOTICE 'Added `variables` column to sms_templates';
    END IF;
    
    -- Add 'is_active' column if it does not exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_templates' AND column_name = 'is_active') THEN
      ALTER TABLE sms_templates ADD COLUMN is_active BOOLEAN DEFAULT true;
      RAISE NOTICE 'Added `is_active` column to sms_templates';
    END IF;
    
    -- Store the column name for later use
    EXECUTE format('
      INSERT INTO sms_templates (name, %I, variables, is_active)
      SELECT $1, $2, $3::jsonb, $4
      WHERE NOT EXISTS (SELECT 1 FROM sms_templates WHERE name = $1)
    ', template_col_name) 
    USING 'queue_position', 'Hello {{customer_name}}, you are number {{position}} in queue. Estimated wait time: {{estimated_time}} minutes.', '["customer_name", "position", "estimated_time"]', true;
    
    EXECUTE format('
      INSERT INTO sms_templates (name, %I, variables, is_active)
      SELECT $1, $2, $3::jsonb, $4
      WHERE NOT EXISTS (SELECT 1 FROM sms_templates WHERE name = $1)
    ', template_col_name) 
    USING 'ready_to_serve', 'Hello {{customer_name}}, please proceed to {{counter_name}} for your service.', '["customer_name", "counter_name"]', true;
    
    EXECUTE format('
      INSERT INTO sms_templates (name, %I, variables, is_active)
      SELECT $1, $2, $3::jsonb, $4
      WHERE NOT EXISTS (SELECT 1 FROM sms_templates WHERE name = $1)
    ', template_col_name) 
    USING 'appointment_reminder', 'Hello {{customer_name}}, this is a reminder for your appointment tomorrow at {{time}}.', '["customer_name", "time"]', true;
    
    RAISE NOTICE 'SMS templates inserted using column: %', template_col_name;
  END;
END $$;

-- Insert default system settings
INSERT INTO system_settings (key, value, description, category, data_type, is_public)
SELECT 'queue_auto_reset_enabled', 'true', 'Enable automatic queue reset at specified time', 'queue', 'boolean', false
WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE key = 'queue_auto_reset_enabled');

INSERT INTO system_settings (key, value, description, category, data_type, is_public)
SELECT 'queue_reset_time', '07:00', 'Daily queue reset time in HH:MM format', 'queue', 'string', false
WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE key = 'queue_reset_time');

INSERT INTO system_settings (key, value, description, category, data_type, is_public)
SELECT 'sms_notifications_enabled', 'true', 'Enable SMS notifications to customers', 'notifications', 'boolean', false
WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE key = 'sms_notifications_enabled');

INSERT INTO system_settings (key, value, description, category, data_type, is_public)
SELECT 'max_queue_capacity', '100', 'Maximum number of customers allowed in queue', 'queue', 'number', false
WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE key = 'max_queue_capacity');

-- ==========================================
-- MIGRATION COMPLETION
-- ==========================================

INSERT INTO schema_migrations (version, name, checksum, status) 
VALUES ('002', '002_initial_data_seeding.sql', 'b2c3d4e5f6g7', 'completed')
ON CONFLICT (version) DO UPDATE SET 
    status = 'completed',
    applied_at = CURRENT_TIMESTAMP;

-- Log completion
SELECT 'Migration 002: Initial Data Seeding - COMPLETED' as migration_status;
