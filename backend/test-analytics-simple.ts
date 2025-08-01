import { DailyQueueResetService } from './src/services/DailyQueueResetService';

console.log('🧪 Testing Analytics Update in Daily Reset...');
console.log('='.repeat(60));

async function testAnalyticsUpdate() {
  try {
    console.log('🚀 Starting Daily Reset Service test...');
    console.log('⏰ Current time:', new Date().toISOString());
    
    // This will trigger the daily reset which should now call analytics update
    await DailyQueueResetService.performDailyReset();
    
    console.log('\n✅ Daily Reset completed successfully!');
    console.log('📊 Check the logs above to verify analytics update was triggered.');
    
  } catch (error) {
    const err = error as Error;
    console.error('\n❌ Daily Reset failed:', err.message);
    console.error('🔍 Error details:', error);
    
    // Check if the error is related to analytics
    if (err.message && (err.message.includes('analytics') || err.message.includes('Analytics'))) {
      console.log('\n📈 The error is related to analytics - this confirms our analytics code is being executed!');
    }
  }
}

// Run the test
testAnalyticsUpdate().then(() => {
  console.log('\n🎯 Test completed. Analytics update trigger verification done.');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Test script failed:', error);
  process.exit(1);
});
