const { pool } = require('./dist/config/database');

async function checkCustomers() {
  try {
    console.log('📊 Checking recent customers in database...');
    
    const query = `
      SELECT 
        id, 
        or_number, 
        name, 
        contact_number, 
        email, 
        age, 
        queue_status, 
        created_at
      FROM customers 
      ORDER BY created_at DESC 
      LIMIT 5;
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      console.log('❌ No customers found in database');
    } else {
      console.log('✅ Found customers in database:');
      console.log('');
      result.rows.forEach((customer, index) => {
        console.log(`${index + 1}. ${customer.name}`);
        console.log(`   ID: ${customer.id}`);
        console.log(`   OR Number: ${customer.or_number}`);
        console.log(`   Contact: ${customer.contact_number}`);
        console.log(`   Email: ${customer.email || 'N/A'}`);
        console.log(`   Age: ${customer.age}`);
        console.log(`   Status: ${customer.queue_status}`);
        console.log(`   Created: ${customer.created_at}`);
        console.log('');
      });
    }
    
    // Also check the total count
    const countQuery = 'SELECT COUNT(*) as total FROM customers';
    const countResult = await pool.query(countQuery);
    console.log(`📈 Total customers in database: ${countResult.rows[0].total}`);
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Error checking customers:', error);
    process.exit(1);
  }
}

checkCustomers();
