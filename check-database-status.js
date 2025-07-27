require('dotenv').config();
const { Client } = require('pg');

async function checkDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Check current customers in queue TODAY
    const queueResult = await client.query(`
      SELECT 
        COUNT(*) as total_customers,
        COUNT(*) FILTER (WHERE queue_status = 'waiting') as waiting,
        COUNT(*) FILTER (WHERE queue_status = 'serving') as serving,
        COUNT(*) FILTER (WHERE queue_status = 'completed') as completed,
        COUNT(*) FILTER (WHERE queue_status = 'cancelled') as cancelled,
        MIN(created_at) as oldest_customer,
        MAX(created_at) as newest_customer
      FROM customers
      WHERE DATE(created_at) = CURRENT_DATE
    `);
    
    console.log('\n📊 Today\'s Queue Status:');
    console.log('Total customers:', queueResult.rows[0].total_customers);
    console.log('Waiting:', queueResult.rows[0].waiting);
    console.log('Serving:', queueResult.rows[0].serving);
    console.log('Completed:', queueResult.rows[0].completed);
    console.log('Cancelled:', queueResult.rows[0].cancelled);
    console.log('Oldest customer:', queueResult.rows[0].oldest_customer);
    console.log('Newest customer:', queueResult.rows[0].newest_customer);
    
    // Check recent daily resets
    const resetResult = await client.query(`
      SELECT 
        reset_date, 
        customers_processed, 
        customers_carried_forward, 
        reset_timestamp 
      FROM daily_reset_log 
      ORDER BY reset_timestamp DESC 
      LIMIT 3
    `);
    
    console.log('\n📅 Recent Daily Resets:');
    if (resetResult.rows.length === 0) {
      console.log('No daily resets found in database');
    } else {
      resetResult.rows.forEach(row => {
        console.log(`Date: ${row.reset_date}, Processed: ${row.customers_processed}, Carried Forward: ${row.customers_carried_forward}, Timestamp: ${row.reset_timestamp}`);
      });
    }
    
    // Check if today's reset happened
    const todayResetResult = await client.query(`
      SELECT COUNT(*) as reset_count
      FROM daily_reset_log
      WHERE DATE(reset_timestamp) = CURRENT_DATE
    `);
    
    console.log('\n⏰ Today\'s Reset Status:');
    if (todayResetResult.rows[0].reset_count > 0) {
      console.log('✅ Daily reset has already run today');
    } else {
      console.log('❌ Daily reset has NOT run today yet');
    }
    
    await client.end();
  } catch (error) {
    console.error('❌ Database Error:', error.message);
    await client.end();
  }
}

checkDatabase();
