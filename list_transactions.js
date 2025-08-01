// Script to list all transactions in the database
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'escashop',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432
});

async function listTransactions() {
  console.log('📋 Listing All Transactions in Database\n');
  console.log('=' * 50);

  try {
    // Get all transactions with customer info
    const query = `
      SELECT 
        t.id,
        t.or_number,
        t.amount,
        COALESCE(t.paid_amount, 0) as paid_amount,
        COALESCE(t.balance_amount, t.amount) as balance_amount,
        COALESCE(t.payment_status, 'unpaid') as payment_status,
        t.payment_mode,
        t.transaction_date,
        c.name as customer_name,
        c.contact_number,
        u1.full_name as sales_agent_name,
        u2.full_name as cashier_name
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u1 ON t.sales_agent_id = u1.id
      LEFT JOIN users u2 ON t.cashier_id = u2.id
      ORDER BY t.created_at DESC
      LIMIT 20
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      console.log('❌ No transactions found in database');
      return;
    }
    
    console.log(`✅ Found ${result.rows.length} transactions (showing most recent 20):\n`);
    
    result.rows.forEach((tx, index) => {
      console.log(`${index + 1}. Transaction Details:`);
      console.log(`   ID: ${tx.id}`);
      console.log(`   OR Number: ${tx.or_number}`);
      console.log(`   Customer: ${tx.customer_name || 'Unknown'}`);
      console.log(`   Amount: ₱${tx.amount}`);
      console.log(`   Paid: ₱${tx.paid_amount}`);
      console.log(`   Balance: ₱${tx.balance_amount}`);
      console.log(`   Status: ${tx.payment_status}`);
      console.log(`   Mode: ${tx.payment_mode}`);
      console.log(`   Date: ${tx.transaction_date}`);
      console.log(`   Sales Agent: ${tx.sales_agent_name || 'N/A'}`);
      console.log(`   Cashier: ${tx.cashier_name || 'N/A'}`);
      console.log('');
    });
    
    // Check for transactions with balance issues
    console.log('\n🔍 Checking for transactions with potential balance issues:\n');
    
    const balanceCheckQuery = `
      SELECT 
        t.id,
        t.or_number,
        t.amount,
        t.paid_amount,
        t.balance_amount,
        t.payment_status,
        COALESCE(SUM(ps.amount), 0) as settlements_total,
        c.name as customer_name
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN payment_settlements ps ON t.id = ps.transaction_id
      GROUP BY t.id, t.or_number, t.amount, t.paid_amount, t.balance_amount, t.payment_status, c.name
      HAVING 
        (t.paid_amount != COALESCE(SUM(ps.amount), 0)) OR
        (t.balance_amount != (t.amount - COALESCE(SUM(ps.amount), 0))) OR
        (
          CASE
            WHEN COALESCE(SUM(ps.amount), 0) = 0 THEN 'unpaid'
            WHEN COALESCE(SUM(ps.amount), 0) >= t.amount THEN 'paid'
            ELSE 'partial'
          END != t.payment_status
        )
      ORDER BY t.created_at DESC
    `;
    
    const balanceCheckResult = await pool.query(balanceCheckQuery);
    
    if (balanceCheckResult.rows.length === 0) {
      console.log('✅ No balance calculation issues found');
    } else {
      console.log(`❌ Found ${balanceCheckResult.rows.length} transactions with balance issues:`);
      
      balanceCheckResult.rows.forEach((tx, index) => {
        const expectedPaid = parseFloat(tx.settlements_total);
        const actualPaid = parseFloat(tx.paid_amount || 0);
        const expectedBalance = parseFloat(tx.amount) - expectedPaid;
        const actualBalance = parseFloat(tx.balance_amount || tx.amount);
        
        let expectedStatus;
        if (expectedPaid === 0) {
          expectedStatus = 'unpaid';
        } else if (expectedPaid >= parseFloat(tx.amount)) {
          expectedStatus = 'paid';
        } else {
          expectedStatus = 'partial';
        }
        
        console.log(`\n  ${index + 1}. OR: ${tx.or_number} (${tx.customer_name})`);
        console.log(`     Amount: ₱${tx.amount}`);
        console.log(`     Expected Paid: ₱${expectedPaid} | Actual Paid: ₱${actualPaid}`);
        console.log(`     Expected Balance: ₱${expectedBalance} | Actual Balance: ₱${actualBalance}`);
        console.log(`     Expected Status: ${expectedStatus} | Actual Status: ${tx.payment_status}`);
      });
    }
    
    // List payment settlements
    console.log('\n💰 Payment Settlements Summary:\n');
    
    const settlementsQuery = `
      SELECT 
        ps.id,
        ps.transaction_id,
        t.or_number,
        ps.amount,
        ps.payment_mode,
        ps.paid_at,
        c.name as customer_name,
        u.full_name as cashier_name
      FROM payment_settlements ps
      JOIN transactions t ON ps.transaction_id = t.id
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u ON ps.cashier_id = u.id
      ORDER BY ps.paid_at DESC
      LIMIT 10
    `;
    
    const settlementsResult = await pool.query(settlementsQuery);
    
    if (settlementsResult.rows.length === 0) {
      console.log('ℹ️  No payment settlements found');
    } else {
      console.log(`✅ Found ${settlementsResult.rows.length} recent settlements:`);
      
      settlementsResult.rows.forEach((settlement, index) => {
        console.log(`  ${index + 1}. Settlement ID: ${settlement.id}`);
        console.log(`     OR: ${settlement.or_number} (${settlement.customer_name})`);
        console.log(`     Amount: ₱${settlement.amount}`);
        console.log(`     Mode: ${settlement.payment_mode}`);
        console.log(`     Cashier: ${settlement.cashier_name || 'Unknown'}`);
        console.log(`     Date: ${settlement.paid_at}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error listing transactions:', error);
  } finally {
    await pool.end();
  }
}

// Run the listing
listTransactions();
