const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/escashop',
});

async function fixExistingTransactions() {
  try {
    console.log('🔧 Fixing existing transactions that were incorrectly marked as paid...');
    
    // First, let's check the current state
    const countResult = await pool.query(`
      SELECT 
        payment_status,
        COUNT(*) as count,
        SUM(amount) as total_amount,
        SUM(paid_amount) as total_paid
      FROM transactions 
      GROUP BY payment_status
      ORDER BY payment_status
    `);
    
    console.log('\n📊 Current transaction status breakdown:');
    countResult.rows.forEach(row => {
      console.log(`- ${row.payment_status}: ${row.count} transactions, $${row.total_amount} amount, $${row.total_paid} paid`);
    });
    
    // Check for transactions that have settlements vs those that don't
    const settlementCheck = await pool.query(`
      SELECT 
        t.id,
        t.or_number,
        t.amount,
        t.paid_amount,
        t.payment_status,
        COALESCE(SUM(ps.amount), 0) as actual_settlements
      FROM transactions t
      LEFT JOIN payment_settlements ps ON t.id = ps.transaction_id
      GROUP BY t.id, t.or_number, t.amount, t.paid_amount, t.payment_status
      HAVING t.paid_amount != COALESCE(SUM(ps.amount), 0)
      ORDER BY t.id
    `);
    
    console.log(`\n🔍 Found ${settlementCheck.rows.length} transactions with mismatched payment amounts:`);
    settlementCheck.rows.forEach(row => {
      console.log(`- TX ${row.id} (${row.or_number}): Amount=$${row.amount}, Recorded Paid=$${row.paid_amount}, Actual Settlements=$${row.actual_settlements}, Status=${row.payment_status}`);
    });
    
    // Option 1: Reset transactions without any payment settlements to unpaid
    console.log('\n🔄 Resetting transactions without payment settlements to unpaid status...');
    const resetResult = await pool.query(`
      UPDATE transactions 
      SET paid_amount = 0, payment_status = 'unpaid'
      WHERE id NOT IN (
        SELECT DISTINCT transaction_id 
        FROM payment_settlements 
        WHERE transaction_id IS NOT NULL
      )
      AND payment_status = 'paid'
      AND or_number NOT LIKE 'BUG-TEST-%'
    `);
    
    console.log(`✅ Reset ${resetResult.rowCount} transactions to unpaid status`);
    
    // Option 2: Fix transactions with payment settlements to match actual paid amounts
    console.log('\n🔄 Updating paid amounts to match actual payment settlements...');
    const updateResult = await pool.query(`
      UPDATE transactions
      SET paid_amount = COALESCE((
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
        ), 0) >= transactions.amount THEN 'paid'
        ELSE 'partial'
      END
      WHERE id IN (
        SELECT DISTINCT transaction_id 
        FROM payment_settlements 
        WHERE transaction_id IS NOT NULL
      )
    `);
    
    console.log(`✅ Updated ${updateResult.rowCount} transactions to match their payment settlements`);
    
    // Final status check
    const finalCountResult = await pool.query(`
      SELECT 
        payment_status,
        COUNT(*) as count,
        SUM(amount) as total_amount,
        SUM(paid_amount) as total_paid
      FROM transactions 
      GROUP BY payment_status
      ORDER BY payment_status
    `);
    
    console.log('\n📊 Final transaction status breakdown:');
    finalCountResult.rows.forEach(row => {
      console.log(`- ${row.payment_status}: ${row.count} transactions, $${row.total_amount} amount, $${row.total_paid} paid`);
    });
    
    console.log('\n✅ Transaction fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing transactions:', error);
  } finally {
    await pool.end();
  }
}

fixExistingTransactions();
