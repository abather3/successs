#!/usr/bin/env ts-node

import 'dotenv/config';
import { connectDatabase } from '../src/config/database';
import { DailyQueueScheduler } from '../src/services/DailyQueueScheduler';

async function triggerManualReset() {
  try {
    console.log('🚀 Starting Manual Daily Queue Reset...');
    console.log('⏰ Timestamp:', new Date().toISOString());
    
    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected');
    
    // Trigger the manual reset
    await DailyQueueScheduler.triggerManualReset();
    
    console.log('✅ Manual daily queue reset completed successfully!');
    
    // Get scheduler status to verify
    const status = DailyQueueScheduler.getStatus();
    console.log('📊 Scheduler Status:', {
      isScheduled: status.isScheduled,
      isRunning: status.isRunning,
      nextReset: status.nextReset,
      lastReset: status.lastReset,
      timezone: status.timezone
    });
    
  } catch (error) {
    console.error('❌ Manual reset failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    process.exit(0);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT signal, shutting down gracefully');
  process.exit(0);
});

// Run the manual reset
triggerManualReset();
