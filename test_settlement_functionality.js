const { Pool } = require('pg');

// Database configuration for Docker environment
const pool = new Pool({
  user: 'postgres',
  host: 'postgres',
  database: 'escashop',
  password: 'postgres_secure_password_123',
  port: 5432,
});

async function testSettlementFunctionality() {
  console.log('🧪 Testing Settlement Functionality (Complete)...\n');
  
  const timestamp = Date.now();
  
  try {
    // Test 1: Create a new transaction
    console.log('1. Creating a new test transaction...');
    const customerResult = await pool.query(`
      INSERT INTO customers (
        name, contact_number, age, address, distribution_info, 
        or_number, token_number, estimated_time,
        grade_type, lens_type, frame_code,
        prescription, payment_info, priority_flags,
        queue_status, sales_agent_id, created_at
      ) VALUES (
        'Settlement Test Customer', '09123456789', 30, 'Test Address', 'pickup',
        $1, 2001, '{"minutes": 30}',
        'single_vision', 'progressive', 'FRAME001',
        '{"od": "-1.00", "os": "-1.25", "ou": "", "pd": "63", "add": ""}',
        '{"mode": "cash", "amount": 1500}',
        '{"senior_citizen": false, "pregnant": false, "pwd": false}',
        'registered', 1, NOW()
      ) RETURNING id, name, or_number
    `, [`OR-SETTLEMENT-TEST-${timestamp}`]);
    
    const customer = customerResult.rows[0];
    console.log(`   ✅ Created customer: ${customer.name} (${customer.or_number})`);
    
    const transactionResult = await pool.query(`
      INSERT INTO transactions (
        customer_id, or_number, amount, payment_mode, payment_status, paid_amount, 
        balance_amount, sales_agent_id, created_at
      ) VALUES (
        $1, $2, 1500, 'cash', 'unpaid', 0, 1500, 1, NOW()
      ) RETURNING id, amount, payment_status, paid_amount, balance_amount
    `, [customer.id, customer.or_number]);
    
    const transaction = transactionResult.rows[0];
    console.log(`   ✅ Created transaction ID ${transaction.id}: ₱${transaction.amount}, Status: ${transaction.payment_status}, Balance: ₱${transaction.balance_amount}`);
    
    // Test 2: Add first partial payment
    console.log('\n2. Adding first partial payment of ₱500...');
    await pool.query(`
      INSERT INTO payment_settlements (
        transaction_id, amount, payment_mode, cashier_id, settlement_date, created_at
      ) VALUES (
        $1, 500, 'cash', 1, NOW(), NOW()
      )
    `, [transaction.id]);
    
    // Check if trigger updated transaction correctly
    const afterFirstPayment = await pool.query(`
      SELECT * FROM transactions WHERE id = $1
    `, [transaction.id]);
    
    const firstPaymentResult = afterFirstPayment.rows[0];
    console.log(`   ✅ After ₱500 payment: Paid=₱${firstPaymentResult.paid_amount}, Balance=₱${firstPaymentResult.balance_amount}, Status=${firstPaymentResult.payment_status}`);
    
    // Test 3: Add second partial payment
    console.log('\n3. Adding second partial payment of ₱600...');
    await pool.query(`
      INSERT INTO payment_settlements (
        transaction_id, amount, payment_mode, cashier_id, settlement_date, created_at
      ) VALUES (
        $1, 600, 'gcash', 1, NOW(), NOW()
      )
    `, [transaction.id]);
    
    const afterSecondPayment = await pool.query(`
      SELECT * FROM transactions WHERE id = $1
    `, [transaction.id]);
    
    const secondPaymentResult = afterSecondPayment.rows[0];
    console.log(`   ✅ After ₱600 payment: Paid=₱${secondPaymentResult.paid_amount}, Balance=₱${secondPaymentResult.balance_amount}, Status=${secondPaymentResult.payment_status}`);
    
    // Test 4: Add final payment to complete
    console.log('\n4. Adding final payment of ₱400 to complete transaction...');
    await pool.query(`
      INSERT INTO payment_settlements (
        transaction_id, amount, payment_mode, cashier_id, settlement_date, created_at
      ) VALUES (
        $1, 400, 'maya', 1, NOW(), NOW()
      )
    `, [transaction.id]);
    
    const afterFinalPayment = await pool.query(`
      SELECT * FROM transactions WHERE id = $1
    `, [transaction.id]);
    
    const finalPaymentResult = afterFinalPayment.rows[0];
    console.log(`   ✅ After ₱400 payment: Paid=₱${finalPaymentResult.paid_amount}, Balance=₱${finalPaymentResult.balance_amount}, Status=${finalPaymentResult.payment_status}`);
    
    // Test 5: Verify settlement history
    console.log('\n5. Verifying settlement history...');
    const settlementHistory = await pool.query(`
      SELECT 
        ps.*,
        u.full_name as cashier_name
      FROM payment_settlements ps
      LEFT JOIN users u ON ps.cashier_id = u.id
      WHERE ps.transaction_id = $1
      ORDER BY ps.settlement_date DESC
    `, [transaction.id]);
    
    console.log(`   ✅ Found ${settlementHistory.rows.length} settlements:`);
    settlementHistory.rows.forEach((settlement, index) => {
      console.log(`      ${index + 1}. ₱${settlement.amount} via ${settlement.payment_mode} on ${settlement.settlement_date.toISOString().split('T')[0]}`);
    });
    
    // Test 6: Summary and validation
    console.log('\n6. Final validation...');
    const totalSettlements = settlementHistory.rows.reduce((sum, s) => sum + parseFloat(s.amount), 0);
    const expectedBalance = 1500 - totalSettlements;
    
    console.log(`   📊 Transaction amount: ₱1,500`);
    console.log(`   💰 Total settlements: ₱${totalSettlements}`);
    console.log(`   🔢 Expected balance: ₱${expectedBalance}`);
    console.log(`   ✅ Actual balance: ₱${finalPaymentResult.balance_amount}`);
    console.log(`   ✅ Payment status: ${finalPaymentResult.payment_status}`);
    
    // Validation checks
    const isBalanceCorrect = Math.abs(parseFloat(finalPaymentResult.balance_amount) - expectedBalance) < 0.01;
    const isStatusCorrect = expectedBalance === 0 ? finalPaymentResult.payment_status === 'paid' : 
                           expectedBalance > 0 ? finalPaymentResult.payment_status === 'partial' : 
                           finalPaymentResult.payment_status === 'paid'; // overpaid
    
    if (isBalanceCorrect && isStatusCorrect) {
      console.log('\n🎉 ALL TESTS PASSED! Settlement functionality is working correctly.');
    } else {
      console.log('\n❌ TESTS FAILED! Issues detected:');
      if (!isBalanceCorrect) console.log(`   - Balance calculation is incorrect`);
      if (!isStatusCorrect) console.log(`   - Payment status is incorrect`);
    }
    
  } catch (error) {
    console.error('❌ Error during settlement functionality test:', error.message);
    console.error('   Full error:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testSettlementFunctionality().catch(console.error);
