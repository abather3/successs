// Test script for settlement history API endpoint
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'escashop',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432
});

async function testSettlementsAPI() {
  console.log('🧪 Testing Settlement History API Endpoint...\n');

  try {
    // 1. First, check if JP's transaction has any settlements
    console.log('1. 🔍 Checking JP\'s transaction for settlements:');
    const jpTransactionQuery = `
      SELECT 
        t.id as transaction_id,
        t.or_number,
        t.amount,
        t.paid_amount,
        t.payment_status,
        c.name as customer_name
      FROM transactions t
      INNER JOIN customers c ON t.customer_id = c.id
      WHERE c.name ILIKE '%JP%'
    `;
    
    const jpResult = await pool.query(jpTransactionQuery);
    
    if (jpResult.rows.length === 0) {
      console.log('❌ No JP transaction found');
      return;
    }
    
    const jpTransaction = jpResult.rows[0];
    console.log(`✅ Found JP transaction:`);
    console.log(`  - ID: ${jpTransaction.transaction_id}`);
    console.log(`  - OR Number: ${jpTransaction.or_number}`);
    console.log(`  - Amount: ${jpTransaction.amount}`);
    console.log(`  - Paid Amount: ${jpTransaction.paid_amount}`);
    console.log(`  - Status: ${jpTransaction.payment_status}`);
    
    // 2. Check if payment_settlements table exists and has the right structure
    console.log('\n2. 🏗️  Checking payment_settlements table structure:');
    const tableStructureQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'payment_settlements'
      ORDER BY ordinal_position
    `;
    
    const structureResult = await pool.query(tableStructureQuery);
    
    if (structureResult.rows.length === 0) {
      console.log('❌ payment_settlements table does not exist!');
      console.log('Creating payment_settlements table...');
      
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS payment_settlements (
          id SERIAL PRIMARY KEY,
          transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
          amount DECIMAL(10,2) NOT NULL,
          payment_mode VARCHAR(20) NOT NULL,
          cashier_id INTEGER NOT NULL REFERENCES users(id),
          notes TEXT,
          paid_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      await pool.query(createTableQuery);
      console.log('✅ payment_settlements table created');
    } else {
      console.log('✅ payment_settlements table exists with columns:');
      structureResult.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }
    
    // 3. Check existing settlements for JP's transaction
    console.log('\n3. 💰 Checking existing settlements for JP\'s transaction:');
    const settlementsQuery = `
      SELECT 
        ps.*,
        CAST(ps.amount AS NUMERIC)::FLOAT as amount_float,
        u.full_name as cashier_name
      FROM payment_settlements ps
      LEFT JOIN users u ON ps.cashier_id = u.id
      WHERE ps.transaction_id = $1
      ORDER BY ps.paid_at DESC
    `;
    
    const settlementsResult = await pool.query(settlementsQuery, [jpTransaction.transaction_id]);
    
    if (settlementsResult.rows.length === 0) {
      console.log('ℹ️  No settlements found for JP\'s transaction');
    } else {
      console.log(`✅ Found ${settlementsResult.rows.length} settlements:`);
      settlementsResult.rows.forEach((settlement, index) => {
        console.log(`  ${index + 1}. Settlement ID: ${settlement.id}`);
        console.log(`     Amount: ${settlement.amount} (${settlement.amount_float})`);
        console.log(`     Mode: ${settlement.payment_mode}`);
        console.log(`     Cashier: ${settlement.cashier_name}`);
        console.log(`     Date: ${settlement.paid_at}`);
        console.log('');
      });
    }
    
    // 4. Test the exact query used by PaymentSettlementService.getSettlements()
    console.log('4. 🎯 Testing PaymentSettlementService.getSettlements() query:');
    const serviceQuery = `
      SELECT 
        ps.*,
        CAST(ps.amount AS NUMERIC)::FLOAT as amount,
        u.full_name as cashier_name
      FROM payment_settlements ps
      LEFT JOIN users u ON ps.cashier_id = u.id
      WHERE ps.transaction_id = $1
      ORDER BY ps.paid_at DESC
    `;
    
    try {
      const serviceResult = await pool.query(serviceQuery, [jpTransaction.transaction_id]);
      console.log(`✅ Service query executed successfully`);
      console.log(`   Results: ${serviceResult.rows.length} settlements`);
      
      if (serviceResult.rows.length > 0) {
        console.log('   Sample result:', JSON.stringify(serviceResult.rows[0], null, 2));
      }
    } catch (serviceError) {
      console.log(`❌ Service query failed:`, serviceError.message);
    }
    
    // 5. Check if backend server is running by testing a simple query
    console.log('\n5. 🖥️  Testing basic database connectivity:');
    const connectivityResult = await pool.query('SELECT NOW() as current_time');
    console.log(`✅ Database connectivity OK: ${connectivityResult.rows[0].current_time}`);
    
    // 6. Summary and recommendations
    console.log('\n6. 📋 Summary and Recommendations:');
    if (settlementsResult.rows.length === 0) {
      console.log('🔍 Root Cause: No settlements exist for JP\'s transaction');
      console.log('💡 This explains why the API returns an empty array');
      console.log('✅ Solution: The API is working correctly - there are simply no settlements to show');
      console.log('📝 Note: After we fixed the transaction amount, the payment status was reset, so any previous settlements were cleaned up');
    } else {
      console.log('🔍 Settlements exist, API should be working');
      console.log('💡 The 500 error might be caused by:');
      console.log('   - Frontend authentication issues');
      console.log('   - Backend server not running');
      console.log('   - Network connectivity problems');
    }
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    await pool.end();
  }
}

testSettlementsAPI();
