import { pool } from '../../config/database';

export async function runSystemSettingsMigration(): Promise<void> {
  try {
    console.log('Running system settings migration...');
    
    // Create system_settings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) NOT NULL UNIQUE,
        value TEXT NOT NULL,
        description TEXT,
        category VARCHAR(100) NOT NULL,
        data_type VARCHAR(20) NOT NULL CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
        is_public BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_system_settings_is_public ON system_settings(is_public)
    `);

    // Create trigger to update updated_at timestamp
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
      CREATE TRIGGER update_system_settings_updated_at
        BEFORE UPDATE ON system_settings
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('System settings migration completed successfully');
  } catch (error) {
    console.error('System settings migration failed:', error);
    throw error;
  }
}
