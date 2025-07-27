import 'dotenv/config';
import { DailyQueueScheduler } from '../services/DailyQueueScheduler';
import { connectDatabase } from '../config/database';

async function testScheduler() {
  try {
    console.log('🧪 Testing Daily Queue Scheduler...');
    
    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected');
    
    // Test scheduler initialization
    console.log('\n📋 Testing scheduler initialization...');
    DailyQueueScheduler.initialize();
    
    // Get scheduler status
    console.log('\n📊 Getting scheduler status...');
    const status = DailyQueueScheduler.getStatus();
    console.log('Scheduler Status:', JSON.stringify(status, null, 2));
    
    // Test timezone validation
    console.log('\n🌏 Testing Philippine timezone support...');
    const moment = require('moment-timezone');
    const philippineTime = moment().tz('Asia/Manila');
    console.log(`Current Philippine Time: ${philippineTime.format('YYYY-MM-DD HH:mm:ss Z')}`);
    
    // Test next reset time calculation
    console.log('\n⏰ Next reset time:', DailyQueueScheduler.getNextResetTime());
    
    // Test manual reset (uncommented for testing)
    console.log('\n🔧 Testing manual reset...');
    await DailyQueueScheduler.triggerManualReset();
    
    console.log('\n✅ All tests completed successfully!');
    
    // Stop scheduler
    DailyQueueScheduler.stop();
    console.log('🛑 Scheduler stopped');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the test
testScheduler();
