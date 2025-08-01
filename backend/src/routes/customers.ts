import express, { Router, Response } from 'express';
import { CustomerService } from '../services/customer';
import { NotificationService } from '../services/notification';
import { ExportService } from '../services/export';
import { WebSocketService } from '../services/websocket';
import { UserService } from '../services/user';
const { authenticateToken, requireSalesOrAdmin, requireAdmin, logActivity } = require('../middleware/auth');
import { requireCustomerOwnership, getSalesAgentFilter } from '../middleware/ownership';
import { AuthRequest, QueueStatus } from '../types';
import { pool } from '../config/database';
import { validateSchema } from '../middleware/validation';
import {
  createCustomerSchema,
  updateCustomerSchema,
  updateCustomerStatusSchema,
  notifyCustomerSchema
} from '../validation/schemas/customer';

const router: express.Router = Router();

// Create customer
router.post('/', authenticateToken, requireSalesOrAdmin, validateSchema(createCustomerSchema), logActivity('create_customer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const customerData = {
      ...req.body,
      sales_agent_id: req.user!.id,
      create_initial_transaction: req.body.create_initial_transaction !== undefined ? req.body.create_initial_transaction : true
    };

    const customer = await CustomerService.create(customerData);
    
    // Send customer registration notification to cashiers
    try {
      const salesAgent = await UserService.findById(req.user!.id);
      WebSocketService.emitCustomerRegistrationNotification({
        customer,
        created_by: req.user!.id,
        created_by_name: salesAgent?.full_name || 'Sales Agent',
        location_id: 1 // Default location, can be made dynamic based on user context
      });
      console.log(`[CUSTOMER_REGISTRATION] Notification sent for new customer: ${customer.name} (${customer.or_number})`);
    } catch (notificationError) {
      console.error('Error sending registration notification:', notificationError);
      // Don't fail the customer creation if notification fails
    }
    
    res.status(201).json(customer);
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List customers - Enhanced for cashier access
router.get('/', authenticateToken, logActivity('list_customers'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, salesAgentId, startDate, endDate, searchTerm, sortBy = 'created_at', sortOrder = 'desc', page = '1', limit = '20' } = req.query;
    
    // Apply role-based filtering:
    // - Sales agents: Only see their own customers
    // - Cashiers: See all customers for transaction processing
    // - Admins: See all customers
    let effectiveSalesAgentId: number | undefined;
    
    if (req.user!.role === 'sales') {
      // Sales agents can only see their own customers
      effectiveSalesAgentId = req.user!.id;
    } else if (req.user!.role === 'cashier') {
      // Cashiers can see all customers or filter by specific sales agent
      effectiveSalesAgentId = salesAgentId ? parseInt(salesAgentId as string, 10) : undefined;
    } else if (req.user!.role === 'admin') {
      // Admins can see all customers or filter by specific sales agent
      effectiveSalesAgentId = salesAgentId ? parseInt(salesAgentId as string, 10) : undefined;
    }
    
    const filters = {
      status: status as QueueStatus,
      salesAgentId: effectiveSalesAgentId,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      searchTerm: searchTerm as string
    };

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    const result = await CustomerService.list(filters, limitNum, offset, sortBy as string, sortOrder as 'asc' | 'desc');
    
    res.json({
      customers: result.customers,
      pagination: {
        current_page: pageNum,
        per_page: limitNum,
        total: result.total,
        total_pages: Math.ceil(result.total / limitNum)
      },
      user_context: {
        role: req.user!.role,
        can_create: req.user!.role === 'sales' || req.user!.role === 'admin',
        can_edit: true, // All authenticated users can edit customers
        can_export: true
      }
    });
  } catch (error) {
    console.error('Error listing customers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get customer by ID
router.get('/:id', authenticateToken, requireCustomerOwnership, logActivity('get_customer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const customerId = Number(id);
    if (!Number.isInteger(customerId)) {
      res.status(400).json({ error: 'Invalid customer id' });
      return;
    }

    const customer = await CustomerService.findById(customerId);

    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    res.json(customer);
  } catch (error) {
    console.error('Error getting customer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get customer by OR number
router.get('/or/:orNumber', authenticateToken, logActivity('get_customer_by_or'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orNumber } = req.params;
    const customer = await CustomerService.findByOrNumber(orNumber);

    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    res.json(customer);
  } catch (error) {
    console.error('Error getting customer by OR number:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update customer - Allow cashiers to update customer info
router.put('/:id', authenticateToken, requireCustomerOwnership, validateSchema(updateCustomerSchema), logActivity('update_customer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const customerId = Number(id);
    if (!Number.isInteger(customerId)) {
      res.status(400).json({ error: 'Invalid customer id' });
      return;
    }

    const updates = req.body;
    
    const customer = await CustomerService.update(customerId, updates);
    res.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    if (error instanceof Error && error.message === 'Customer not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Update customer status
router.patch('/:id/status', authenticateToken, validateSchema(updateCustomerStatusSchema), logActivity('update_customer_status'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const customerId = Number(id);
    if (!Number.isInteger(customerId)) {
      res.status(400).json({ error: 'Invalid customer id' });
      return;
    }

    const { status } = req.body;

    if (!Object.values(QueueStatus).includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    const customer = await CustomerService.updateStatus(customerId, status);
    res.json(customer);
  } catch (error) {
    console.error('Error updating customer status:', error);
    if (error instanceof Error && error.message === 'Customer not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Delete customer
router.delete('/:id', authenticateToken, requireAdmin, logActivity('delete_customer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const customerId = Number(id);
    if (!Number.isInteger(customerId)) {
      res.status(400).json({ error: 'Invalid customer id' });
      return;
    }

    await CustomerService.delete(customerId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting customer:', error);
    if (error instanceof Error && error.message === 'Customer not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Send notification to customer
router.post('/:id/notify', authenticateToken, requireSalesOrAdmin, requireCustomerOwnership, validateSchema(notifyCustomerSchema), logActivity('notify_customer'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const customerId = Number(id);
    if (!Number.isInteger(customerId)) {
      res.status(400).json({ error: 'Invalid customer id' });
      return;
    }

    const { type, customMessage } = req.body;

    const customer = await CustomerService.findById(customerId);
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    try {
      switch (type) {
        case 'ready':
          await NotificationService.sendCustomerReadyNotification(
            customer.id,
            customer.name,
            customer.contact_number
          );
          break;
        case 'delay':
          const estimatedTime = req.body.estimated_time;
          const totalMinutes = estimatedTime ? CustomerService.estimatedTimeToMinutes(estimatedTime) : CustomerService.estimatedTimeToMinutes(customer.estimated_time);
          await NotificationService.sendDelayNotification(
            customer.id,
            customer.name,
            customer.contact_number,
            totalMinutes
          );
          break;
        case 'pickup_reminder':
          await NotificationService.sendPickupReminder(
            customer.id,
            customer.name,
            customer.contact_number
          );
          break;
        case 'custom':
          if (!customMessage) {
            res.status(400).json({ error: 'Custom message is required' });
            return;
          }
          await NotificationService.sendSMS(
            customer.contact_number,
            customMessage,
            customer.id
          );
          break;
        default:
          res.status(400).json({ error: 'Invalid notification type' });
          return;
      }

      res.json({ message: 'Notification sent successfully' });
    } catch (notificationError) {
      console.error('Error sending notification:', notificationError);
      res.status(500).json({ error: 'Failed to send notification' });
    }
  } catch (error) {
    console.error('Error in notify customer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get queue statistics
router.get('/stats/queue', authenticateToken, logActivity('get_queue_stats'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await CustomerService.getQueueStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Error getting queue statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get sales agent statistics
router.get('/stats/sales-agent', authenticateToken, requireSalesOrAdmin, logActivity('get_sales_agent_stats'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const salesAgentId = getSalesAgentFilter(req.user!) || req.user!.id;
    const stats = await CustomerService.getSalesAgentStatistics(salesAgentId);
    res.json(stats);
  } catch (error) {
    console.error('Error getting sales agent statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export multiple customers to Excel (MUST be before single customer routes)
router.post('/export/excel', authenticateToken, logActivity('export_customers_excel'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('[CustomersRoute] Bulk Excel export request received');
    const { searchTerm, statusFilter, dateFilter } = req.body;
    const buffer = await ExportService.exportCustomersToExcel(searchTerm, statusFilter, dateFilter);
    
    console.log(`[CustomersRoute] Bulk Excel export successful, buffer size: ${buffer.length}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=customers.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('[CustomersRoute] Error exporting customers to Excel:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export multiple customers to PDF (MUST be before single customer routes)
router.post('/export/pdf', authenticateToken, logActivity('export_customers_pdf'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('[CustomersRoute] Bulk PDF export request received');
    const { searchTerm, statusFilter, dateFilter } = req.body;
    const buffer = await ExportService.exportCustomersToPDF(searchTerm, statusFilter, dateFilter);
    
    console.log(`[CustomersRoute] Bulk PDF export successful, buffer size: ${buffer.length}`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=customers.pdf');
    res.setHeader('Content-Length', buffer.length.toString());
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(buffer);
  } catch (error) {
    console.error('[CustomersRoute] Error exporting customers to PDF:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export multiple customers to Google Sheets (MUST be before single customer routes)
router.post('/export/sheets', authenticateToken, logActivity('export_customers_sheets'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('[CustomersRoute] Bulk Google Sheets export request received');
    const { searchTerm, statusFilter, dateFilter } = req.body;
    const result = await ExportService.exportCustomersToGoogleSheets(searchTerm, statusFilter, dateFilter);
    console.log('[CustomersRoute] Bulk Google Sheets export successful');
    res.json(result);
  } catch (error) {
    console.error('[CustomersRoute] Error exporting customers to Google Sheets:', error);
    if (error instanceof Error && error.message === 'Google Sheets URL not configured') {
      res.status(500).json({ error: 'Google Sheets integration not configured' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Export single customer to Excel
router.post('/:id/export/excel', authenticateToken, logActivity('export_customer_excel'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const customerId = Number(id);
    console.log(`[CustomersRoute] Single Excel export request for customer ID: ${customerId}`);
    
    if (!Number.isInteger(customerId) || customerId <= 0) {
      console.error(`[CustomersRoute] Invalid customer ID: ${id}`);
      res.status(400).json({ error: 'Invalid customer ID. Must be a positive integer.' });
      return;
    }

    console.log(`[CustomersRoute] Calling ExportService.exportCustomerToExcel(${customerId})`);
    const buffer = await ExportService.exportCustomerToExcel(customerId);
    
    console.log(`[CustomersRoute] Single Excel export successful, buffer size: ${buffer.length}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=customer-${id}.xlsx`);
    res.setHeader('Content-Length', buffer.length.toString());
    res.send(buffer);
  } catch (error) {
    console.error('[CustomersRoute] Error exporting customer to Excel:', error);
    if (error instanceof Error && error.message === 'Customer not found') {
      res.status(404).json({ error: error.message });
    } else if (error instanceof Error) {
      res.status(500).json({ error: `Export error: ${error.message}` });
    } else {
      res.status(500).json({ error: 'Internal server error during Excel export' });
    }
  }
});

// Export single customer to PDF
router.post('/:id/export/pdf', authenticateToken, logActivity('export_customer_pdf'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const customerId = Number(id);
    console.log(`[CustomersRoute] Single PDF export request for customer ID: ${customerId}`);
    
    if (!Number.isInteger(customerId)) {
      res.status(400).json({ error: 'Invalid customer id' });
      return;
    }

    const buffer = await ExportService.exportCustomerToPDF(customerId);
    
    console.log(`[CustomersRoute] Single PDF export successful, buffer size: ${buffer.length}`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=customer-${id}.pdf`);
    res.setHeader('Content-Length', buffer.length.toString());
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(buffer);
  } catch (error) {
    console.error('[CustomersRoute] Error exporting customer to PDF:', error);
    if (error instanceof Error && error.message === 'Customer not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Export single customer to Google Sheets
router.post('/:id/export/sheets', authenticateToken, logActivity('export_customer_sheets'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const customerId = Number(id);
    console.log(`[CustomersRoute] Single Google Sheets export request for customer ID: ${customerId}`);
    
    if (!Number.isInteger(customerId)) {
      res.status(400).json({ error: 'Invalid customer id' });
      return;
    }

    const result = await ExportService.exportCustomerToGoogleSheets(customerId);
    console.log(`[CustomersRoute] Single Google Sheets export successful`);
    res.json(result);
  } catch (error) {
    console.error('[CustomersRoute] Error exporting customer to Google Sheets:', error);
    if (error instanceof Error && error.message === 'Customer not found') {
      res.status(404).json({ error: error.message });
    } else if (error instanceof Error && error.message === 'Google Sheets URL not configured') {
      res.status(500).json({ error: 'Google Sheets integration not configured' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Get grade types for dropdown (accessible to sales agents)
router.get('/dropdown/grade-types', authenticateToken, requireSalesOrAdmin, logActivity('list_grade_types'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const query = 'SELECT * FROM grade_types ORDER BY name ASC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error listing grade types:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get lens types for dropdown (accessible to sales agents)
router.get('/dropdown/lens-types', authenticateToken, requireSalesOrAdmin, logActivity('list_lens_types'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const query = 'SELECT * FROM lens_types ORDER BY name ASC';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error listing lens types:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
