// ISOLATED CUSTOMER NOTIFICATION ROUTES
// Completely separate from queue management and SMS notification routes

import express, { Router, Response } from 'express';
import { CustomerNotificationService, CustomerNotificationData } from '../services/CustomerNotificationService';
import { WebSocketService } from '../services/websocket';
import { authenticateToken, requireCashierOrAdmin, logActivity } from '../middleware/auth';
import { AuthRequest } from '../types';

const router: Router = Router();

/**
 * ISOLATED: Get active customer registration notifications for cashiers
 * Route: GET /api/customer-notifications/active
 * Separate from queue management notifications
 */
router.get('/active', 
  authenticateToken, 
  logActivity('get_customer_notifications'), 
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (req.user?.role !== 'cashier') {
        res.status(403).json({ error: 'Only cashiers can view customer registration notifications' });
        return;
      }

      const notifications = await CustomerNotificationService.getActiveNotifications('cashier', req.user.id);
      
      res.json({
        success: true,
        notifications,
        count: notifications.length
      });
      
      console.log(`[CUSTOMER_NOTIFICATION] Retrieved ${notifications.length} active notifications for ${req.user.full_name}`);
      
    } catch (error) {
      console.error('[CUSTOMER_NOTIFICATION] Error getting active notifications:', error);
      res.status(500).json({ error: 'Failed to get notifications' });
    }
  }
);

/**
 * ISOLATED: Mark customer registration notification as read
 * Route: POST /api/customer-notifications/:notificationId/mark-read
 * Separate from queue management notifications
 */
router.post('/:notificationId/mark-read',
  authenticateToken,
  logActivity('mark_customer_notification_read'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (req.user?.role !== 'cashier') {
        res.status(403).json({ error: 'Only cashiers can mark notifications as read' });
        return;
      }

      const { notificationId } = req.params;
      
      if (!notificationId) {
        res.status(400).json({ error: 'Notification ID is required' });
        return;
      }

      await CustomerNotificationService.markAsRead(notificationId, req.user.id);
      
      res.json({
        success: true,
        message: 'Notification marked as read',
        notificationId,
        timestamp: new Date()
      });
      
      console.log(`[CUSTOMER_NOTIFICATION] Notification ${notificationId} marked as read by ${req.user.full_name}`);
      
    } catch (error) {
      console.error('[CUSTOMER_NOTIFICATION] Error marking notification as read:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  }
);

/**
 * ISOLATED: Get notification analytics & statistics for cashiers
 * Route: GET /api/customer-notifications/stats
 * Separate from queue/SMS stats
 * Returns: totals + avg response time as per requirements
 */
router.get('/stats',
  authenticateToken,
  logActivity('get_customer_notification_stats'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (req.user?.role !== 'cashier' && req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      const stats = await CustomerNotificationService.getNotificationAnalytics('cashier');
      
      res.json({
        success: true,
        stats: {
          total_notifications: Number(stats.total_notifications),
          total_active: Number(stats.total_active),
          total_unread: Number(stats.total_unread),
          total_read: Number(stats.total_read),
          expires_soon: Number(stats.expires_soon),
          avg_response_time_minutes: Number(stats.avg_response_time_minutes || 0),
          created_today: Number(stats.created_today),
          read_today: Number(stats.read_today)
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('[CUSTOMER_NOTIFICATION] Error getting notification analytics:', error);
      res.status(500).json({ error: 'Failed to get notification analytics' });
    }
  }
);

/**
 * ISOLATED: Get specific notification details
 * Route: GET /api/customer-notifications/:notificationId
 * Separate from queue management
 */
router.get('/:notificationId',
  authenticateToken,
  logActivity('get_customer_notification_details'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (req.user?.role !== 'cashier') {
        res.status(403).json({ error: 'Only cashiers can view notification details' });
        return;
      }

      const { notificationId } = req.params;
      const notification = await CustomerNotificationService.getNotificationById(notificationId);
      
      if (!notification) {
        res.status(404).json({ error: 'Notification not found' });
        return;
      }

      res.json({
        success: true,
        notification
      });
      
    } catch (error) {
      console.error('[CUSTOMER_NOTIFICATION] Error getting notification details:', error);
      res.status(500).json({ error: 'Failed to get notification details' });
    }
  }
);

/**
 * ISOLATED: Get notification history with pagination and filtering
 * Route: GET /api/customer-notifications/history
 * Query params: page, q, startDate, endDate, priority_type, action
 * Returns paginated list with linked transaction_id if any
 */
router.get('/history',
  authenticateToken,
  logActivity('get_customer_notification_history'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (req.user?.role !== 'cashier' && req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      const {
        page = '1',
        q = '',
        startDate = '',
        endDate = '',
        priority_type = '',
        action = ''
      } = req.query;

      const filters = {
        page: parseInt(page as string) || 1,
        search: q as string,
        startDate: startDate as string,
        endDate: endDate as string,
        priority_type: priority_type as string,
        action: action as string
      };

      const result = await CustomerNotificationService.getNotificationHistory(filters);
      
      res.json({
        success: true,
        notifications: result.notifications,
        pagination: {
          current_page: result.currentPage,
          total_pages: result.totalPages,
          total_records: result.totalRecords,
          per_page: result.perPage,
          has_next: result.currentPage < result.totalPages,
          has_prev: result.currentPage > 1
        },
        filters_applied: filters,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('[CUSTOMER_NOTIFICATION] Error getting notification history:', error);
      res.status(500).json({ error: 'Failed to get notification history' });
    }
  }
);

/**
 * ISOLATED: Manual cleanup of expired notifications (Admin only)
 * Route: POST /api/customer-notifications/cleanup
 * Separate from queue/SMS cleanup
 */
router.post('/cleanup',
  authenticateToken,
  requireCashierOrAdmin,
  logActivity('cleanup_customer_notifications'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Only admins can perform cleanup' });
        return;
      }

      const deletedCount = await CustomerNotificationService.cleanupExpiredNotifications();
      
      res.json({
        success: true,
        message: `Cleaned up ${deletedCount} expired notifications`,
        deletedCount
      });
      
      console.log(`[CUSTOMER_NOTIFICATION] Admin ${req.user.full_name} cleaned up ${deletedCount} expired notifications`);
      
    } catch (error) {
      console.error('[CUSTOMER_NOTIFICATION] Error during cleanup:', error);
      res.status(500).json({ error: 'Failed to cleanup notifications' });
    }
  }
);

/**
 * INTERNAL: Trigger customer registration notification (called by customer creation)
 * This would be called from the customer service when a new customer is created
 * ISOLATED: Does not interfere with queue management
 */
export async function triggerCustomerRegistrationNotification(
  customerData: CustomerNotificationData
): Promise<void> {
  try {
    // Create notification in database
    const notification = await CustomerNotificationService.createCustomerRegistrationNotification(customerData);
    
    // Emit via isolated WebSocket channel
    WebSocketService.emitCustomerRegistrationNotificationIsolated(notification);
    
    console.log(`[CUSTOMER_NOTIFICATION] Triggered isolated notification for customer ${customerData.customer.name}`);
    
  } catch (error) {
    console.error('[CUSTOMER_NOTIFICATION] Error triggering notification:', error);
    // Don't throw - notifications are not critical for customer creation
  }
}

export default router;
