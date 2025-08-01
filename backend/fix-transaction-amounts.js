const { pool } = require('./dist/config/database');

(async () => {
  try {
    console.log('Starting transaction amount fix...');
    
    // Find all inconsistent transactions
    const findQuery = `
      SELECT 
        c.id as customer_id,
        c.name as customer_name,
        c.or_number,
        c.payment_info,
        t.id as transaction_id,
        t.amount as current_transaction_amount
      FROM customers c
      INNER JOIN transactions t ON c.id = t.customer_id
      WHERE c.created_at >= CURRENT_DATE - INTERVAL '30 days'
    `;
    
    const result = await pool.query(findQuery);
    
    console.log(`Found ${result.rows.length} transactions to check...`);
    
    let updatedCount = 0;
    
    for (const row of result.rows) {
      const paymentInfo = typeof row.payment_info === 'string' ? JSON.parse(row.payment_info) : row.payment_info;
      const customerPaymentAmount = paymentInfo?.amount || 0;
      const currentTransactionAmount = parseFloat(row.current_transaction_amount);
      
      if (customerPaymentAmount !== currentTransactionAmount) {
        console.log(`\nFixing transaction for ${row.customer_name} (OR: ${row.or_number})`);
        console.log(`  Current: ${currentTransactionAmount} -> Correct: ${customerPaymentAmount}`);
        
        // Update the transaction amount
        const updateQuery = `
          UPDATE transactions 
          SET amount = $1, 
              balance_amount = $1 - COALESCE(paid_amount, 0)
          WHERE id = $2
        `;
        
        await pool.query(updateQuery, [customerPaymentAmount, row.transaction_id]);
        updatedCount++;
      }
    }
    
    console.log(`\n✅ Fix completed! Updated ${updatedCount} transactions.`);
    
    // Verify the fix
    console.log('\nVerifying fixes...');
    const verifyResult = await pool.query(findQuery);
    
    let stillInconsistent = 0;
    verifyResult.rows.forEach(row => {
      const paymentInfo = typeof row.payment_info === 'string' ? JSON.parse(row.payment_info) : row.payment_info;
      const customerPaymentAmount = paymentInfo?.amount || 0;
      const currentTransactionAmount = parseFloat(row.current_transaction_amount);
      
      if (customerPaymentAmount !== currentTransactionAmount) {
        stillInconsistent++;
      }
    });
    
    console.log(`${stillInconsistent} transactions still have inconsistent amounts`);
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
