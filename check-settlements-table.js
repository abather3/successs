const { pool } = require('./dist/config/database');

(async () => {
  try {
    console.log('Checking payment_settlements table structure...');
    
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'payment_settlements' 
      ORDER BY ordinal_position
    `);
    
    console.log('payment_settlements table columns:');
    console.log('=====================================');
    result.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type}`);
    });
    
    // Also check if the table has any data
    const countResult = await pool.query('SELECT COUNT(*) as count FROM payment_settlements');
    console.log(`\nTable contains ${countResult.rows[0].count} records`);
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
