const { pool } = require('./src/config/database');

async function testData() {
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log('Today:', today);
    
    const result = await pool.query('SELECT COUNT(*) as count FROM customers WHERE DATE(created_at) = $1', [today]);
    console.log('Customers today:', result.rows[0]);
    
    const allCustomers = await pool.query('SELECT COUNT(*) as count FROM customers');
    console.log('All customers:', allCustomers.rows[0]);
    
    // Create a test customer for today to populate the analytics
    if (parseInt(result.rows[0].count) === 0) {
      console.log('No customers found for today, creating a test customer...');
      const insertResult = await pool.query(`
        INSERT INTO customers (
          name, contact_number, email, age, address, distribution_info, sales_agent_id,
          prescription, grade_type, lens_type, estimated_time, payment_info, 
          priority_flags, queue_status, token_number, or_number
        ) VALUES (
          'Test Customer', '+1234567890', 'test@example.com', 25, '123 Test St', 
          'pickup', 1, '{}', 'Regular', 'Single Vision', '{}', '{}', 
          '{"senior_citizen": false, "pwd": false, "pregnant": false}', 
          'waiting', 1, 'TEST-' || EXTRACT(EPOCH FROM NOW())::text
        ) RETURNING id
      `);
      console.log('Test customer created with ID:', insertResult.rows[0].id);
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testData();
