"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const QueueAnalyticsService_1 = require("../services/QueueAnalyticsService");
const EnhancedSMSService_1 = require("../services/EnhancedSMSService");
const DailyQueueResetService_1 = require("../services/DailyQueueResetService");
const auth_1 = require("../middleware/auth");
const types_1 = require("../types");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
// Apply authentication middleware to all routes
router.use(auth_1.authenticateToken);
/**
 * Get comprehensive analytics dashboard
 */
router.get('/dashboard', (0, auth_1.requireRole)([types_1.UserRole.ADMIN]), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let dateRange;
        if (startDate && endDate) {
            dateRange = {
                start: startDate,
                end: endDate
            };
        }
        const dashboard = await QueueAnalyticsService_1.QueueAnalyticsService.getAnalyticsDashboard(dateRange);
        res.json(dashboard);
    }
    catch (error) {
        console.error('Error fetching analytics dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch analytics dashboard' });
    }
});
/**
 * Get hourly queue analytics
 */
router.get('/hourly', (0, auth_1.requireRole)([types_1.UserRole.ADMIN]), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            res.status(400).json({ error: 'startDate and endDate are required' });
            return;
        }
        const analytics = await QueueAnalyticsService_1.QueueAnalyticsService.getQueueAnalytics(startDate, endDate);
        res.json(analytics);
    }
    catch (error) {
        console.error('Error fetching hourly analytics:', error);
        res.status(500).json({ error: 'Failed to fetch hourly analytics' });
    }
});
/**
 * Get daily queue summaries
 */
router.get('/daily', (0, auth_1.requireRole)([types_1.UserRole.ADMIN]), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            res.status(400).json({ error: 'startDate and endDate are required' });
            return;
        }
        const summaries = await QueueAnalyticsService_1.QueueAnalyticsService.getDailySummaries(startDate, endDate);
        res.json(summaries);
    }
    catch (error) {
        console.error('Error fetching daily summaries:', error);
        res.status(500).json({ error: 'Failed to fetch daily summaries' });
    }
});
/**
 * Update daily summary (manual trigger)
 */
router.post('/update-daily-summary', (0, auth_1.requireRole)([types_1.UserRole.ADMIN]), async (req, res) => {
    try {
        const { date } = req.body;
        await QueueAnalyticsService_1.QueueAnalyticsService.updateDailySummary(date);
        res.json({ message: 'Daily summary updated successfully' });
    }
    catch (error) {
        console.error('Error updating daily summary:', error);
        res.status(500).json({ error: 'Failed to update daily summary' });
    }
});
/**
 * Export analytics data
 */
router.get('/export', (0, auth_1.requireRole)([types_1.UserRole.ADMIN]), async (req, res) => {
    try {
        const { startDate, endDate, type = 'daily', format = 'json' } = req.query;
        if (!startDate || !endDate) {
            res.status(400).json({ error: 'startDate and endDate are required' });
            return;
        }
        const data = await QueueAnalyticsService_1.QueueAnalyticsService.exportAnalytics(startDate, endDate, type);
        if (format === 'csv') {
            // Convert to CSV format
            if (data.length === 0) {
                res.status(404).json({ error: 'No data found for the specified date range' });
                return;
            }
            // Define improved headers for better readability
            const headerMapping = {
                'date': 'Date',
                'hour': 'Hour',
                'totalCustomers': 'Total Customers',
                'priorityCustomers': 'Priority Customers',
                'avgWaitTimeMinutes': 'Avg Wait Time (min)',
                'avgServiceTimeMinutes': 'Avg Service Time (min)',
                'peakQueueLength': 'Peak Queue Length',
                'customersServed': 'Customers Served',
                'avgProcessingDurationMinutes': 'Avg Processing Duration (min)',
                'totalProcessingCount': 'Total Processing Count',
                'maxProcessingDurationMinutes': 'Max Processing Duration (min)',
                'minProcessingDurationMinutes': 'Min Processing Duration (min)',
                'peakHour': 'Peak Hour',
                'busiestCounterId': 'Busiest Counter ID'
            };
            const originalHeaders = Object.keys(data[0]);
            const friendlyHeaders = originalHeaders.map(header => headerMapping[header] || header);
            const csvData = [
                friendlyHeaders.join(','),
                ...data.map(row => originalHeaders.map(header => {
                    const value = row[header];
                    // Handle null/undefined values and format numbers
                    if (value === null || value === undefined) {
                        return '0';
                    }
                    if (typeof value === 'string') {
                        return `"${value.replace(/"/g, '""')}"`; // Escape quotes in CSV
                    }
                    if (typeof value === 'number') {
                        return parseFloat(value.toFixed(2)); // Round to 2 decimal places
                    }
                    return value;
                }).join(','))
            ].join('\n');
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename=queue-analytics-${type}-${startDate}-${endDate}.csv`);
            // Add BOM for proper Excel compatibility
            res.send('\uFEFF' + csvData);
        }
        else {
            res.json(data);
        }
    }
    catch (error) {
        console.error('Error exporting analytics:', error);
        res.status(500).json({ error: 'Failed to export analytics data' });
    }
});
/**
 * Record queue event (for integration with queue management)
 */
router.post('/record-event', (0, auth_1.requireRole)([types_1.UserRole.ADMIN, types_1.UserRole.SALES, types_1.UserRole.CASHIER]), async (req, res) => {
    try {
        const { customerId, eventType, counterId, queuePosition, waitTimeMinutes, serviceTimeMinutes, isPriority } = req.body;
        if (!customerId || !eventType) {
            res.status(400).json({ error: 'customerId and eventType are required' });
            return;
        }
        await QueueAnalyticsService_1.QueueAnalyticsService.recordQueueEvent({
            customerId,
            eventType,
            counterId,
            queuePosition,
            waitTimeMinutes,
            serviceTimeMinutes,
            isPriority: isPriority || false
        });
        res.json({ message: 'Queue event recorded successfully' });
    }
    catch (error) {
        console.error('Error recording queue event:', error);
        res.status(500).json({ error: 'Failed to record queue event' });
    }
});
/**
 * Get SMS statistics
 */
router.get('/sms-stats', (0, auth_1.requireRole)([types_1.UserRole.ADMIN]), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let dateRange;
        if (startDate && endDate) {
            dateRange = {
                start: startDate,
                end: endDate
            };
        }
        const stats = await EnhancedSMSService_1.EnhancedSMSService.getSMSStats(dateRange);
        res.json(stats);
    }
    catch (error) {
        console.error('Error fetching SMS stats:', error);
        res.status(500).json({ error: 'Failed to fetch SMS statistics' });
    }
});
/**
 * Get SMS templates
 */
router.get('/sms-templates', (0, auth_1.requireRole)([types_1.UserRole.ADMIN]), async (req, res) => {
    try {
        const templates = await EnhancedSMSService_1.EnhancedSMSService.getTemplates();
        res.json(templates);
    }
    catch (error) {
        console.error('Error fetching SMS templates:', error);
        res.status(500).json({ error: 'Failed to fetch SMS templates' });
    }
});
/**
 * Update SMS template
 */
router.put('/sms-templates/:templateName', (0, auth_1.requireRole)([types_1.UserRole.ADMIN]), async (req, res) => {
    try {
        const { templateName } = req.params;
        const { templateContent } = req.body;
        if (!templateContent) {
            res.status(400).json({ error: 'templateContent is required' });
            return;
        }
        await EnhancedSMSService_1.EnhancedSMSService.updateTemplate(templateName, templateContent);
        res.json({ message: 'SMS template updated successfully' });
    }
    catch (error) {
        console.error('Error updating SMS template:', error);
        res.status(500).json({ error: 'Failed to update SMS template' });
    }
});
/**
 * Get recent SMS notifications
 */
router.get('/sms-notifications', (0, auth_1.requireRole)([types_1.UserRole.ADMIN]), async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const result = await EnhancedSMSService_1.EnhancedSMSService.getRecentNotifications(parseInt(page), parseInt(limit));
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching SMS notifications:', error);
        res.status(500).json({ error: 'Failed to fetch SMS notifications' });
    }
});
/**
 * Get queue activities log
 */
router.get('/queue-activities', (0, auth_1.requireRole)([types_1.UserRole.ADMIN]), async (req, res) => {
    try {
        const { startDate, endDate, limit = 50 } = req.query;
        let dateFilter = '';
        let params = [];
        if (startDate && endDate) {
            dateFilter = 'WHERE DATE(qe.created_at) BETWEEN $1 AND $2';
            params = [startDate, endDate, parseInt(limit)];
        }
        else {
            dateFilter = 'WHERE DATE(qe.created_at) = CURRENT_DATE';
            params = [parseInt(limit)];
        }
        const query = `
      SELECT 
        qe.id,
        qe.customer_id,
        qe.event_type,
        qe.queue_position,
        qe.wait_time_minutes,
        qe.service_time_minutes,
        qe.is_priority,
        qe.created_at,
        c.name as counter_name,
        COALESCE(cust.name, 'Unknown Customer') as customer_name,
        COALESCE(cust.or_number, 'N/A') as or_number
      FROM queue_events qe
      LEFT JOIN counters c ON qe.counter_id = c.id
      LEFT JOIN customers cust ON qe.customer_id = cust.id
      ${dateFilter}
      ORDER BY qe.created_at DESC
      LIMIT $${params.length}
    `;
        const result = await database_1.pool.query(query, params);
        res.json({
            activities: result.rows,
            total: result.rows.length
        });
    }
    catch (error) {
        console.error('Error fetching queue activities:', error);
        res.status(500).json({ error: 'Failed to fetch queue activities' });
    }
});
/**
 * Get customer notification history
 */
router.get('/sms-notifications/customer/:customerId', (0, auth_1.requireRole)([types_1.UserRole.ADMIN, types_1.UserRole.SALES]), async (req, res) => {
    try {
        const { customerId } = req.params;
        const notifications = await EnhancedSMSService_1.EnhancedSMSService.getCustomerNotificationHistory(parseInt(customerId));
        res.json(notifications);
    }
    catch (error) {
        console.error('Error fetching customer notification history:', error);
        res.status(500).json({ error: 'Failed to fetch customer notification history' });
    }
});
/**
 * Retry failed SMS notifications
 */
router.post('/sms-notifications/:id/retry', (0, auth_1.requireRole)([types_1.UserRole.ADMIN]), async (req, res) => {
    try {
        const { id } = req.params;
        // For individual retry, we'll mark it for retry and let the batch process handle it
        const updateQuery = `
      UPDATE sms_notifications 
      SET status = 'pending', retry_count = COALESCE(retry_count, 0) + 1
      WHERE id = $1 AND status = 'failed'
      RETURNING id
    `;
        const result = await database_1.pool.query(updateQuery, [parseInt(id)]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Failed notification not found' });
            return;
        }
        res.json({
            message: 'SMS notification marked for retry',
            success: true,
            id: result.rows[0].id
        });
    }
    catch (error) {
        console.error('Error retrying SMS notification:', error);
        res.status(500).json({ error: 'Failed to retry SMS notification' });
    }
});
/**
 * Get Historical Analytics Dashboard
 * This provides data for the Historical Queue Analytics dashboard
 */
router.get('/historical-dashboard', (0, auth_1.requireRole)([types_1.UserRole.ADMIN, types_1.UserRole.SALES, types_1.UserRole.CASHIER]), async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const numDays = parseInt(days);
        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - numDays);
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        // Get daily queue history
        const dailyHistoryQuery = `
      SELECT 
        date,
        total_customers as "totalCustomers",
        waiting_customers as "waitingCustomers",
        serving_customers as "servingCustomers",
        processing_customers as "processingCustomers",
        completed_customers as "completedCustomers",
        cancelled_customers as "cancelledCustomers",
        priority_customers as "priorityCustomers",
        avg_wait_time_minutes as "avgWaitTime",
        peak_queue_length as "peakQueueLength",
        operating_hours as "operatingHours"
      FROM daily_queue_history
      WHERE date >= $1 AND date <= $2
      ORDER BY date DESC
    `;
        const dailyHistoryResult = await database_1.pool.query(dailyHistoryQuery, [startDateStr, endDateStr]);
        // Get display monitor history
        const displayHistoryQuery = `
      SELECT 
        date,
        daily_customers_served,
        daily_avg_wait_time,
        daily_peak_queue_length,
        daily_priority_customers,
        operating_efficiency,
        created_at
      FROM display_monitor_history
      WHERE date >= $1 AND date <= $2
      ORDER BY date DESC
    `;
        const displayHistoryResult = await database_1.pool.query(displayHistoryQuery, [startDateStr, endDateStr]);
        // Get reset logs
        const resetLogsQuery = `
      SELECT 
        id,
        reset_date,
        customers_processed as "customers_archived",
        customers_carried_forward,
        customers_processed + customers_carried_forward as "queues_reset",
        success,
        error_message,
        duration_ms,
        reset_timestamp as "created_at"
      FROM daily_reset_log
      WHERE reset_date >= $1 AND reset_date <= $2
      ORDER BY reset_date DESC
    `;
        const resetLogsResult = await database_1.pool.query(resetLogsQuery, [startDateStr, endDateStr]);
        // Calculate summary statistics
        const totalCustomers = dailyHistoryResult.rows.reduce((sum, row) => sum + (row.totalCustomers || 0), 0);
        const avgWaitTime = dailyHistoryResult.rows.length > 0
            ? dailyHistoryResult.rows.reduce((sum, row) => sum + (row.avgWaitTime || 0), 0) / dailyHistoryResult.rows.length
            : 0;
        const successfulResets = resetLogsResult.rows.filter(row => row.success).length;
        const failedResets = resetLogsResult.rows.filter(row => !row.success).length;
        const resetSuccessRate = resetLogsResult.rows.length > 0
            ? Math.round((successfulResets / resetLogsResult.rows.length) * 100)
            : 100;
        const dashboard = {
            success: true,
            period: {
                days: numDays,
                start_date: startDateStr,
                end_date: endDateStr
            },
            summary: {
                total_customers_served: totalCustomers,
                average_wait_time_minutes: Math.round(avgWaitTime * 100) / 100,
                successful_resets: successfulResets,
                failed_resets: failedResets,
                reset_success_rate: resetSuccessRate
            },
            daily_queue_history: dailyHistoryResult.rows,
            display_monitor_history: displayHistoryResult.rows,
            reset_logs: resetLogsResult.rows
        };
        res.json(dashboard);
    }
    catch (error) {
        console.error('Error fetching historical dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch historical analytics dashboard' });
    }
});
/**
 * Get Customer History (archived customers)
 * This provides paginated customer history data
 */
router.get('/customer-history', (0, auth_1.requireRole)([types_1.UserRole.ADMIN, types_1.UserRole.SALES, types_1.UserRole.CASHIER]), async (req, res) => {
    try {
        const { days = 30, page = 1, limit = 20 } = req.query;
        const numDays = parseInt(days);
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;
        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - numDays);
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        // Get customer history with pagination
        const customerHistoryQuery = `
      SELECT 
        id,
        original_customer_id,
        name,
        email,
        phone,
        queue_status,
        token_number,
        priority_flags,
        created_at,
        served_at,
        archive_date,
        EXTRACT(EPOCH FROM (COALESCE(served_at, archive_date::timestamp) - created_at)) / 60 as wait_time_minutes,
        CASE 
          WHEN served_at IS NOT NULL AND created_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (served_at - created_at)) / 60
          ELSE 0
        END as service_duration_minutes,
        false as carried_forward
      FROM customer_history
      WHERE archive_date >= $1 AND archive_date <= $2
      ORDER BY archive_date DESC, created_at DESC
      LIMIT $3 OFFSET $4
    `;
        const customerHistoryResult = await database_1.pool.query(customerHistoryQuery, [
            startDateStr, endDateStr, limitNum, offset
        ]);
        // Get total count for pagination
        const countQuery = `
      SELECT COUNT(*) as total
      FROM customer_history
      WHERE archive_date >= $1 AND archive_date <= $2
    `;
        const countResult = await database_1.pool.query(countQuery, [startDateStr, endDateStr]);
        const totalRecords = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(totalRecords / limitNum);
        const response = {
            success: true,
            data: customerHistoryResult.rows,
            pagination: {
                current_page: pageNum,
                total_pages: totalPages,
                total_records: totalRecords,
                per_page: limitNum,
                has_next: pageNum < totalPages,
                has_prev: pageNum > 1
            }
        };
        res.json(response);
    }
    catch (error) {
        console.error('Error fetching customer history:', error);
        res.status(500).json({ error: 'Failed to fetch customer history' });
    }
});
router.post('/sms-notifications/retry-failed', (0, auth_1.requireRole)([types_1.UserRole.ADMIN]), async (req, res) => {
    try {
        const { maxRetries = 5 } = req.body;
        const successCount = await EnhancedSMSService_1.EnhancedSMSService.retryFailedNotifications(maxRetries);
        res.json({
            message: `Retry completed. ${successCount} notifications sent successfully.`,
            successCount
        });
    }
    catch (error) {
        console.error('Error retrying failed SMS notifications:', error);
        res.status(500).json({ error: 'Failed to retry SMS notifications' });
    }
});
/**
 * Get daily queue history from scheduler archival
 */
router.get('/daily-queue-history', (0, auth_1.requireRole)([types_1.UserRole.ADMIN, types_1.UserRole.SALES, types_1.UserRole.CASHIER]), async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const history = await DailyQueueResetService_1.DailyQueueResetService.getDailyHistory(parseInt(days));
        res.json({
            success: true,
            data: history,
            days: parseInt(days),
            description: 'Daily queue history from automatic scheduler archival'
        });
    }
    catch (error) {
        console.error('Error fetching daily queue history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch daily queue history'
        });
    }
});
/**
 * Get display monitor history from scheduler archival
 */
router.get('/display-monitor-history', (0, auth_1.requireRole)([types_1.UserRole.ADMIN, types_1.UserRole.SALES, types_1.UserRole.CASHIER]), async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const history = await DailyQueueResetService_1.DailyQueueResetService.getDisplayMonitorHistory(parseInt(days));
        res.json({
            success: true,
            data: history,
            days: parseInt(days),
            description: 'Display monitor performance history from daily scheduler'
        });
    }
    catch (error) {
        console.error('Error fetching display monitor history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch display monitor history'
        });
    }
});
/**
 * Get daily reset logs
 */
router.get('/daily-reset-logs', (0, auth_1.requireRole)([types_1.UserRole.ADMIN]), async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const query = `
      SELECT 
        id,
        reset_date,
        customers_processed as customers_archived,
        customers_carried_forward,
        customers_processed + customers_carried_forward as queues_reset,
        success,
        error_message,
        duration_ms,
        reset_timestamp as created_at
      FROM daily_reset_log
      WHERE reset_date >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      ORDER BY reset_date DESC
    `;
        const result = await database_1.pool.query(query);
        res.json({
            success: true,
            data: result.rows,
            days: parseInt(days),
            description: 'Daily queue reset operation logs from scheduler'
        });
    }
    catch (error) {
        console.error('Error fetching daily reset logs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch daily reset logs'
        });
    }
});
exports.default = router;
//# sourceMappingURL=analytics.js.map