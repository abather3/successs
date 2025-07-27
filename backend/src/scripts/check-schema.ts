import 'dotenv/config';
import { pool } from '../config/database';

async function checkSchema() {
  try {
    console.log('📊 Checking customers table schema...');
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'customers'
      ORDER BY ordinal_position
    `);
    
    console.log('Customers table columns:');
    console.table(result.rows);
    
    console.log('\n📊 Checking customer_history table schema...');
    
    const historyResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'customer_history'
      ORDER BY ordinal_position
    `);
    
    console.log('Customer_history table columns:');
    console.table(historyResult.rows);
    
  } catch (error) {
    console.error('❌ Failed to check schema:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkSchema();
