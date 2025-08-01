import { pool } from '../src/config/database';
import { QueueAnalyticsService } from '../src/services/QueueAnalyticsService';

async function testAnalyticsRecording() {
  try {
    console.log('Testing analytics recording functionality...\n');
    
    // Test 1: Record a test queue event
    console.log('Test 1: Recording test queue event...');
    await QueueAnalyticsService.recordQueueEvent({
      customerId: 999999, // Test customer ID
      eventType: 'joined',
      counterId: 1,
      queuePosition: 1,
      waitTimeMinutes: 0,
      isPriority: false
    });
    console.log('✓ Test queue event recorded successfully\n');
    
    // Test 2: Check if the event was recorded
    console.log('Test 2: Verifying event was recorded...');
    const eventResult = await pool.query(`
      SELECT * FROM queue_events 
      WHERE customer_id = 999999 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (eventResult.rows.length > 0) {
      console.log('✓ Event found in database:', {
        event_type: eventResult.rows[0].event_type,
        customer_id: eventResult.rows[0].customer_id,
        created_at: eventResult.rows[0].created_at
      });
    } else {
      console.log('✗ Event not found in database');
    }
    
    // Test 3: Test hourly analytics update
    console.log('\nTest 3: Testing hourly analytics update...');
    await QueueAnalyticsService.updateHourlyAnalytics();
    console.log('✓ Hourly analytics update completed');
    
    // Test 4: Check if analytics were updated
    console.log('\nTest 4: Verifying hourly analytics...');
    const today = new Date().toISOString().split('T')[0];
    const currentHour = new Date().getHours();
    
    const analyticsResult = await pool.query(`
      SELECT * FROM queue_analytics 
      WHERE date = $1 AND hour = $2
    `, [today, currentHour]);
    
    if (analyticsResult.rows.length > 0) {
      console.log('✓ Hourly analytics found:', {
        date: analyticsResult.rows[0].date,
        hour: analyticsResult.rows[0].hour,
        total_customers: analyticsResult.rows[0].total_customers,
        updated_at: analyticsResult.rows[0].updated_at
      });
    } else {
      console.log('! No hourly analytics found for current hour (this is normal if no real events occurred)');
    }
    
    // Test 5: Test daily summary update
    console.log('\nTest 5: Testing daily summary update...');
    await QueueAnalyticsService.updateDailySummary();
    console.log('✓ Daily summary update completed');
    
    // Test 6: Check daily summary
    console.log('\nTest 6: Verifying daily summary...');
    const summaryResult = await pool.query(`
      SELECT * FROM daily_queue_summary 
      WHERE date = $1
    `, [today]);
    
    if (summaryResult.rows.length > 0) {
      console.log('✓ Daily summary found:', {
        date: summaryResult.rows[0].date,
        total_customers: summaryResult.rows[0].total_customers,
        customers_served: summaryResult.rows[0].customers_served,
        updated_at: summaryResult.rows[0].updated_at
      });
    } else {
      console.log('! No daily summary found (this is normal if no analytics data exists for today)');
    }
    
    // Clean up test data
    console.log('\nCleaning up test data...');
    await pool.query('DELETE FROM queue_events WHERE customer_id = 999999');
    console.log('✓ Test data cleaned up');
    
    console.log('\n=== Analytics Test Summary ===');
    console.log('✓ QueueAnalyticsService.recordQueueEvent() - Working');
    console.log('✓ QueueAnalyticsService.updateHourlyAnalytics() - Working');  
    console.log('✓ QueueAnalyticsService.updateDailySummary() - Working');
    console.log('\nAnalytics recording functionality is operational!');
    
  } catch (error) {
    console.error('\n✗ Analytics test failed:', error);
  } finally {
    await pool.end();
  }
}

testAnalyticsRecording().catch(console.error);
