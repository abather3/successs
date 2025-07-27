const { pool } = require('../dist/config/database');
const { SettingsService } = require('../dist/services/settings');

async function initializeSettings() {
  try {
    console.log('Initializing system settings...');
    
    // Check if system_settings table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'system_settings'
      );
    `);
    
    console.log('System settings table exists:', tableExists.rows[0].exists);
    
    if (!tableExists.rows[0].exists) {
      console.log('Creating system_settings table...');
      await pool.query(`
        CREATE TABLE system_settings (
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
    }
    
    // Initialize default settings
    await SettingsService.initializeDefaultSettings();
    
    // Test session timeout settings
    const settings = await SettingsService.getSessionTimeoutSettings();
    console.log('Session timeout settings:', settings);
    
    console.log('Settings initialization completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Settings initialization failed:', error);
    process.exit(1);
  }
}

initializeSettings();
