const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'escashop',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432
});

async function checkFor900Balance() {
  console.log('🔍 Checking for ₱1,000.00 transactions with ₱100.00 partial payment (₱900.00 balance)\n');
  
  try {
    // Check for transactions with exactly ₱900.00 balance
    const query = `
      SELECT 
        t.or_number,
        t.amount,
        t.paid_amount,
        t.balance_amount,
        t.payment_status,
        c.name as customer_name
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
WHERE t.amount = 1000.00 AND t.paid_amount = 100.00
      ORDER BY t.created_at DESC
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      console.log('❌ No transactions found with ₱1,000.00 amount and ₱100.00 partial payment');
      
      // Check if any transaction should have ₱900 balance based on settlements
      console.log('\n🔍 Checking for ₱1,000.00 transactions with ₱100.00 in settlements...');
      
      const calculatedQuery = `
        SELECT 
          t.or_number,
          t.amount,
          t.paid_amount,
          t.balance_amount,
          t.payment_status,
          c.name as customer_name,
          COALESCE(SUM(ps.amount), 0) as settlements_total,
          (t.amount - COALESCE(SUM(ps.amount), 0)) as calculated_balance
        FROM transactions t
        LEFT JOIN customers c ON t.customer_id = c.id
        LEFT JOIN payment_settlements ps ON t.id = ps.transaction_id
        GROUP BY t.id, t.or_number, t.amount, t.paid_amount, t.balance_amount, t.payment_status, c.name
HAVING t.amount = 1000.00 AND COALESCE(SUM(ps.amount), 0) = 100.00
        ORDER BY t.created_at DESC
      `;
      
      const calculatedResult = await pool.query(calculatedQuery);
      
      if (calculatedResult.rows.length === 0) {
        console.log('❌ No transactions found that should have ₱900.00 balance based on payments');
      } else {
        console.log(`✅ Found ${calculatedResult.rows.length} transaction(s) that should have ₱900.00 balance:`);
        
        calculatedResult.rows.forEach((tx, index) => {
          console.log(`\n${index + 1}. OR: ${tx.or_number} (${tx.customer_name})`);
          console.log(`   Amount: ₱${tx.amount}`);
          console.log(`   Settlements: ₱${tx.settlements_total}`);
          console.log(`   Should have balance: ₱${tx.calculated_balance}`);
          console.log(`   Actual balance: ₱${tx.balance_amount}`);
          console.log(`   Payment status: ${tx.payment_status}`);
          
          // Check if balance is correctly updated
          if (parseFloat(tx.calculated_balance) === 900.00 && parseFloat(tx.balance_amount) === 900.00) {
            console.log('   ✅ Balance correctly updated to ₱900.00');
          } else if (parseFloat(tx.calculated_balance) === 900.00 && parseFloat(tx.balance_amount) !== 900.00) {
            console.log('   ❌ Balance should be ₱900.00 but is ₱' + tx.balance_amount);
          }
          
          // Check if payment status is correct
          const paidAmount = parseFloat(tx.settlements_total);
          const totalAmount = parseFloat(tx.amount);
          let expectedStatus;
          
          if (paidAmount === 0) {
            expectedStatus = 'unpaid';
          } else if (paidAmount >= totalAmount) {
            expectedStatus = 'paid';
          } else {
            expectedStatus = 'partial';
          }
          
          if (expectedStatus === tx.payment_status) {
            console.log(`   ✅ Payment status correctly set to "${tx.payment_status}"`);
          } else {
            console.log(`   ❌ Payment status should be "${expectedStatus}" but is "${tx.payment_status}"`);
          }
        });
      }
    } else {
      console.log(`✅ Found ${result.rows.length} transaction(s) with ₱1,000.00 amount and ₱100.00 partial payment:`);
      
      result.rows.forEach((tx, index) => {
        console.log(`\n${index + 1}. OR: ${tx.or_number} (${tx.customer_name})`);
        console.log(`   Amount: ₱${tx.amount}`);
        console.log(`   Paid: ₱${tx.paid_amount}`);
        console.log(`   Balance: ₱${tx.balance_amount}`);
        console.log(`   Status: ${tx.payment_status}`);
        
        // Verify payment status
        const paidAmount = parseFloat(tx.paid_amount);
        const totalAmount = parseFloat(tx.amount);
        let expectedStatus;
        
        if (paidAmount === 0) {
          expectedStatus = 'unpaid';
        } else if (paidAmount >= totalAmount) {
          expectedStatus = 'paid';
        } else {
          expectedStatus = 'partial';
        }
        
        if (expectedStatus === tx.payment_status) {
          console.log(`   ✅ Payment status correctly set to "${tx.payment_status}"`);
        } else {
          console.log(`   ❌ Payment status should be "${expectedStatus}" but is "${tx.payment_status}"`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

checkFor900Balance();
