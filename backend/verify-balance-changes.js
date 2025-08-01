const { Pool } = require('pg');

// Database configuration for Docker environment
const pool = new Pool({
  user: 'escashop_user',
  host: 'postgres',
  database: 'escashop_prod',
  password: 'postgres_secure_password_123',
  port: 5432,
});

async function verifyBalanceChanges() {
  console.log('🔍 Verifying Balance Calculation Changes...\n');
  
  try {
    // 1. Check if payment settlements table exists and has data
    console.log('1. Checking payment settlements...');
    const settlementsResult = await pool.query(`
      SELECT COUNT(*) as count, 
             SUM(amount) as total_amount
      FROM payment_settlements
    `);
    console.log(`   Payment settlements: ${settlementsResult.rows[0].count} records, Total: ₱${settlementsResult.rows[0].total_amount || 0}`);
    
    // 2. Check transaction balance consistency
    console.log('\n2. Checking transaction balance consistency...');
    const balanceCheckQuery = `
      SELECT 
        t.id,
        t.or_number,
        t.amount as transaction_amount,
        t.paid_amount,
        t.balance_amount,
        t.payment_status,
        COALESCE(SUM(ps.amount), 0) as actual_settlements
      FROM transactions t
      LEFT JOIN payment_settlements ps ON t.id = ps.transaction_id
      GROUP BY t.id, t.or_number, t.amount, t.paid_amount, t.balance_amount, t.payment_status
      HAVING t.paid_amount != COALESCE(SUM(ps.amount), 0)
      LIMIT 10
    `;
    
    const inconsistentResult = await pool.query(balanceCheckQuery);
    
    if (inconsistentResult.rows.length === 0) {
      console.log('   ✅ All transaction balances are consistent with settlements!');
    } else {
      console.log(`   ⚠️  Found ${inconsistentResult.rows.length} inconsistent transactions:`);
      inconsistentResult.rows.forEach(row => {
        console.log(`      OR ${row.or_number}: Paid=${row.paid_amount}, Settlements=${row.actual_settlements}, Status=${row.payment_status}`);
      });
    }
    
    // 3. Check for transactions with specific balance of ₱900
    console.log('\n3. Looking for transactions with ₱900 balance...');
    const nineHundredResult = await pool.query(`
      SELECT 
        t.id,
        t.or_number,
        t.amount as transaction_amount,
        t.paid_amount,
        t.balance_amount,
        t.payment_status,
        c.name as customer_name
      FROM transactions t
      JOIN customers c ON t.customer_id = c.id
      WHERE t.balance_amount = 900
      ORDER BY t.created_at DESC
      LIMIT 5
    `);
    
    if (nineHundredResult.rows.length > 0) {
      console.log(`   ✅ Found ${nineHundredResult.rows.length} transactions with ₱900 balance:`);
      nineHundredResult.rows.forEach(row => {
        console.log(`      ${row.customer_name} (${row.or_number}): ₱${row.transaction_amount} - ₱${row.paid_amount} = ₱${row.balance_amount} [${row.payment_status}]`);
      });
    } else {
      console.log('   ℹ️  No transactions found with exactly ₱900 balance');
    }
    
    // 4. Show sample of current transaction states
    console.log('\n4. Sample of current transaction states...');
    const sampleResult = await pool.query(`
      SELECT 
        t.or_number,
        t.amount as transaction_amount,
        t.paid_amount,
        t.balance_amount,
        t.payment_status,
        c.name as customer_name,
        COUNT(ps.id) as settlement_count
      FROM transactions t
      JOIN customers c ON t.customer_id = c.id
      LEFT JOIN payment_settlements ps ON t.id = ps.transaction_id
      GROUP BY t.id, t.or_number, t.amount, t.paid_amount, t.balance_amount, t.payment_status, c.name
      ORDER BY t.created_at DESC
      LIMIT 10
    `);
    
    console.log('   Current transaction status:');
    sampleResult.rows.forEach(row => {
      console.log(`      ${row.customer_name.padEnd(20)} ${row.or_number.padEnd(15)} ₱${String(row.transaction_amount).padStart(6)} - ₱${String(row.paid_amount).padStart(6)} = ₱${String(row.balance_amount).padStart(6)} [${row.payment_status.padEnd(8)}] (${row.settlement_count} settlements)`);
    });
    
    // 5. Summary statistics
    console.log('\n5. Balance calculation summary...');
    const summaryResult = await pool.query(`
      SELECT 
        payment_status,
        COUNT(*) as count,
        SUM(amount) as total_amount,
        SUM(paid_amount) as total_paid,
        SUM(balance_amount) as total_balance
      FROM transactions
      GROUP BY payment_status
      ORDER BY payment_status
    `);
    
    console.log('   Payment status summary:');
    summaryResult.rows.forEach(row => {
      console.log(`      ${row.payment_status.padEnd(10)}: ${String(row.count).padStart(3)} transactions, ₱${row.total_amount} total, ₱${row.total_paid} paid, ₱${row.total_balance} balance`);
    });
    
    console.log('\n✅ Balance verification completed!');
    
  } catch (error) {
    console.error('❌ Error during balance verification:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the verification
verifyBalanceChanges().catch(console.error);
