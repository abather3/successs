const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/escashop';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: (DATABASE_URL?.includes('localhost') || DATABASE_URL?.includes('postgres:')) ? false : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

async function runBalanceFix() {
  try {
    console.log('🔧 Starting balance calculation fix...');
    
    // Connect to database
    const client = await pool.connect();
    console.log('✅ Database connection established');
    
    // Read the SQL fix script
    const sqlFilePath = path.join(__dirname, '../database/fix_balance_calculations.sql');
    const sql = fs.readFileSync(sqlFilePath, { encoding: 'utf-8' });
    
    console.log('📖 Executing balance fix script...');
    
    // Execute the SQL script
    const result = await client.query(sql);
    
    console.log('✅ Balance fix script executed successfully!');
    
    // The script includes a report at the end, let's display it
    if (result && result.length > 0) {
      const reportResult = result[result.length - 1];
      if (reportResult.rows && reportResult.rows.length > 0) {
        console.log('\n📊 Fix Results:');
        console.log(reportResult.rows[0]);
      }
    }
    
    client.release();
    
  } catch (error) {
    console.error('❌ Error running balance fix:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

runBalanceFix()
  .then(() => {
    console.log('🎉 Balance fix process completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Balance fix process failed:', error);
    process.exit(1);
  });
