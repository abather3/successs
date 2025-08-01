const { Client } = require('pg');

async function debugBalanceIssue() {
  try {
    const client = new Client({
      host: 'localhost',
      port: 5432,
      database: 'escashop',
      user: 'postgres',
      password: 'postgres123'
    });
    
    await client.connect();
    
    console.log('=== CHECKING BALANCE CALCULATION ISSUE ===');
    
    // Check if balance_amount is a generated column
    const generatedColResult = await client.query(`
      SELECT column_name, generation_expression
      FROM information_schema.columns 
      WHERE table_name = 'transactions' 
      AND column_name = 'balance_amount'
    `);
    
    console.log('Generated column info:', generatedColResult.rows[0]);
    
    // Get recent transactions with detailed payment info
    const transactionResult = await client.query(`
      SELECT 
        t.id, 
        t.or_number, 
        t.amount,
        t.paid_amount,
        t.balance_amount,
        t.payment_status,
        (t.amount - t.paid_amount) as calculated_balance,
        COALESCE((
          SELECT SUM(ps.amount) 
          FROM payment_settlements ps 
          WHERE ps.transaction_id = t.id
        ), 0) as settlements_total
      FROM transactions t
      ORDER BY t.id DESC 
      LIMIT 10
    `);
    
    console.log('\n=== RECENT TRANSACTIONS ===');
    transactionResult.rows.forEach(row => {
      console.log(`Transaction ID: ${row.id}`);
      console.log(`  OR Number: ${row.or_number}`);
      console.log(`  Amount: ${row.amount}`);
      console.log(`  Paid Amount: ${row.paid_amount}`);
      console.log(`  Balance Amount (DB): ${row.balance_amount}`);
      console.log(`  Calculated Balance: ${row.calculated_balance}`);
      console.log(`  Settlements Total: ${row.settlements_total}`);
      console.log(`  Payment Status: ${row.payment_status}`);
      console.log(`  Balance Correct?: ${row.balance_amount == row.calculated_balance ? 'YES' : 'NO'}`);
      console.log(`  Paid Amount Matches Settlements?: ${row.paid_amount == row.settlements_total ? 'YES' : 'NO'}`);
      console.log('---');
    });
    
    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugBalanceIssue();
