import { pool } from './src/config/database';

(async () => {
  try {
    const result = await pool.query('SELECT id, name, or_number, queue_status FROM customers ORDER BY created_at DESC LIMIT 10');
    console.log('Existing customers:', result.rows);
    
    const countResult = await pool.query('SELECT COUNT(*) as total FROM customers');
    console.log('Total customers:', countResult.rows[0].total);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
