const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/escashop',
});

async function checkAndSetupData() {
  try {
    console.log('🔍 Checking existing data...');
    
    // Check users
    const usersResult = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`👥 Users in database: ${usersResult.rows[0].count}`);
    
    // Check customers
    const customersResult = await pool.query('SELECT COUNT(*) as count FROM customers');
    console.log(`👤 Customers in database: ${customersResult.rows[0].count}`);
    
    // Check transactions
    const transactionsResult = await pool.query('SELECT COUNT(*) as count FROM transactions');
    console.log(`💰 Transactions in database: ${transactionsResult.rows[0].count}`);
    
    // If no customers exist, create a basic one
    if (customersResult.rows[0].count == 0) {
      console.log('📝 Creating basic test customer...');
      await pool.query(`
        INSERT INTO customers (
          or_number, name, contact_number, email, age, address,
          grade_type, lens_type, distribution_info, sales_agent_id,
          prescription, payment_info, priority_flags, queue_status, token_number
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        'TEST-CUSTOMER-001', 'Test Customer', '+1234567890', 'test@example.com',
        30, '123 Test Street', 'Single Vision', 'CR-39', 'pickup', 1,
        '{}', '{"mode":"cash","amount":0}', '{"senior_citizen":false,"pregnant":false,"pwd":false}',
        'completed', 1
      ]);
      console.log('✅ Test customer created');
    }
    
    // List existing users
    const usersList = await pool.query('SELECT id, email, full_name, role FROM users LIMIT 5');
    console.log('\n👥 Existing users:');
    usersList.rows.forEach(user => {
      console.log(`  - ID: ${user.id}, Email: ${user.email}, Name: ${user.full_name}, Role: ${user.role}`);
    });
    
    // List existing customers
    const customersList = await pool.query('SELECT id, or_number, name FROM customers LIMIT 5');
    console.log('\n👤 Existing customers:');
    customersList.rows.forEach(customer => {
      console.log(`  - ID: ${customer.id}, OR: ${customer.or_number}, Name: ${customer.name}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkAndSetupData();
