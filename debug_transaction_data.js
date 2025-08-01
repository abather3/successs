// Debug script to check transaction amount data discrepancy
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'escashop',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432
});

async function debugTransactionData() {
  console.log('🔍 Starting Transaction Data Debug...\n');

  try {
    // 1. Check JP De Guzman's customer data
    console.log('1. 📋 Checking JP De Guzman customer data:');
    const customerQuery = `
      SELECT * 
      FROM customers 
      WHERE name ILIKE '%JP De Guzman%' OR name ILIKE '%JP%'
    `;
    const customerResult = await pool.query(customerQuery);
    console.log('Customers found:', customerResult.rows);
    
    if (customerResult.rows.length === 0) {
      console.log('❌ No customers found with JP De Guzman name');
      return;
    }
    
    const customer = customerResult.rows[0];
    console.log(`✅ Found customer: ${customer.name} (ID: ${customer.id})\n`);
    console.log('Customer fields:', Object.keys(customer));

    // 2. Check transactions for this customer
    console.log('2. 💰 Checking transactions for this customer:');
    const transactionQuery = `
      SELECT 
        t.id,
        t.or_number,
        t.amount,
        t.paid_amount,
        t.balance_amount,
        t.payment_status,
        c.name as customer_name
      FROM transactions t
      JOIN customers c ON t.customer_id = c.id
      WHERE t.customer_id = $1
      ORDER BY t.created_at DESC
    `;
    const transactionResult = await pool.query(transactionQuery, [customer.id]);
    
    if (transactionResult.rows.length === 0) {
      console.log('❌ No transactions found for this customer');
      return;
    }
    
    console.log('Transactions found:');
    transactionResult.rows.forEach((tx, index) => {
      console.log(`  ${index + 1}. Transaction ID: ${tx.id}`);
      console.log(`     OR Number: ${tx.or_number}`);
      console.log(`     Amount: ${tx.amount}`);
      console.log(`     Paid Amount: ${tx.paid_amount}`);
      console.log(`     Balance Amount: ${tx.balance_amount}`);
      console.log(`     Payment Status: ${tx.payment_status}`);
      console.log('');
    });

    // 3. Check if there are any data type issues
    console.log('3. 🔧 Checking data types and conversion:');
    const typeCheckQuery = `
      SELECT 
        t.id,
        t.amount,
        CAST(t.amount AS NUMERIC)::FLOAT as amount_as_float,
        t.amount::text as amount_as_text,
        t.paid_amount,
        CAST(t.paid_amount AS NUMERIC)::FLOAT as paid_amount_as_float,
        t.balance_amount,
        CAST(t.balance_amount AS NUMERIC)::FLOAT as balance_amount_as_float
      FROM transactions t
      WHERE t.customer_id = $1
      LIMIT 1
    `;
    const typeResult = await pool.query(typeCheckQuery, [customer.id]);
    
    if (typeResult.rows.length > 0) {
      const tx = typeResult.rows[0];
      console.log('Data type conversion test:');
      console.log(`  Raw amount: ${tx.amount} (type: ${typeof tx.amount})`);
      console.log(`  Amount as float: ${tx.amount_as_float} (type: ${typeof tx.amount_as_float})`);
      console.log(`  Amount as text: "${tx.amount_as_text}"`);
      console.log(`  Raw paid_amount: ${tx.paid_amount} (type: ${typeof tx.paid_amount})`);
      console.log(`  Paid amount as float: ${tx.paid_amount_as_float} (type: ${typeof tx.paid_amount_as_float})`);
      console.log(`  Raw balance_amount: ${tx.balance_amount} (type: ${typeof tx.balance_amount})`);
      console.log(`  Balance amount as float: ${tx.balance_amount_as_float} (type: ${typeof tx.balance_amount_as_float})`);
    }

    // 4. Test the actual SQL query used by TransactionService.list()
    console.log('\n4. 🎯 Testing TransactionService.list() SQL query:');
    const serviceQuery = `
      SELECT 
        t.*, 
        CAST(t.paid_amount AS NUMERIC)::FLOAT as paid_amount, 
        CAST(t.balance_amount AS NUMERIC)::FLOAT as balance_amount, 
        t.payment_status,
        c.name as customer_name,
        c.contact_number as customer_contact,
        c.email as customer_email,
        c.queue_status as customer_queue_status,
        u1.full_name as sales_agent_name,
        u2.full_name as cashier_name
      FROM transactions t
      INNER JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u1 ON t.sales_agent_id = u1.id
      LEFT JOIN users u2 ON t.cashier_id = u2.id
      WHERE t.customer_id = $1
      ORDER BY t.transaction_date DESC
    `;
    
    const serviceResult = await pool.query(serviceQuery, [customer.id]);
    console.log('TransactionService.list() equivalent query results:');
    serviceResult.rows.forEach((tx, index) => {
      console.log(`  ${index + 1}. Transaction ID: ${tx.id}`);
      console.log(`     Amount: ${tx.amount} (type: ${typeof tx.amount})`);
      console.log(`     Paid Amount: ${tx.paid_amount} (type: ${typeof tx.paid_amount})`);
      console.log(`     Balance Amount: ${tx.balance_amount} (type: ${typeof tx.balance_amount})`);
      console.log(`     Customer Name: ${tx.customer_name}`);
      console.log('');
    });

    // 5. Check for transactions with zero amounts
    console.log('\n5. 🔍 Checking for transactions with zero amounts:');
    const zeroAmountQuery = `
      SELECT 
        t.id,
        t.or_number,
        t.amount,
        c.name as customer_name
      FROM transactions t
      JOIN customers c ON t.customer_id = c.id
      WHERE t.amount = 0 OR t.amount IS NULL
      ORDER BY t.created_at DESC
      LIMIT 10
    `;
    const zeroResult = await pool.query(zeroAmountQuery);
    
    if (zeroResult.rows.length === 0) {
      console.log('✅ No transactions with zero or null amounts found');
    } else {
      console.log('❌ Found transactions with zero/null amounts:');
      zeroResult.rows.forEach((tx, index) => {
        console.log(`  ${index + 1}. Transaction ID: ${tx.id}, OR: ${tx.or_number}, Customer: ${tx.customer_name}, Amount: ${tx.amount}`);
      });
    }

    // 6. Check all recent transactions to see the data pattern
    console.log('\n6. 📊 Recent transactions overview:');
    const recentQuery = `
      SELECT 
        t.id,
        t.or_number,
        t.amount,
        c.name as customer_name
      FROM transactions t
      JOIN customers c ON t.customer_id = c.id
      ORDER BY t.created_at DESC
      LIMIT 5
    `;
    const recentResult = await pool.query(recentQuery);
    
    console.log('Recent transactions:');
    recentResult.rows.forEach((tx, index) => {
      console.log(`  ${index + 1}. ID: ${tx.id}, Customer: ${tx.customer_name}, Amount: ${tx.amount} (${typeof tx.amount})`);
    });

    // 7. Check if this transaction was created via createInitialTransaction
    console.log('\n7. 🔍 Analyzing transaction creation pattern:');
    console.log('Expected behavior:');
    console.log(`  - Customer payment_info.amount: ${customer.payment_info.amount}`);
    console.log(`  - Transaction amount should be: ${customer.payment_info.amount}`);
    console.log(`  - Actual transaction amount: ${transactionResult.rows[0].amount}`);
    console.log(`  - Match: ${customer.payment_info.amount == transactionResult.rows[0].amount ? '✅ CORRECT' : '❌ MISMATCH!'}`);
    
    // Check transaction creation timestamp vs customer creation timestamp
    const timeDiff = new Date(transactionResult.rows[0].created_at) - new Date(customer.created_at);
    console.log(`  - Time difference between customer and transaction creation: ${timeDiff}ms`);
    console.log(`  - Likely created by createInitialTransaction: ${Math.abs(timeDiff) < 5000 ? '✅ YES' : '❌ NO'}`);
    
    // 8. Check for other transactions with the same OR number
    console.log('\n8. 🔍 Checking for duplicate OR numbers:');
    const duplicateORQuery = `
      SELECT 
        t.id,
        t.or_number,
        t.amount,
        t.created_at,
        c.name as customer_name
      FROM transactions t
      JOIN customers c ON t.customer_id = c.id
      WHERE t.or_number = $1
      ORDER BY t.created_at ASC
    `;
    const duplicateResult = await pool.query(duplicateORQuery, [customer.or_number]);
    
    if (duplicateResult.rows.length > 1) {
      console.log('❌ Found multiple transactions with same OR number:');
      duplicateResult.rows.forEach((tx, index) => {
        console.log(`  ${index + 1}. Transaction ID: ${tx.id}, Amount: ${tx.amount}, Created: ${tx.created_at}`);
      });
    } else {
      console.log('✅ No duplicate OR numbers found');
    }

  } catch (error) {
    console.error('❌ Error during debug:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
debugTransactionData();
