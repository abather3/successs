// Script to fix transaction amount inconsistencies with customer payment_info
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'escashop',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432
});

async function fixTransactionAmountInconsistencies() {
  console.log('🔧 Starting Transaction Amount Consistency Fix...\n');

  try {
    // 1. Find all transactions with inconsistent amounts
    console.log('1. 🔍 Finding transactions with inconsistent amounts:');
    const inconsistentQuery = `
      SELECT 
        t.id as transaction_id,
        t.or_number as transaction_or,
        t.amount as transaction_amount,
        t.customer_id,
        c.name as customer_name,
        c.or_number as customer_or,
        c.payment_info->>'amount' as customer_payment_amount,
        c.payment_info->>'mode' as customer_payment_mode
      FROM transactions t
      INNER JOIN customers c ON t.customer_id = c.id
      WHERE 
        t.amount::text != c.payment_info->>'amount'
        AND c.payment_info->>'amount' IS NOT NULL
        AND c.payment_info->>'amount' != '0'
      ORDER BY t.created_at DESC
    `;
    
    const inconsistentResult = await pool.query(inconsistentQuery);
    
    if (inconsistentResult.rows.length === 0) {
      console.log('✅ No inconsistent transaction amounts found!');
      return;
    }
    
    console.log(`❌ Found ${inconsistentResult.rows.length} transactions with inconsistent amounts:`);
    inconsistentResult.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. Transaction ID: ${row.transaction_id}`);
      console.log(`     Customer: ${row.customer_name} (ID: ${row.customer_id})`);
      console.log(`     Transaction Amount: ${row.transaction_amount}`);
      console.log(`     Customer Payment Amount: ${row.customer_payment_amount}`);
      console.log(`     Difference: ${parseFloat(row.transaction_amount) - parseFloat(row.customer_payment_amount)}`);
      console.log('');
    });

    // 2. Ask for confirmation (in a real environment, you might want manual approval)
    console.log('2. 🛠️  Proceeding with automatic fix (align transaction amounts to customer payment amounts)...\n');

    // 3. Fix each inconsistent transaction
    let fixedCount = 0;
    let errorCount = 0;

    for (const row of inconsistentResult.rows) {
      try {
        const customerPaymentAmount = parseFloat(row.customer_payment_amount);
        
        console.log(`Fixing Transaction ID ${row.transaction_id}: ${row.transaction_amount} → ${customerPaymentAmount}`);
        
        // Update the transaction amount to match customer's payment_info.amount
        const updateQuery = `
          UPDATE transactions 
          SET 
            amount = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `;
        
        await pool.query(updateQuery, [customerPaymentAmount, row.transaction_id]);
        
        // Also update payment mode if it doesn't match
        if (row.customer_payment_mode) {
          const updateModeQuery = `
            UPDATE transactions 
            SET payment_mode = $1
            WHERE id = $2
          `;
          await pool.query(updateModeQuery, [row.customer_payment_mode, row.transaction_id]);
        }
        
        fixedCount++;
        console.log(`  ✅ Fixed successfully`);
        
      } catch (error) {
        console.log(`  ❌ Error fixing transaction ${row.transaction_id}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Fix Summary:`);
    console.log(`  - Total Inconsistent: ${inconsistentResult.rows.length}`);
    console.log(`  - Successfully Fixed: ${fixedCount}`);
    console.log(`  - Errors: ${errorCount}`);

    // 4. Verify the fixes
    console.log('\n4. ✅ Verifying fixes...');
    const verifyResult = await pool.query(inconsistentQuery);
    
    if (verifyResult.rows.length === 0) {
      console.log('🎉 All transaction amount inconsistencies have been resolved!');
    } else {
      console.log(`⚠️  ${verifyResult.rows.length} inconsistencies still remain. Manual review required.`);
    }

    // 5. Show the specific transaction that was causing the issue
    console.log('\n5. 🎯 Checking JP De Guzman transaction specifically:');
    const jpQuery = `
      SELECT 
        t.id as transaction_id,
        t.or_number as transaction_or,
        t.amount as transaction_amount,
        t.customer_id,
        c.name as customer_name,
        c.payment_info->>'amount' as customer_payment_amount
      FROM transactions t
      INNER JOIN customers c ON t.customer_id = c.id
      WHERE c.name ILIKE '%JP%'
    `;
    
    const jpResult = await pool.query(jpQuery);
    
    if (jpResult.rows.length > 0) {
      const jp = jpResult.rows[0];
      console.log(`JP Transaction Details:`);
      console.log(`  - Transaction ID: ${jp.transaction_id}`);
      console.log(`  - Transaction Amount: ${jp.transaction_amount}`);
      console.log(`  - Customer Payment Amount: ${jp.customer_payment_amount}`);
      console.log(`  - Match: ${jp.transaction_amount == jp.customer_payment_amount ? '✅ CONSISTENT' : '❌ STILL INCONSISTENT'}`);
    } else {
      console.log('No JP transaction found');
    }

  } catch (error) {
    console.error('❌ Error during fix:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixTransactionAmountInconsistencies();
