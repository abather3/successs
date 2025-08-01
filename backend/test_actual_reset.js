const { QueueService } = require('./dist/services/queue');

async function testActualReset() {
  try {
    console.log('=== TESTING ACTUAL QUEUE RESET ===\n');
    
    // Test the queue reset with admin ID and reason
    const adminId = 1; // Using admin ID 1
    const reason = 'Testing queue reset functionality';
    
    console.log(`Calling QueueService.resetQueue with:`);
    console.log(`- Admin ID: ${adminId}`);
    console.log(`- Reason: ${reason}\n`);
    
    const resetResult = await QueueService.resetQueue(adminId, reason);
    
    console.log('Reset Result:', JSON.stringify(resetResult, null, 2));
    
    if (resetResult && (resetResult.cancelled !== undefined || resetResult.completed !== undefined)) {
      console.log('\n✅ Queue reset completed successfully!');
      console.log(`- Customers cancelled: ${resetResult.cancelled || 0}`);
      console.log(`- Customers completed: ${resetResult.completed || 0}`);
      console.log(`- Message: ${resetResult.message}`);
    } else {
      console.log('\n❌ Queue reset failed!');
      console.log(`- Error: ${resetResult.error || 'Unknown error'}`);
    }
    
  } catch (error) {
    console.error('Error during reset test:', error);
  }
}

// Run the test
testActualReset().catch(console.error);
