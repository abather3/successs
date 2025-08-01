import { pool } from './src/config/database';
import { QueueService } from './src/services/queue';

console.log('🔍 Testing Queue Reset Flow - Data Analysis');
console.log('='.repeat(70));

async function analyzeBeforeReset() {
  console.log('\n📊 BEFORE RESET - Current State:');
  console.log('-'.repeat(50));
  
  // Check current customers
  const customers = await pool.query(`
    SELECT id, name, queue_status, token_number, created_at, served_at
    FROM customers 
    WHERE queue_status IN ('waiting', 'serving', 'processing', 'completed') 
    ORDER BY created_at DESC
  `);
  
  console.log('📋 Current Customers:');
  customers.rows.forEach(c => {
    console.log(`   - ${c.name} (${c.id}): ${c.queue_status} - Token #${c.token_number}`);
  });
  
  // Check customer_history before reset
  const historyBefore = await pool.query(`
    SELECT COUNT(*) as count, archive_date, queue_status
    FROM customer_history 
    GROUP BY archive_date, queue_status 
    ORDER BY archive_date DESC
  `);
  
  console.log('\n📚 Customer History (Before Reset):');
  historyBefore.rows.forEach(h => {
    console.log(`   - ${h.archive_date}: ${h.count} customers with status '${h.queue_status}'`);
  });
  
  // Check analytics tables before reset
  const analytics = await pool.query(`
    SELECT COUNT(*) as count FROM daily_queue_summary WHERE date = CURRENT_DATE
  `);
  console.log(`\n📈 Daily Analytics Records (Today): ${analytics.rows[0].count}`);
  
  return customers.rows;
}

async function performQueueReset() {
  console.log('\n🚀 PERFORMING QUEUE RESET...');
  console.log('-'.repeat(50));
  
  try {
    // Simulate admin user ID
    const adminId = 1;
    const reason = 'Test reset for analytics verification';
    
    const result = await QueueService.resetQueue(adminId, reason);
    
    console.log('✅ Queue Reset Result:');
    console.log(`   - Cancelled: ${result.cancelled} customers`);
    console.log(`   - Completed: ${result.completed} customers`);
    console.log(`   - Message: ${result.message}`);
    
    return result;
  } catch (error) {
    console.error('❌ Queue reset failed:', error);
    throw error;
  }
}

async function analyzeAfterReset() {
  console.log('\n📊 AFTER RESET - Data Analysis:');
  console.log('-'.repeat(50));
  
  // Check remaining customers
  const remainingCustomers = await pool.query(`
    SELECT id, name, queue_status, token_number, created_at, served_at, remarks
    FROM customers 
    WHERE queue_status IN ('waiting', 'serving', 'processing', 'completed', 'cancelled') 
    ORDER BY updated_at DESC
    LIMIT 20
  `);
  
  console.log('📋 Customers After Reset (Recent 20):');
  remainingCustomers.rows.forEach(c => {
    const status = c.queue_status;
    const statusEmoji = status === 'completed' ? '✅' : status === 'cancelled' ? '❌' : '⏳';
    console.log(`   ${statusEmoji} ${c.name} (${c.id}): ${status} - Token #${c.token_number}`);
    if (c.remarks && c.remarks.includes('Queue Reset')) {
      console.log(`      📝 Reset Reason: ${c.remarks.split('Queue Reset: ')[1] || 'Unknown'}`);
    }
  });
  
  // Check customer_history after reset
  const historyAfter = await pool.query(`
    SELECT 
      COUNT(*) as count, 
      archive_date, 
      queue_status,
      MAX(archived_at) as latest_archive
    FROM customer_history 
    WHERE archive_date = CURRENT_DATE
    GROUP BY archive_date, queue_status 
    ORDER BY archive_date DESC, queue_status
  `);
  
  console.log('\n📚 Customer History (After Reset - Today Only):');
  if (historyAfter.rows.length === 0) {
    console.log('   ⚠️  NO CUSTOMERS FOUND IN HISTORY FOR TODAY!');
  } else {
    historyAfter.rows.forEach(h => {
      console.log(`   - ${h.archive_date}: ${h.count} customers with status '${h.queue_status}' (archived at ${h.latest_archive})`);
    });
  }
  
  // Check analytics after reset
  const analyticsAfter = await pool.query(`
    SELECT * FROM daily_queue_summary 
    WHERE date = CURRENT_DATE
    ORDER BY updated_at DESC
    LIMIT 1
  `);
  
  console.log('\n📈 Analytics After Reset:');
  if (analyticsAfter.rows.length === 0) {
    console.log('   ⚠️  NO ANALYTICS RECORDS FOUND FOR TODAY!');
  } else {
    const a = analyticsAfter.rows[0];
    console.log(`   - Date: ${a.date}`);
    console.log(`   - Total Customers: ${a.total_customers}`);
    console.log(`   - Customers Served: ${a.customers_served}`);
    console.log(`   - Avg Wait Time: ${a.avg_wait_time_minutes} minutes`);
    console.log(`   - Peak Queue Length: ${a.peak_queue_length}`);
    console.log(`   - Updated At: ${a.updated_at}`);
  }
  
  // Check queue_events for analytics data
  const queueEvents = await pool.query(`
    SELECT 
      event_type, 
      COUNT(*) as count,
      MAX(created_at) as latest_event
    FROM queue_events 
    WHERE DATE(created_at) = CURRENT_DATE
    GROUP BY event_type
    ORDER BY count DESC
  `);
  
  console.log('\n🎯 Queue Events Today (for analytics):');
  if (queueEvents.rows.length === 0) {
    console.log('   ⚠️  NO QUEUE EVENTS FOUND FOR TODAY!');
  } else {
    queueEvents.rows.forEach(e => {
      console.log(`   - ${e.event_type}: ${e.count} events (latest: ${e.latest_event})`);
    });
  }
}

async function runFullTest() {
  try {
    // Analyze current state
    const customersBefore = await analyzeBeforeReset();
    
    if (customersBefore.length === 0) {
      console.log('\n⚠️  No customers found to test with. Creating test customers...');
      
      // Create some test customers
      await pool.query(`
        INSERT INTO customers (name, contact_number, or_number, queue_status, token_number, priority_flags, created_at)
        VALUES 
        ('Test Customer 1', '09123456789', 'OR001', 'waiting', 1, '{"senior_citizen": false, "pregnant": false, "pwd": false}', NOW()),
        ('Test Customer 2', '09123456788', 'OR002', 'serving', 2, '{"senior_citizen": true, "pregnant": false, "pwd": false}', NOW() - INTERVAL '5 minutes'),
        ('Test Customer 3', '09123456787', 'OR003', 'processing', 3, '{"senior_citizen": false, "pregnant": false, "pwd": false}', NOW() - INTERVAL '10 minutes')
      `);
      
      console.log('✅ Test customers created. Re-analyzing...');
      await analyzeBeforeReset();
    }
    
    // Perform the reset
    await performQueueReset();
    
    // Analyze results
    await analyzeAfterReset();
    
    console.log('\n🎯 SUMMARY:');
    console.log('='.repeat(50));
    console.log('✅ Queue reset executed successfully');
    console.log('✅ Check the logs above to see if:');
    console.log('   1. Customers were properly archived to customer_history');
    console.log('   2. Analytics were updated in daily_queue_summary');
    console.log('   3. Queue events were recorded for analytics tracking');
    
  } catch (error) {
    console.error('\n💥 Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
runFullTest();
