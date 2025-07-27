const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/escashop',
});

async function cleanupBugTestTransactions() {
  try {
    console.log('🧹 Cleaning up BUG-TEST transactions...');
    
    // Delete payment settlements first (foreign key constraint)
    const settlementsResult = await pool.query(`
      DELETE FROM payment_settlements 
      WHERE transaction_id IN (
        SELECT id FROM transactions WHERE or_number LIKE 'BUG-TEST-%'
      )
    `);
    
    console.log(`🗑️  Deleted ${settlementsResult.rowCount} payment settlements`);
    
    // Delete the transactions
    const transactionsResult = await pool.query(`
      DELETE FROM transactions WHERE or_number LIKE 'BUG-TEST-%'
    `);
    
    console.log(`🗑️  Deleted ${transactionsResult.rowCount} BUG-TEST transactions`);
    
    // Also clean up any other test transactions
    const otherTestResult = await pool.query(`
      DELETE FROM transactions WHERE or_number LIKE 'TEST-%'
    `);
    
    console.log(`🗑️  Deleted ${otherTestResult.rowCount} other TEST transactions`);
    
    console.log('✅ Cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await pool.end();
  }
}

cleanupBugTestTransactions();
