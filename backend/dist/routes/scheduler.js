"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const DailyQueueScheduler_1 = require("../services/DailyQueueScheduler");
const activity_1 = require("../services/activity");
const router = express_1.default.Router();
/**
 * Get scheduler status
 */
router.get('/status', async (req, res) => {
    try {
        const status = DailyQueueScheduler_1.DailyQueueScheduler.getStatus();
        res.json({
            success: true,
            data: status
        });
    }
    catch (error) {
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
        const user = req.user;
        // Log the manual trigger attempt
        await activity_1.ActivityService.log({
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
        await DailyQueueScheduler_1.DailyQueueScheduler.triggerManualReset();
        res.json({
            success: true,
            message: 'Daily reset triggered successfully'
        });
    }
    catch (error) {
        console.error('Error triggering manual reset:', error);
        const user = req.user;
        await activity_1.ActivityService.log({
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
        const user = req.user;
        DailyQueueScheduler_1.DailyQueueScheduler.stop();
        await activity_1.ActivityService.log({
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
    }
    catch (error) {
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
        const user = req.user;
        DailyQueueScheduler_1.DailyQueueScheduler.start();
        await activity_1.ActivityService.log({
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
    }
    catch (error) {
        console.error('Error starting scheduler:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to start scheduler'
        });
    }
});
exports.default = router;
//# sourceMappingURL=scheduler.js.map