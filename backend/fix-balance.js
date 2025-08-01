const { pool } = require('./src/config/database');

async function fixBalanceCalculations() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Starting balance calculation fix...');
    
    // First, check current state
    const checkResult = await client.query(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN paid_amount != COALESCE((
          SELECT SUM(ps.amount) 
          FROM payment_settlements ps 
          WHERE ps.transaction_id = transactions.id
        ), 0) THEN 1 END) as incorrect_paid_amounts
      FROM transactions
    `);
    
    console.log(`📊 Found ${checkResult.rows[0].incorrect_paid_amounts} transactions with incorrect paid amounts out of ${checkResult.rows[0].total_transactions} total`);
    
    if (checkResult.rows[0].incorrect_paid_amounts > 0) {
      // Fix the paid amounts and payment statuses
      const fixResult = await client.query(`
        UPDATE transactions 
        SET 
          paid_amount = COALESCE((
            SELECT SUM(amount) 
            FROM payment_settlements 
            WHERE transaction_id = transactions.id
          ), 0),
          payment_status = CASE 
            WHEN COALESCE((
              SELECT SUM(amount) 
              FROM payment_settlements 
              WHERE transaction_id = transactions.id
            ), 0) = 0 THEN 'unpaid'
            WHEN COALESCE((
              SELECT SUM(amount) 
              FROM payment_settlements 
              WHERE transaction_id = transactions.id
            ), 0) >= amount THEN 'paid'
            ELSE 'partial'
          END
        WHERE 
          paid_amount != COALESCE((
            SELECT SUM(amount) 
            FROM payment_settlements 
            WHERE transaction_id = transactions.id
          ), 0)
        RETURNING id, or_number, amount, paid_amount, balance_amount, payment_status
      `);
      
      console.log(`✅ Fixed ${fixResult.rowCount} transactions`);
      
      // Show examples of fixed transactions
      if (fixResult.rows.length > 0) {
        console.log('📝 Sample of fixed transactions:');
        fixResult.rows.slice(0, 5).forEach(row => {
          console.log(`  ${row.or_number}: Amount=₱${row.amount}, Paid=₱${row.paid_amount}, Balance=₱${row.balance_amount}, Status=${row.payment_status}`);
        });
      }
    } else {
      console.log('✅ All transactions already have correct balance calculations');
    }
    
    // Verify the fix
    const verifyResult = await client.query(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN balance_amount = (amount - paid_amount) THEN 1 END) as correct_balances,
        COUNT(CASE WHEN paid_amount = COALESCE((
          SELECT SUM(ps.amount) 
          FROM payment_settlements ps 
          WHERE ps.transaction_id = transactions.id
        ), 0) THEN 1 END) as correct_paid_amounts
      FROM transactions
    `);
    
    console.log('🔎 Verification results:');
    console.log(`  Total transactions: ${verifyResult.rows[0].total_transactions}`);
    console.log(`  Correct balances: ${verifyResult.rows[0].correct_balances}`);
    console.log(`  Correct paid amounts: ${verifyResult.rows[0].correct_paid_amounts}`);
    
    if (verifyResult.rows[0].total_transactions == verifyResult.rows[0].correct_balances && 
        verifyResult.rows[0].total_transactions == verifyResult.rows[0].correct_paid_amounts) {
      console.log('🎉 All balance calculations are now correct!');
    } else {
      console.log('⚠️ Some balance calculations may still need attention');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
  }
}

// Run the fix
fixBalanceCalculations().then(() => {
  console.log('✨ Balance fix completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fix failed:', error);
  process.exit(1);
});
