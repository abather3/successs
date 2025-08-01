const { Client } = require('pg');

async function fixBalanceCalculation() {
  let client;
  
  try {
    client = new Client({
      host: 'localhost',
      port: 5432,
      database: 'escashop',
      user: 'postgres',
      password: 'postgres'
    });
    
    await client.connect();
    console.log('🔗 Connected to database');
    
    console.log('\n=== ANALYZING BALANCE CALCULATION ISSUE ===');
    
    // Step 1: Check if balance_amount is a generated column
    const schemaResult = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        column_default, 
        generation_expression
      FROM information_schema.columns 
      WHERE table_name = 'transactions' 
      AND column_name IN ('amount', 'paid_amount', 'balance_amount')
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Transaction table schema:');
    schemaResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}${row.generation_expression ? ' (GENERATED)' : ''}`);
    });
    
    // Step 2: Find transactions with incorrect balance calculations
    const problemsResult = await client.query(`
      SELECT 
        t.id, 
        t.or_number, 
        t.amount,
        t.paid_amount,
        t.balance_amount,
        t.payment_status,
        COALESCE((
          SELECT SUM(ps.amount) 
          FROM payment_settlements ps 
          WHERE ps.transaction_id = t.id
        ), 0) as settlements_total,
        (t.amount - t.paid_amount) as expected_balance,
        (t.amount - COALESCE((
          SELECT SUM(ps.amount) 
          FROM payment_settlements ps 
          WHERE ps.transaction_id = t.id
        ), 0)) as correct_balance
      FROM transactions t
      WHERE 
        t.paid_amount != COALESCE((
          SELECT SUM(ps.amount) 
          FROM payment_settlements ps 
          WHERE ps.transaction_id = t.id
        ), 0)
      ORDER BY t.id DESC
      LIMIT 10
    `);
    
    console.log(`\n🔍 Found ${problemsResult.rowCount} transactions with balance issues:`);
    
    if (problemsResult.rowCount > 0) {
      problemsResult.rows.forEach(row => {
        console.log(`\n  Transaction ${row.id} (${row.or_number}):`);
        console.log(`    Amount: ₱${row.amount}`);
        console.log(`    Paid Amount (DB): ₱${row.paid_amount}`);
        console.log(`    Balance Amount (DB): ₱${row.balance_amount}`);
        console.log(`    Settlements Total: ₱${row.settlements_total}`);
        console.log(`    Expected Balance: ₱${row.correct_balance}`);
        console.log(`    Status: ${row.payment_status}`);
        console.log(`    ❌ Paid amount is incorrect by ₱${row.paid_amount - row.settlements_total}`);
      });
      
      // Step 3: Fix the incorrect balances
      console.log('\n🔧 Fixing balance calculations...');
      
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
      
      if (fixResult.rowCount > 0) {
        console.log('\n📊 Updated transactions:');
        fixResult.rows.forEach(row => {
          console.log(`  ${row.or_number}: ₱${row.amount} | Paid: ₱${row.paid_amount} | Balance: ₱${row.balance_amount} | Status: ${row.payment_status}`);
        });
      }
    } else {
      console.log('✅ No balance calculation issues found!');
    }
    
    // Step 4: Verify the fix
    console.log('\n🔎 Verifying all transactions after fix:');
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
    
    const verification = verifyResult.rows[0];
    console.log(`  Total transactions: ${verification.total_transactions}`);
    console.log(`  Correct balances: ${verification.correct_balances}`);
    console.log(`  Correct paid amounts: ${verification.correct_paid_amounts}`);
    
    if (verification.total_transactions == verification.correct_balances && 
        verification.total_transactions == verification.correct_paid_amounts) {
      console.log('🎉 All balance calculations are now correct!');
    } else {
      console.log('⚠️  Some balance calculations may still need attention');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (client) {
      await client.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the fix
fixBalanceCalculation();
