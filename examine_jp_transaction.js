const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'escashop',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432
});

async function examineJPTransaction() {
  console.log('🔍 Examining JP Transaction (BUG-TEST-002)\n');
  
  try {
    // Get JP transaction details
    const jpQuery = `
      SELECT 
        t.id,
        t.or_number,
        t.amount,
        t.paid_amount,
        t.balance_amount,
        t.payment_status,
        c.name as customer_name
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      WHERE t.or_number = 'BUG-TEST-002'
    `;
    
    const jpResult = await pool.query(jpQuery);
    
    if (jpResult.rows.length === 0) {
      console.log('❌ JP Transaction (BUG-TEST-002) not found');
      return;
    }
    
    const jp = jpResult.rows[0];
    console.log('✅ JP Transaction Found:');
    console.log(`   OR Number: ${jp.or_number}`);
    console.log(`   Customer: ${jp.customer_name}`);
    console.log(`   Amount: ₱${jp.amount}`);
    console.log(`   Paid: ₱${jp.paid_amount}`);
    console.log(`   Balance: ₱${jp.balance_amount}`);
    console.log(`   Status: ${jp.payment_status}`);
    
    // Check settlements for this transaction
    const settlementsQuery = `
      SELECT 
        ps.id,
        ps.amount,
        ps.payment_mode,
        ps.paid_at,
        u.full_name as cashier_name
      FROM payment_settlements ps
      LEFT JOIN users u ON ps.cashier_id = u.id
      WHERE ps.transaction_id = $1
      ORDER BY ps.paid_at ASC
    `;
    
    const settlementsResult = await pool.query(settlementsQuery, [jp.id]);
    
    if (settlementsResult.rows.length === 0) {
      console.log('\n💡 No payment settlements found for this transaction');
      console.log('💡 This means we can use this transaction to test the scenario!');
      
      // Check if we can modify this transaction for our test
      if (parseFloat(jp.amount) === 1000.00) {
        console.log('\n✅ Perfect! This transaction has ₱1,000.00 amount');
        console.log('🧪 We can add a ₱100.00 settlement to test the ₱900.00 balance calculation');
        
        // Let's create a settlement for this transaction
        console.log('\n🔧 Creating ₱100.00 settlement for testing...');
        
        const insertSettlementQuery = `
          INSERT INTO payment_settlements (transaction_id, amount, payment_mode, cashier_id, paid_at, created_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
          RETURNING id, amount
        `;
        
        // Get system admin user ID (should be 1)
        const adminQuery = 'SELECT id FROM users WHERE full_name = $1 LIMIT 1';
        const adminResult = await pool.query(adminQuery, ['System Administrator']);
        const cashierId = adminResult.rows.length > 0 ? adminResult.rows[0].id : 1;
        
        const settlementResult = await pool.query(insertSettlementQuery, [
          jp.id,
          100.00,
          'cash',
          cashierId
        ]);
        
        console.log(`✅ Settlement created with ID: ${settlementResult.rows[0].id}`);
        console.log(`   Amount: ₱${settlementResult.rows[0].amount}`);
        
        // Now update the transaction's payment status and balance
        console.log('\n🔧 Updating transaction payment status and balance...');
        
        const updateTransactionQuery = `
          UPDATE transactions 
          SET 
            paid_amount = (
              SELECT COALESCE(SUM(amount), 0) 
              FROM payment_settlements 
              WHERE transaction_id = $1
            ),
            balance_amount = amount - (
              SELECT COALESCE(SUM(amount), 0) 
              FROM payment_settlements 
              WHERE transaction_id = $1
            ),
            payment_status = CASE
              WHEN (SELECT COALESCE(SUM(amount), 0) FROM payment_settlements WHERE transaction_id = $1) = 0 THEN 'unpaid'
              WHEN (SELECT COALESCE(SUM(amount), 0) FROM payment_settlements WHERE transaction_id = $1) >= amount THEN 'paid'
              ELSE 'partial'
            END
          WHERE id = $1
          RETURNING paid_amount, balance_amount, payment_status
        `;
        
        const updateResult = await pool.query(updateTransactionQuery, [jp.id]);
        const updated = updateResult.rows[0];
        
        console.log('✅ Transaction updated:');
        console.log(`   Paid Amount: ₱${updated.paid_amount}`);
        console.log(`   Balance Amount: ₱${updated.balance_amount}`);
        console.log(`   Payment Status: ${updated.payment_status}`);
        
        // Verify the calculation
        if (parseFloat(updated.balance_amount) === 900.00 && updated.payment_status === 'partial') {
          console.log('\n🎉 SUCCESS! Transaction now has:');
          console.log('   ✅ Balance correctly updated to ₱900.00');
          console.log('   ✅ Payment status correctly set to "partial"');
        } else {
          console.log('\n❌ Something went wrong with the calculation:');
          console.log(`   Expected: Balance ₱900.00, Status "partial"`);
          console.log(`   Actual: Balance ₱${updated.balance_amount}, Status "${updated.payment_status}"`);
        }
        
      } else {
        console.log(`\n❌ Transaction amount is ₱${jp.amount}, not ₱1,000.00`);
        console.log('🔍 Looking for a ₱1,000.00 transaction to modify...');
        
        // Update this transaction to ₱1,000.00 for testing
        const updateAmountQuery = `
          UPDATE transactions 
          SET amount = 1000.00, balance_amount = 1000.00
          WHERE id = $1
          RETURNING amount, balance_amount
        `;
        
        const amountUpdateResult = await pool.query(updateAmountQuery, [jp.id]);
        console.log(`✅ Updated transaction amount to ₱${amountUpdateResult.rows[0].amount}`);
        
        // Recursive call to process the updated transaction
        await examineJPTransaction();
      }
    } else {
      console.log(`\n💰 Found ${settlementsResult.rows.length} settlement(s):`);
      let totalSettlements = 0;
      
      settlementsResult.rows.forEach((settlement, index) => {
        console.log(`\n  Settlement #${index + 1}:`);
        console.log(`    Amount: ₱${settlement.amount}`);
        console.log(`    Mode: ${settlement.payment_mode}`);
        console.log(`    Cashier: ${settlement.cashier_name || 'Unknown'}`);
        console.log(`    Date: ${settlement.paid_at}`);
        totalSettlements += parseFloat(settlement.amount);
      });
      
      console.log(`\n📊 Settlement Summary:`);
      console.log(`   Total Settlements: ₱${totalSettlements.toFixed(2)}`);
      console.log(`   Expected Balance: ₱${(parseFloat(jp.amount) - totalSettlements).toFixed(2)}`);
      console.log(`   Actual Balance: ₱${jp.balance_amount}`);
      
      // Check if calculation is correct
      const expectedBalance = parseFloat(jp.amount) - totalSettlements;
      const actualBalance = parseFloat(jp.balance_amount);
      
      if (Math.abs(expectedBalance - actualBalance) <= 0.01) {
        console.log('   ✅ Balance calculation is correct');
      } else {
        console.log('   ❌ Balance calculation is incorrect');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

examineJPTransaction();
