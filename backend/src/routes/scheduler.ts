import express, { Router } from 'express';
import { DailyQueueScheduler } from '../services/DailyQueueScheduler';
import { ActivityService } from '../services/activity';

const router: Router = express.Router();

/**
 * Get scheduler status
 */
router.get('/status', async (req, res) => {
  try {
    const status = DailyQueueScheduler.getStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scheduler status'
    });
  }
});

/**
 * Manually trigger daily reset
 */
router.post('/trigger-reset', async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Log the manual trigger attempt
    await ActivityService.log({
      user_id: user.id,
      action: 'manual_daily_reset_triggered',
      details: { 
        username: user.username,
        timestamp: new Date().toISOString()
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent') || 'Unknown'
    });

    // Trigger the reset
    await DailyQueueScheduler.triggerManualReset();
    
    res.json({
      success: true,
      message: 'Daily reset triggered successfully'
    });
  } catch (error) {
    console.error('Error triggering manual reset:', error);
    
    const user = (req as any).user;
    await ActivityService.log({
      user_id: user.id,
      action: 'manual_daily_reset_failed',
      details: { 
        username: user.username,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent') || 'Unknown'
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger reset'
    });
  }
});

/**
 * Stop the scheduler
 */
router.post('/stop', async (req, res) => {
  try {
    const user = (req as any).user;
    
    DailyQueueScheduler.stop();
    
    await ActivityService.log({
      user_id: user.id,
      action: 'scheduler_stopped',
      details: { 
        username: user.username,
        timestamp: new Date().toISOString()
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent') || 'Unknown'
    });
    
    res.json({
      success: true,
      message: 'Scheduler stopped successfully'
    });
  } catch (error) {
    console.error('Error stopping scheduler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop scheduler'
    });
  }
});

/**
 * Start the scheduler
 */
router.post('/start', async (req, res) => {
  try {
    const user = (req as any).user;
    
    DailyQueueScheduler.start();
    
    await ActivityService.log({
      user_id: user.id,
      action: 'scheduler_started',
      details: { 
        username: user.username,
        timestamp: new Date().toISOString()
      },
      ip_address: req.ip,
      user_agent: req.get('User-Agent') || 'Unknown'
    });
    
    res.json({
      success: true,
      message: 'Scheduler started successfully'
    });
  } catch (error) {
    console.error('Error starting scheduler:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start scheduler'
    });
  }
});

export default router;
