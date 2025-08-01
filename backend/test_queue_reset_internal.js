const { pool } = require('./dist/config/database');

async function testQueueReset() {
  const client = await pool.connect();
  
  try {
    console.log('=== QUEUE RESET TEST (Internal) ===\n');
    
    // Get current date for today's analysis
    const today = new Date().toISOString().split('T')[0];
    console.log(`Analyzing queue reset for date: ${today}\n`);
    
    // 1. Check current customers in queue
    console.log('1. CURRENT CUSTOMERS IN QUEUE:');
    const currentCustomers = await client.query(`
      SELECT 
        id, 
        or_number, 
        queue_status, 
        created_at,
        served_at,
        LEFT(created_at::text, 10) as date_created
      FROM customers 
      WHERE DATE(created_at) = CURRENT_DATE
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`   Found ${currentCustomers.rows.length} customers created today:`);
    currentCustomers.rows.forEach(customer => {
      console.log(`   - ID: ${customer.id}, OR Number: ${customer.or_number}, Status: ${customer.queue_status}, Created: ${customer.created_at}, Served: ${customer.served_at || 'Not served'}`);
    });
    console.log();
    
    // 2. Check customers already in history for today
    console.log('2. CUSTOMERS ALREADY ARCHIVED TODAY:');
    const archivedToday = await client.query(`
      SELECT 
        original_customer_id, 
        token_number, 
        queue_status, 
        archived_at,
        created_at as original_created_at
      FROM customer_history 
      WHERE DATE(archived_at) = CURRENT_DATE
      ORDER BY archived_at DESC
      LIMIT 10
    `);
    
    console.log(`   Found ${archivedToday.rows.length} customers already archived today:`);
    archivedToday.rows.forEach(customer => {
      console.log(`   - Customer ID: ${customer.original_customer_id}, Token: ${customer.token_number}, Status: ${customer.queue_status}, Archived: ${customer.archived_at}`);
    });
    console.log();
    
    // 3. Simulate the customers that would be affected by reset
    console.log('3. CUSTOMERS THAT WOULD BE AFFECTED BY RESET:');
    const affectedCustomers = await client.query(`
      SELECT c.id, c.or_number, c.queue_status, c.created_at, c.served_at
      FROM customers c
      WHERE DATE(c.created_at) = CURRENT_DATE
        AND c.id NOT IN (
          SELECT DISTINCT original_customer_id 
          FROM customer_history 
          WHERE DATE(archived_at) = CURRENT_DATE
            AND original_customer_id IS NOT NULL
        )
      ORDER BY c.created_at
    `);
    
    console.log(`   Found ${affectedCustomers.rows.length} customers that would be archived:`);
    affectedCustomers.rows.forEach(customer => {
      console.log(`   - ID: ${customer.id}, OR Number: ${customer.or_number}, Status: ${customer.queue_status}, Created: ${customer.created_at}, Served: ${customer.served_at || 'Not served'}`);
    });
    console.log();
    
    // 4. Check current analytics state
    console.log('4. CURRENT ANALYTICS STATE:');
    const analyticsToday = await client.query(`
      SELECT date, hour, customers_served, avg_wait_time_minutes FROM queue_analytics 
      WHERE date = CURRENT_DATE
      ORDER BY hour DESC
      LIMIT 5
    `);
    
    console.log(`   Found ${analyticsToday.rows.length} analytics records for today:`);
    analyticsToday.rows.forEach(record => {
      console.log(`   - Date: ${record.date}, Hour: ${record.hour}, Customers: ${record.customers_served}, Avg Wait: ${record.avg_wait_time_minutes || 'N/A'}min`);
    });
    console.log();
    
    // 5. Check daily summary state
    console.log('5. CURRENT DAILY SUMMARY STATE:');
    const dailySummary = await client.query(`
      SELECT * FROM daily_queue_summary 
      WHERE date = CURRENT_DATE
    `);
    
    console.log(`   Found ${dailySummary.rows.length} daily summary records for today:`);
    dailySummary.rows.forEach(record => {
      console.log(`   - Date: ${record.date}, Total Customers: ${record.total_customers}, Total Served: ${record.total_served}, Avg Wait: ${record.avg_wait_time || 'N/A'}min`);
    });
    console.log();
    
    // 6. Check queue events
    console.log('6. RECENT QUEUE EVENTS:');
    const recentEvents = await client.query(`
      SELECT event_type, customer_id, created_at 
      FROM queue_events 
      WHERE DATE(created_at) = CURRENT_DATE
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`   Found ${recentEvents.rows.length} queue events today:`);
    recentEvents.rows.forEach(event => {
      console.log(`   - Type: ${event.event_type}, Customer: ${event.customer_id || 'N/A'}, Time: ${event.created_at}`);
    });
    console.log();
    
    console.log('=== TEST SUMMARY ===');
    console.log(`- Customers created today: ${currentCustomers.rows.length}`);
    console.log(`- Customers already archived today: ${archivedToday.rows.length}`);
    console.log(`- Customers that would be archived on reset: ${affectedCustomers.rows.length}`);
    console.log(`- Analytics records for today: ${analyticsToday.rows.length}`);
    console.log(`- Daily summary records for today: ${dailySummary.rows.length}`);
    console.log(`- Queue events today: ${recentEvents.rows.length}`);
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    client.release();
  }
}

// Run the test
testQueueReset().catch(console.error);
