require('dotenv').config();
const { Pool } = require('pg');

async function addManualPositionColumn() {
  const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'escashop',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
  });

  try {
    console.log('Adding manual_position column to customers table...');
    
    await pool.query(`
      ALTER TABLE customers 
      ADD COLUMN IF NOT EXISTS manual_position INTEGER;
    `);
    
    console.log('✅ Successfully added manual_position column');
    
    // Verify the column was added
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'customers' AND column_name = 'manual_position';
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Column verified:', result.rows[0]);
    } else {
      console.log('❌ Column not found after creation');
    }
    
  } catch (error) {
    console.error('❌ Error adding column:', error);
  } finally {
    await pool.end();
  }
}

addManualPositionColumn();
