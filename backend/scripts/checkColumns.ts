import { pool } from '../src/config/database';

async function checkCustomerColumns() {
  try {
    console.log('Checking customers table columns...');
    
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customers' 
      AND column_name IN ('served_at', 'manual_position')
      ORDER BY column_name
    `);
    
    const foundColumns = result.rows.map(r => r.column_name);
    console.log('Found columns:', foundColumns);
    
    const requiredColumns = ['served_at', 'manual_position'];
    const missingColumns = requiredColumns.filter(col => !foundColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.log('Missing columns:', missingColumns);
      return false;
    } else {
      console.log('All required columns exist');
      return true;
    }
    
  } catch (error) {
    console.error('Error checking columns:', error);
    return false;
  } finally {
    await pool.end();
  }
}

checkCustomerColumns().catch(console.error);
