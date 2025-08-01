const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'escashop',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432
});

async function fixJPBalance() {
  console.log('🔧 Fixing JP Transaction Balance Using Proper Payment Status Update\n');
  
  try {
    // Get JP transaction details
    const jpQuery = `
      SELECT 
        t.id,
        t.or_number,
        t.amount,
        t.paid_amount,
        t.balance_amount,
        t.payment_status,
        c.name as customer_name
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      WHERE t.or_number = 'BUG-TEST-002'
    `;
    
    const jpResult = await pool.query(jpQuery);
    
    if (jpResult.rows.length === 0) {
      console.log('❌ JP Transaction (BUG-TEST-002) not found');
      return;
    }
    
    const jp = jpResult.rows[0];
    console.log('✅ JP Transaction Found:');
    console.log(`   OR Number: ${jp.or_number}`);
    console.log(`   Customer: ${jp.customer_name}`);
    console.log(`   Amount: ₱${jp.amount}`);
    console.log(`   Paid: ₱${jp.paid_amount}`);
    console.log(`   Balance: ₱${jp.balance_amount}`);
    console.log(`   Status: ${jp.payment_status}`);
    
    // Check settlements for this transaction
    const settlementsQuery = `
      SELECT 
        ps.id,
        ps.amount,
        ps.payment_mode,
        ps.paid_at
      FROM payment_settlements ps
      WHERE ps.transaction_id = $1
      ORDER BY ps.paid_at ASC
    `;
    
    const settlementsResult = await pool.query(settlementsQuery, [jp.id]);
    
    console.log(`\n💰 Found ${settlementsResult.rows.length} settlement(s):`);
    let totalSettlements = 0;
    
    settlementsResult.rows.forEach((settlement, index) => {
      console.log(`  ${index + 1}. Amount: ₱${settlement.amount}, Mode: ${settlement.payment_mode}, Date: ${settlement.paid_at}`);
      totalSettlements += parseFloat(settlement.amount);
    });
    
    console.log(`\n📊 Settlement Summary:`);
    console.log(`   Total Settlements: ₱${totalSettlements.toFixed(2)}`);
    console.log(`   Expected Balance: ₱${(parseFloat(jp.amount) - totalSettlements).toFixed(2)}`);
    console.log(`   Current Balance: ₱${jp.balance_amount}`);
    
    // Now use the proper updatePaymentStatus method
    console.log('\n🔧 Running updatePaymentStatus to fix balance calculation...');
    
    const updateQuery = `
      UPDATE transactions
      SET paid_amount = COALESCE((
        SELECT SUM(amount)
        FROM payment_settlements
        WHERE transaction_id = $1
      ), 0),
      payment_status = CASE
        WHEN COALESCE((
          SELECT SUM(amount)
          FROM payment_settlements
          WHERE transaction_id = $1
        ), 0) = 0 THEN 'unpaid'
        WHEN COALESCE((
          SELECT SUM(amount)
          FROM payment_settlements
          WHERE transaction_id = $1
        ), 0) >= amount THEN 'paid'
        ELSE 'partial'
      END
      WHERE id = $1
      RETURNING *
    `;
    
    const updateResult = await pool.query(updateQuery, [jp.id]);
    const updated = updateResult.rows[0];
    
    console.log('✅ Transaction updated:');
    console.log(`   Paid Amount: ₱${updated.paid_amount}`);
    console.log(`   Balance Amount: ₱${updated.balance_amount}`);
    console.log(`   Payment Status: ${updated.payment_status}`);
    
    // Verify the calculation
    const expectedBalance = parseFloat(updated.amount) - parseFloat(updated.paid_amount);
    const actualBalance = parseFloat(updated.balance_amount);
    
    if (Math.abs(expectedBalance - actualBalance) <= 0.01 && parseFloat(updated.paid_amount) === 100.00) {
      console.log('\n🎉 SUCCESS! Transaction now has:');
      console.log(`   ✅ Balance correctly calculated: ₱${updated.balance_amount} (should be ₱${expectedBalance.toFixed(2)})`);
      console.log(`   ✅ Paid amount: ₱${updated.paid_amount} (₱100.00 partial payment)`);
      console.log(`   ✅ Payment status correctly set to "${updated.payment_status}"`);
      
      if (parseFloat(updated.balance_amount) === 900.00) {
        console.log('\n✨ PERFECT! The balance is exactly ₱900.00 as expected!');
      }
    } else {
      console.log('\n❌ Something is still not right:');
      console.log(`   Expected Balance: ₱${expectedBalance.toFixed(2)}`);
      console.log(`   Actual Balance: ₱${updated.balance_amount}`);
      console.log(`   Expected Status: ${totalSettlements > 0 && totalSettlements < parseFloat(updated.amount) ? 'partial' : (totalSettlements === 0 ? 'unpaid' : 'paid')}`);
      console.log(`   Actual Status: ${updated.payment_status}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

fixJPBalance();
