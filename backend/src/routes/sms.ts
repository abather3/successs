import express, { Router, Response } from 'express';
import { authenticateToken, requireCashierOrAdmin, logActivity } from '../middleware/auth';
import { AuthRequest } from '../types';
import { EnhancedSMSService } from '../services/EnhancedSMSService';

const router: express.Router = Router();

// Send SMS notification to customer
router.post('/send', authenticateToken, requireCashierOrAdmin, logActivity('send_sms'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { customerId, customerName, tokenNumber, phoneNumber, notificationType = 'queue_position' } = req.body;

    if (!customerId || !customerName || !phoneNumber) {
      res.status(400).json({ error: 'Customer ID, name, and phone number are required' });
      return;
    }

    let notification;

    switch (notificationType) {
      case 'ready_to_serve':
        notification = await EnhancedSMSService.sendReadyToServeNotification(
          customerId,
          phoneNumber,
          customerName,
          tokenNumber.toString(),
          'Counter 1' // This should be dynamic based on available counter
        );
        break;
      
      case 'queue_position':
        // Get current queue position for the customer
        const position = await getCustomerQueuePosition(customerId);
        const estimatedWait = position * 15; // 15 minutes average per customer
        
        notification = await EnhancedSMSService.sendQueuePositionUpdate(
          customerId,
          phoneNumber,
          customerName,
          position,
          estimatedWait
        );
        break;
      
      case 'delay_notification':
        const newEstimatedWait = parseInt(req.body.estimatedWait) || 30;
        notification = await EnhancedSMSService.sendDelayNotification(
          customerId,
          phoneNumber,
          customerName,
          newEstimatedWait
        );
        break;
      
      case 'customer_ready':
        notification = await EnhancedSMSService.sendCustomerReadyNotification(
          customerId,
          phoneNumber,
          customerName,
          req.body.orderNumber
        );
        break;
      
      case 'pickup_reminder':
        notification = await EnhancedSMSService.sendPickupReminderNotification(
          customerId,
          phoneNumber,
          customerName,
          req.body.orderNumber
        );
        break;
      
      case 'delivery_ready':
        notification = await EnhancedSMSService.sendDeliveryReadyNotification(
          customerId,
          phoneNumber,
          customerName,
          req.body.orderNumber,
          req.body.estimatedDeliveryTime
        );
        break;
      
      default:
        res.status(400).json({ error: 'Invalid notification type' });
        return;
    }

    res.json({
      success: true,
      message: 'SMS notification sent successfully',
      notification
    });

  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({ 
      error: 'Failed to send SMS notification',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get SMS statistics
router.get('/stats', authenticateToken, logActivity('get_sms_stats'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    const dateRange = startDate && endDate ? {
      start: startDate as string,
      end: endDate as string
    } : undefined;

    const stats = await EnhancedSMSService.getSMSStats(dateRange);
    res.json(stats);
  } catch (error) {
    console.error('Error getting SMS stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get SMS templates
router.get('/templates', authenticateToken, logActivity('get_sms_templates'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const templates = await EnhancedSMSService.getTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error getting SMS templates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to get customer queue position
async function getCustomerQueuePosition(customerId: number): Promise<number> {
  const { pool } = require('../config/database');
  
  const query = `
    WITH queue_positions AS (
      SELECT 
        id,
        ROW_NUMBER() OVER (ORDER BY 
          CASE 
            WHEN manual_position IS NOT NULL THEN manual_position
            ELSE
              CASE 
                WHEN priority_flags::json->>'senior_citizen' = 'true' THEN 1000
                WHEN priority_flags::json->>'pwd' = 'true' THEN 900
                WHEN priority_flags::json->>'pregnant' = 'true' THEN 800
                ELSE 0
              END * 100000 + EXTRACT(EPOCH FROM created_at)
          END ASC
        ) as position
      FROM customers
      WHERE queue_status = 'waiting'
    )
    SELECT position
    FROM queue_positions
    WHERE id = $1
  `;
  
  const result = await pool.query(query, [customerId]);
  return result.rows[0]?.position || 1;
}

export default router;
