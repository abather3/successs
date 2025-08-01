// Comprehensive system-wide analysis to identify balance update issues
// This analyzes all transactions to find the root cause of balance calculation problems

const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'escashop',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432
});

async function comprehensiveAnalysis() {
  console.log('🔍 COMPREHENSIVE BALANCE CALCULATION ANALYSIS\n');
  console.log('=' * 70);

  try {
    // Step 1: System-wide data integrity check
    console.log('\nStep 1: System-Wide Data Integrity Analysis');
    console.log('-'.repeat(60));
    
    // Check if payment_settlements table exists and has proper structure
    const tableCheckQuery = `
      SELECT 
        table_name, 
        column_name, 
        data_type,
        is_nullable
      FROM information_schema.columns 
      WHERE table_name IN ('transactions', 'payment_settlements')
      ORDER BY table_name, ordinal_position
    `;
    
    const tableResult = await pool.query(tableCheckQuery);
    
    console.log('📋 Database Schema Analysis:');
    let currentTable = '';
    tableResult.rows.forEach(row => {
      if (row.table_name !== currentTable) {
        console.log(`\n  ${row.table_name} table:`);
        currentTable = row.table_name;
      }
      console.log(`    ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Step 2: Identify the core problem
    console.log('\n\nStep 2: Core Problem Identification');
    console.log('-'.repeat(60));
    
    const problemAnalysisQuery = `
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN t.paid_amount > 0 THEN 1 END) as transactions_with_payments,
        COUNT(CASE WHEN ps.transaction_id IS NOT NULL THEN 1 END) as transactions_with_settlements,
        COUNT(CASE WHEN t.paid_amount > 0 AND ps.transaction_id IS NULL THEN 1 END) as payments_without_settlements,
        COUNT(CASE WHEN t.payment_status = 'paid' AND ps.transaction_id IS NULL THEN 1 END) as paid_status_without_settlements
      FROM transactions t
      LEFT JOIN payment_settlements ps ON t.id = ps.transaction_id
    `;
    
    const problemResult = await pool.query(problemAnalysisQuery);
    const stats = problemResult.rows[0];
    
    console.log('📊 System Statistics:');
    console.log(`  Total Transactions: ${stats.total_transactions}`);
    console.log(`  Transactions with Paid Amount > 0: ${stats.transactions_with_payments}`);
    console.log(`  Transactions with Settlement Records: ${stats.transactions_with_settlements}`);
    console.log(`  ❌ Payments without Settlement Records: ${stats.payments_without_settlements}`);
    console.log(`  ❌ "Paid" Status without Settlement Records: ${stats.paid_status_without_settlements}`);
    
    if (parseInt(stats.payments_without_settlements) > 0) {
      console.log('\n🚨 CRITICAL ISSUE IDENTIFIED:');
      console.log('   Many transactions have paid_amount > 0 but no settlement records!');
      console.log('   This indicates payments are being recorded directly in transactions table');
      console.log('   without proper settlement tracking.');
    }
    
    // Step 3: Analyze specific problem transactions
    console.log('\n\nStep 3: Problem Transaction Analysis');
    console.log('-'.repeat(60));
    
    const problemTransactionsQuery = `
      SELECT 
        t.id,
        t.or_number,
        t.amount,
        t.paid_amount,
        t.balance_amount,
        t.payment_status,
        t.transaction_date,
        c.name as customer_name,
        COALESCE(SUM(ps.amount), 0) as settlement_total,
        COUNT(ps.id) as settlement_count
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN payment_settlements ps ON t.id = ps.transaction_id
      WHERE t.paid_amount > 0
      GROUP BY t.id, t.or_number, t.amount, t.paid_amount, t.balance_amount, t.payment_status, t.transaction_date, c.name
      ORDER BY t.transaction_date DESC
      LIMIT 10
    `;
    
    const problemTransactionsResult = await pool.query(problemTransactionsQuery);
    
    console.log('📋 Recent Transactions with Payments (Top 10):');
    problemTransactionsResult.rows.forEach((tx, index) => {
      const settlementTotal = parseFloat(tx.settlement_total);
      const paidAmount = parseFloat(tx.paid_amount);
      const hasDiscrepancy = Math.abs(settlementTotal - paidAmount) > 0.01;
      
      console.log(`\n  ${index + 1}. OR: ${tx.or_number} (${tx.customer_name})`);
      console.log(`     Amount: ₱${tx.amount} | Paid: ₱${tx.paid_amount} | Balance: ₱${tx.balance_amount}`);
      console.log(`     Status: ${tx.payment_status}`);
      console.log(`     Settlement Records: ${tx.settlement_count} (Total: ₱${settlementTotal})`);
      console.log(`     ${hasDiscrepancy ? '❌ DISCREPANCY' : '✅ MATCHES'}: Settlement vs Paid Amount`);
      console.log(`     Date: ${tx.transaction_date}`);
    });
    
    // Step 4: Check for direct payment updates vs settlement-based updates
    console.log('\n\nStep 4: Payment Update Mechanism Analysis');
    console.log('-'.repeat(60));
    
    // Check if transactions are being updated directly without settlements
    const directPaymentQuery = `
      SELECT 
        t.id,
        t.or_number,
        t.amount,
        t.paid_amount,
        t.payment_status,
        t.created_at,
        t.transaction_date,
        COALESCE(SUM(ps.amount), 0) as settlement_total
      FROM transactions t
      LEFT JOIN payment_settlements ps ON t.id = ps.transaction_id
      WHERE t.paid_amount > 0
      GROUP BY t.id, t.or_number, t.amount, t.paid_amount, t.payment_status, t.created_at, t.transaction_date
      HAVING COALESCE(SUM(ps.amount), 0) = 0
      ORDER BY t.created_at DESC
      LIMIT 5
    `;
    
    const directPaymentResult = await pool.query(directPaymentQuery);
    
    if (directPaymentResult.rows.length > 0) {
      console.log('🔍 Transactions with Direct Payment Updates (No Settlements):');
      directPaymentResult.rows.forEach((tx, index) => {
        console.log(`  ${index + 1}. OR: ${tx.or_number}`);
        console.log(`     Amount: ₱${tx.amount} | Paid: ₱${tx.paid_amount} | Status: ${tx.payment_status}`);
        console.log(`     Created: ${tx.created_at}`);
        console.log('     ❌ This transaction was marked as paid without settlement records');
      });
      
      console.log('\n💡 ROOT CAUSE IDENTIFIED:');
      console.log('   Transactions are being marked as paid through direct updates');
      console.log('   instead of using the PaymentSettlementService.');
      console.log('   This bypasses the proper balance calculation system.');
    } else {
      console.log('✅ No transactions found with direct payment updates');
    }
    
    // Step 5: Check for missing balance_amount calculations
    console.log('\n\nStep 5: Balance Amount Calculation Verification');
    console.log('-'.repeat(60));
    
    const balanceVerificationQuery = `
      SELECT 
        t.id,
        t.or_number,
        t.amount,
        t.paid_amount,
        t.balance_amount,
        (t.amount - t.paid_amount) as calculated_balance,
        ABS(t.balance_amount - (t.amount - t.paid_amount)) as balance_difference
      FROM transactions t
      WHERE ABS(t.balance_amount - (t.amount - t.paid_amount)) > 0.01
      ORDER BY balance_difference DESC
      LIMIT 5
    `;
    
    const balanceVerificationResult = await pool.query(balanceVerificationQuery);
    
    if (balanceVerificationResult.rows.length > 0) {
      console.log('❌ Transactions with Incorrect Balance Calculations:');
      balanceVerificationResult.rows.forEach((tx, index) => {
        console.log(`  ${index + 1}. OR: ${tx.or_number}`);
        console.log(`     Amount: ₱${tx.amount} | Paid: ₱${tx.paid_amount}`);
        console.log(`     Stored Balance: ₱${tx.balance_amount}`);
        console.log(`     Calculated Balance: ₱${tx.calculated_balance}`);
        console.log(`     Difference: ₱${tx.balance_difference}`);
      });
    } else {
      console.log('✅ All balance_amount calculations are correct');
    }
    
    // Step 6: Check for the original OR293546A95AUM issue
    console.log('\n\nStep 6: Original Issue Investigation (OR293546A95AUM)');
    console.log('-'.repeat(60));
    
    const originalIssueQuery = `
      SELECT or_number, amount, paid_amount, balance_amount, payment_status
      FROM transactions 
      WHERE or_number ILIKE '%293546%' OR or_number = 'OR293546A95AUM'
    `;
    
    const originalIssueResult = await pool.query(originalIssueQuery);
    
    if (originalIssueResult.rows.length === 0) {
      console.log('ℹ️  Transaction OR293546A95AUM does not exist in the database');
      console.log('💡 This could mean:');
      console.log('   1. The transaction was never created');
      console.log('   2. It was deleted during testing/cleanup');
      console.log('   3. The OR number was mistyped in the original issue report');
      
      // Search for similar patterns
      const similarSearchQuery = `
        SELECT or_number, customer_id, amount, payment_status, created_at
        FROM transactions 
        WHERE or_number ILIKE '%OR2935%' OR or_number ILIKE '%A95AUM%'
        ORDER BY created_at DESC
        LIMIT 5
      `;
      
      const similarResult = await pool.query(similarSearchQuery);
      if (similarResult.rows.length > 0) {
        console.log('\n🔍 Similar OR patterns found:');
        similarResult.rows.forEach((tx, index) => {
          console.log(`  ${index + 1}. ${tx.or_number} - Customer: ${tx.customer_id}, Amount: ₱${tx.amount}`);
        });
      }
    } else {
      console.log('✅ Found transaction(s) matching the pattern:');
      originalIssueResult.rows.forEach((tx, index) => {
        console.log(`  ${index + 1}. ${tx.or_number}: ₱${tx.amount} (Paid: ₱${tx.paid_amount}, Status: ${tx.payment_status})`);
      });
    }
    
    // Step 7: System recommendations
    console.log('\n\nStep 7: System Diagnosis and Recommendations');
    console.log('='.repeat(70));
    
    console.log('\n📋 DIAGNOSIS SUMMARY:');
    
    if (parseInt(stats.payments_without_settlements) > 0) {
      console.log('\n❌ CRITICAL SYSTEM ISSUE DETECTED:');
      console.log(`   ${stats.payments_without_settlements} transactions have payments without settlement records`);
      console.log('   This indicates the payment system is bypassing proper settlement tracking');
      
      console.log('\n🔧 IMMEDIATE ACTIONS REQUIRED:');
      console.log('1. Investigate how payments are being processed');
      console.log('2. Check if TransactionService.create() is setting paid_amount directly');
      console.log('3. Verify PaymentSettlementService is being used for all payments');
      console.log('4. Review the frontend payment forms to ensure proper API calls');
      console.log('5. Check if there are bulk payment updates bypassing the settlement system');
      
      console.log('\n💡 LIKELY ROOT CAUSES:');
      console.log('• Direct database updates to paid_amount column');
      console.log('• Frontend calling transaction update API instead of settlement API');
      console.log('• Bulk import scripts that set payments without settlements');
      console.log('• Legacy code paths that bypass the settlement system');
      
    } else {
      console.log('✅ Settlement tracking appears to be working correctly');
    }
    
    console.log('\n🔍 REGARDING THE ORIGINAL ISSUE (OR293546A95AUM):');
    console.log('• This specific transaction does not exist in the database');
    console.log('• The balance update issue is likely systemic, not transaction-specific');
    console.log('• Focus should be on fixing the settlement tracking system');
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Run a data migration to create settlement records for existing payments');
    console.log('2. Audit all payment processing code paths');
    console.log('3. Implement strict validation to prevent direct paid_amount updates');
    console.log('4. Add monitoring for payment/settlement discrepancies');
    console.log('5. Test the frontend payment flows end-to-end');
    
  } catch (error) {
    console.error('❌ Error during comprehensive analysis:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the comprehensive analysis
console.log('🚀 Starting comprehensive balance calculation analysis...\n');
comprehensiveAnalysis();
