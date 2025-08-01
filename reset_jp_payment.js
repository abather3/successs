// Reset JP's transaction payment status after fixing the amount
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'escashop',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432
});

async function resetJPPaymentStatus() {
  console.log('🔄 Resetting JP\'s transaction payment status...\n');

  try {
    // Find JP's transaction
    const findQuery = `
      SELECT t.id, t.amount, t.paid_amount, t.payment_status, c.name
      FROM transactions t
      INNER JOIN customers c ON t.customer_id = c.id
      WHERE c.name ILIKE '%JP%'
    `;
    
    const findResult = await pool.query(findQuery);
    
    if (findResult.rows.length === 0) {
      console.log('❌ No JP transaction found');
      return;
    }
    
    const transaction = findResult.rows[0];
    console.log('Found JP transaction:');
    console.log(`  - ID: ${transaction.id}`);
    console.log(`  - Amount: ${transaction.amount}`);
    console.log(`  - Paid Amount: ${transaction.paid_amount}`);
    console.log(`  - Status: ${transaction.payment_status}`);
    
    // Reset to unpaid status with 0 paid amount
    const resetQuery = `
      UPDATE transactions
      SET 
        paid_amount = 0,
        payment_status = 'unpaid',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const resetResult = await pool.query(resetQuery, [transaction.id]);
    const updatedTransaction = resetResult.rows[0];
    
    console.log('\n✅ Successfully reset payment status:');
    console.log(`  - New Paid Amount: ${updatedTransaction.paid_amount}`);
    console.log(`  - New Status: ${updatedTransaction.payment_status}`);
    console.log(`  - Balance: ${updatedTransaction.amount - updatedTransaction.paid_amount}`);
    
    // Also clean up any existing payment settlements for this transaction
    const deleteSettlementsQuery = `
      DELETE FROM payment_settlements 
      WHERE transaction_id = $1
    `;
    
    const deleteResult = await pool.query(deleteSettlementsQuery, [transaction.id]);
    console.log(`\n🧹 Cleaned up ${deleteResult.rowCount} existing payment settlements`);
    
    console.log('\n🎉 JP\'s transaction is now ready for fresh payments!');
    
  } catch (error) {
    console.error('❌ Error resetting payment status:', error);
  } finally {
    await pool.end();
  }
}

resetJPPaymentStatus();
