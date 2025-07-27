import 'dotenv/config';
import { pool } from '../config/database';
import { readFileSync } from 'fs';
import path from 'path';

async function fixSchema() {
  try {
    console.log('🔧 Fixing database schema for daily queue reset...');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, '../../../fix_queue_reset_schema_v2.sql');
    const sql = readFileSync(sqlFilePath, 'utf8');
    
    // Execute the SQL
    await pool.query(sql);
    
    console.log('✅ Database schema updated successfully!');
    console.log('📋 Added:');
    console.log('  - Missing columns (served_at, carried_forward, reset_at, status, last_reset_at)');
    console.log('  - System user (id: -1)');
    console.log('  - Required tables (daily_reset_log, daily_queue_history, etc.)');
    console.log('  - Fixed foreign key constraints');
    
  } catch (error) {
    console.error('❌ Failed to fix schema:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

fixSchema();
