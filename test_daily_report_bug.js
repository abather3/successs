const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/escashop',
});

// Sample transactions to demonstrate the bug (using real customer and user IDs)
const sampleTransactions = [
  // Today's transactions - covering all payment modes
  {
    customer_id: 24, // Maddie Line
    or_number: 'BUG-TEST-001',
    amount: 1500.00,
    payment_mode: 'cash',
    sales_agent_id: 2, // Shella (sales)
    cashier_id: 6, // Cashier1
    transaction_date: new Date()
  },
  {
    customer_id: 12, // JP
    or_number: 'BUG-TEST-002',
    amount: 2250.50,
    payment_mode: 'gcash',
    sales_agent_id: 2,
    cashier_id: 6,
    transaction_date: new Date()
  },
  {
    customer_id: 14, // Maruki Senbu
    or_number: 'BUG-TEST-003',
    amount: 800.75,
    payment_mode: 'maya',
    sales_agent_id: 5, // Jil (sales)
    cashier_id: 6,
    transaction_date: new Date()
  },
  {
    customer_id: 15, // LeBron James
    or_number: 'BUG-TEST-004',
    amount: 3200.00,
    payment_mode: 'credit_card',
    sales_agent_id: 5,
    cashier_id: 6,
    transaction_date: new Date()
  },
  {
    customer_id: 16, // Austin Reaves
    or_number: 'BUG-TEST-005',
    amount: 1800.25,
    payment_mode: 'bank_transfer',
    sales_agent_id: 2,
    cashier_id: 6,
    transaction_date: new Date()
  },
  // Additional test transactions with different amounts
  {
    customer_id: 24, // Maddie Line again
    or_number: 'BUG-TEST-006',
    amount: 950.00,
    payment_mode: 'cash',
    sales_agent_id: 5,
    cashier_id: 6,
    transaction_date: new Date()
  }
];

async function insertTestTransactions() {
  try {
    console.log('🧪 Inserting test transactions for bug reproduction...');
    
    // Clear any existing test transactions
    await pool.query(`DELETE FROM transactions WHERE or_number LIKE 'BUG-TEST-%'`);
    console.log('🗑️  Cleared existing test data');
    
    // Insert test transactions
    console.log('💰 Inserting test transactions...');
    for (const transaction of sampleTransactions) {
      try {
        await pool.query(`
          INSERT INTO transactions (
            customer_id, or_number, amount, payment_mode, sales_agent_id, 
            cashier_id, transaction_date, paid_amount, payment_status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          transaction.customer_id, transaction.or_number, transaction.amount,
          transaction.payment_mode, transaction.sales_agent_id, transaction.cashier_id,
          transaction.transaction_date, transaction.amount, 'paid'
        ]);
        console.log(`✅ Inserted: ${transaction.or_number} - ${transaction.payment_mode} - $${transaction.amount}`);
      } catch (error) {
        console.log(`⚠️  Skipped ${transaction.or_number}: ${error.message}`);
      }
    }
    
    console.log('\n📊 Test data summary:');
    console.log('Expected today\'s transactions by payment mode:');
    
    const summary = {};
    sampleTransactions.forEach(tx => {
      if (!summary[tx.payment_mode]) {
        summary[tx.payment_mode] = { count: 0, amount: 0 };
      }
      summary[tx.payment_mode].count++;
      summary[tx.payment_mode].amount += tx.amount;
    });
    
    Object.entries(summary).forEach(([mode, data]) => {
      console.log(`- ${mode}: ${data.count} transactions, $${data.amount} total`);
    });
    
    const totalAmount = sampleTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const totalCount = sampleTransactions.length;
    
    console.log(`\n📈 Expected totals for today:`);
    console.log(`- Total transactions: ${totalCount}`);
    console.log(`- Total amount: $${totalAmount}`);
    
    console.log('\n✅ Test data inserted successfully!');
    console.log('📝 Now you can test the daily report endpoint:');
    console.log(`   GET http://localhost:5000/transactions/reports/daily?date=${new Date().toISOString().split('T')[0]}`);
    
  } catch (error) {
    console.error('❌ Error inserting test transactions:', error);
  } finally {
    await pool.end();
  }
}

// Run the test data insertion
insertTestTransactions();
