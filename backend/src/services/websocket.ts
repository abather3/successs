import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { UserService } from './user';
import { User, PriorityFlags } from '../types';

interface AuthenticatedSocket extends Socket {
  user?: User;
}

export const setupWebSocketHandlers = (io: Server): void => {
  // Authentication middleware for socket.io
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        // Emit auth error
        WebSocketService.emitAuthError(socket, 'TOKEN_MISSING', 'Authentication token required');
        return next(new Error('Authentication token required'));
      }

      try {
        const decoded = jwt.verify(token, config.JWT_SECRET) as any;
        const user = await UserService.findById(decoded.userId);

        if (!user || user.status !== 'active') {
          // Emit auth error
          WebSocketService.emitAuthError(socket, 'TOKEN_INVALID', 'Invalid or inactive user');
          return next(new Error('Invalid or inactive user'));
        }

        socket.user = user;
        
        // Check for token expiry
        const currentTime = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = decoded.exp - currentTime;

        if (timeUntilExpiry <= 120 && timeUntilExpiry > 0) {
          WebSocketService.emitAuthExpirationWarning(socket, timeUntilExpiry);
        }

        next();
      } catch (error) {
        let code = 'TOKEN_INVALID';
        let message = 'Invalid token';
        
        if (error instanceof jwt.TokenExpiredError) {
          code = 'TOKEN_EXPIRED';
          message = error.message;
        } else if (error instanceof jwt.NotBeforeError) {
          code = 'TOKEN_INVALID';
          message = error.message;
        } else if (error instanceof jwt.JsonWebTokenError) {
          code = 'TOKEN_INVALID';
          message = error.message;
        } else if (error instanceof Error) {
          message = error.message;
        }
        // Emit auth error
        WebSocketService.emitAuthError(socket, code, message);
        return next(new Error(message));
      }
    } catch (error) {
      // Emit unexpected auth error
      WebSocketService.emitAuthError(socket, 'AUTH_FAILED', 'Authentication failed');
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User ${socket.user?.full_name} connected via WebSocket`);

    // Join role-specific rooms
    if (socket.user) {
      socket.join(`role:${socket.user.role}`);
      socket.join(`user:${socket.user.id}`);
    }

    // Handle queue subscription
    socket.on('subscribe:queue', () => {
      socket.join('queue:updates');
      console.log(`User ${socket.user?.full_name} subscribed to queue updates`);
    });

    // Handle transaction updates subscription
    socket.on('subscribe:transactions', () => {
      if (socket.user?.role === 'cashier' || socket.user?.role === 'admin') {
        socket.join('transactions:updates');
        console.log(`User ${socket.user?.full_name} subscribed to transaction updates`);
      }
    });

    // Handle payment status updates subscription
    socket.on('subscribe:payment_status', () => {
      if (socket.user?.role === 'cashier' || socket.user?.role === 'admin' || socket.user?.role === 'sales') {
        socket.join('payment_status:updates');
        console.log(`User ${socket.user?.full_name} subscribed to payment status updates`);
      }
    });

    // Handle cashier notifications subscription
    socket.on('subscribe:cashier_notifications', () => {
      if (socket.user?.role === 'cashier') {
        socket.join('cashier:notifications');
        console.log(`User ${socket.user?.full_name} subscribed to cashier notifications`);
      }
    });

    // ISOLATED: Handle customer registration notifications subscription (separate from queue)
    socket.on('subscribe:customer_registration_notifications', () => {
      if (socket.user?.role === 'cashier') {
        socket.join('customer_registration:notifications');
        console.log(`User ${socket.user?.full_name} subscribed to customer registration notifications`);
      }
    });

    // REAL-TIME ANALYTICS: Handle notification analytics subscription
    socket.on('subscribe:notification_analytics', () => {
      if (socket.user?.role === 'cashier' || socket.user?.role === 'admin') {
        // Subscribe to role-specific analytics
        socket.join(`analytics:${socket.user.role}`);
        
        // Also subscribe to general notification analytics
        socket.join('analytics:notifications');
        
        console.log(`User ${socket.user?.full_name} subscribed to notification analytics`);
        
        // Send initial stats upon subscription
        WebSocketService.emitNotificationStatsUpdate(socket.user.role).catch(error => {
          console.error('Error sending initial notification stats:', error);
        });
      }
    });

    // ISOLATED: Handle mark notification as read
    socket.on('mark_customer_notification_read', async (data: { notificationId: string }) => {
      if (socket.user?.role === 'cashier' && data.notificationId) {
        try {
          // Import here to avoid circular dependency
          const { CustomerNotificationService } = await import('./CustomerNotificationService');
          await CustomerNotificationService.markAsRead(data.notificationId, socket.user.id);
          
          // Emit confirmation back to user
          socket.emit('customer_notification_marked_read', {
            notificationId: data.notificationId,
            timestamp: new Date()
          });
          
          console.log(`[CUSTOMER_NOTIFICATION] Notification ${data.notificationId} marked as read by ${socket.user.full_name}`);
          
          // REAL-TIME ANALYTICS: Trigger stats update after marking as read
          WebSocketService.emitNotificationStatsUpdate(socket.user.role).catch(error => {
            console.error('Error emitting stats update after mark as read:', error);
          });
          
        } catch (error) {
          console.error('[CUSTOMER_NOTIFICATION] Error marking notification as read:', error);
          socket.emit('customer_notification_error', {
            error: 'Failed to mark notification as read',
            notificationId: data.notificationId
          });
        }
      }
    });

    // Handle counter status updates
    socket.on('counter:status', (data: { counterId: number; isActive: boolean }) => {
      if (socket.user?.role === 'admin' || socket.user?.role === 'cashier') {
        socket.to('queue:updates').emit('counter:status:update', {
          counterId: data.counterId,
          isActive: data.isActive,
          updatedBy: socket.user.full_name
        });
      }
    });

// Handle customer call
    socket.on('customer:call', (data: { customerId: number; counterName: string }) => {
      if (socket.user?.role === 'cashier' || socket.user?.role === 'admin') {
        io.to('queue:updates').emit('customer:called', {
          customerId: data.customerId,
          counterName: data.counterName,
          calledBy: socket.user.full_name,
          timestamp: new Date()
        });
      }
    });

    // Handle new customer registration notification
    socket.on('customer:registered', (data: { customerId: number; customerName: string; 
                                                          orNumber: string; paymentAmount: number;
                                                          priority: PriorityFlags; locationId: number }) => {
      if (socket.user?.role === 'cashier') {
        io.to(`cashier:registration:${data.locationId}`).emit('customer:registered', data);
        console.log(`Notification sent for new customer registration: ${data.customerName}`);
      }
    });

    // Handle customer served
    socket.on('customer:served', (data: { customerId: number }) => {
      if (socket.user?.role === 'cashier' || socket.user?.role === 'admin') {
        io.to('queue:updates').emit('customer:served', {
          customerId: data.customerId,
          servedBy: socket.user.full_name,
          timestamp: new Date()
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User ${socket.user?.full_name} disconnected from WebSocket`);
    });

    // Send initial connection confirmation
    socket.emit('connected', {
      message: 'Connected to EscaShop WebSocket',
      user: socket.user?.full_name,
      timestamp: new Date()
    });
  });
};

export class WebSocketService {
  private static io: Server;

  static setIO(io: Server): void {
    this.io = io;
  }

  // Emit authentication error
  static emitAuthError(socket: AuthenticatedSocket, code: string, message: string): void {
    socket.emit('auth:error', { code, message });
    console.warn(message);
    socket.disconnect(true);
  }

  // Emit authentication expiration warning
  static emitAuthExpirationWarning(socket: AuthenticatedSocket, remainingSeconds: number): void {
    socket.emit('auth:expire_soon', { remainingSeconds });
  }

  // Enhanced queue update with processing count
  static async emitQueueUpdate(data: any): Promise<void> {
    if (this.io) {
      // Get processing count for enhanced payload
      let enhancedData = { ...data };
      try {
        const { pool } = require('../config/database');
        const processingCountResult = await pool.query(
          "SELECT COUNT(*) as count FROM customers WHERE queue_status = 'processing'"
        );
        enhancedData.processingCount = parseInt(processingCountResult.rows[0].count);
      } catch (error) {
        console.error('Error fetching processing count for queue update:', error);
        enhancedData.processingCount = 0;
      }
      
      // Suppress sound alerts for processing status changes
      if (data.newStatus === 'processing' || data.type === 'status_changed' && data.newStatus === 'processing') {
        enhancedData.suppressSound = true;
      }
      
      this.io.to('queue:updates').emit('queue:update', enhancedData);
    }
  }

  // New event for specific status changes
  static emitQueueStatusChanged(id: number, newStatus: string, additionalData?: any): void {
    if (this.io) {
      const payload = {
        id,
        newStatus,
        timestamp: new Date(),
        // Suppress sound alerts for processing status changes
        suppressSound: newStatus === 'processing',
        ...additionalData
      };
      
      this.io.to('queue:updates').emit('queue:status_changed', payload);
      console.log(`[WEBSOCKET] Emitted queue:status_changed for customer ${id} -> ${newStatus}${newStatus === 'processing' ? ' (sound suppressed)' : ''}`);
    }
  }

static emitTransactionUpdate(data: any, traceId?: string): void {
    // TRACING: Log WebSocket emission
    const logId = traceId || `WS_${Date.now()}`;
    console.log(`[WEBSOCKET_TRACE] ${logId}: Emitting transaction update with event 'transactionUpdated'`);
    console.log(`[WEBSOCKET_TRACE] ${logId}: Transaction update data:`, JSON.stringify({ type: data.type, transactionId: data.transaction?.id || data.transactionId, timestamp: data.timestamp }));
    
    if (this.io) {
      this.io.to('transactions:updates').emit('transactionUpdated', data);
      console.log(`[WEBSOCKET_TRACE] ${logId}: Transaction update emitted successfully`);
    } else {
      console.log(`[WEBSOCKET_TRACE] ${logId}: WebSocket IO not available, emission skipped`);
    }
  }
  
  static emitSettlementCreated(data: { transaction_id: number, settlement: any, transaction: any }): void {
    if (this.io) {
      this.io.emit('settlementCreated', data);
      console.log(`[WEBSOCKET_TRACE] Emitted 'settlementCreated' event with data:`, JSON.stringify(data));
    }
  }

  static emitNotification(userId: number, notification: any): void {
    if (this.io) {
      this.io.to(`user:${userId}`).emit('notification', notification);
    }
  }

  static emitBroadcast(message: any): void {
    if (this.io) {
      this.io.emit('broadcast', message);
    }
  }

  static emitToRole(role: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`role:${role}`).emit(event, data);
    }
  }

  static emitPaymentStatusUpdate(data: {
    transactionId: number;
    payment_status: string;
    balance_amount: number;
    paid_amount: number;
    customer_id?: number;
    or_number?: string;
    updatedBy?: string;
  }, traceId?: string): void {
    // TRACING: Log WebSocket payment status emission
    const logId = traceId || `WS_PAYMENT_${Date.now()}`;
    console.log(`[WEBSOCKET_TRACE] ${logId}: Emitting payment status update for transaction ${data.transactionId}`);
    console.log(`[WEBSOCKET_TRACE] ${logId}: Payment status data:`, JSON.stringify({ transactionId: data.transactionId, payment_status: data.payment_status, paid_amount: data.paid_amount, balance_amount: data.balance_amount }));
    
    if (this.io) {
      const payload = {
        transactionId: data.transactionId,
        payment_status: data.payment_status,
        balance_amount: data.balance_amount,
        paid_amount: data.paid_amount,
        customer_id: data.customer_id,
        or_number: data.or_number,
        updatedBy: data.updatedBy,
        timestamp: new Date()
      };
      
      // Emit to payment status subscribers
      console.log(`[WEBSOCKET_TRACE] ${logId}: Emitting to 'payment_status:updates' channel`);
      this.io.to('payment_status:updates').emit('payment_status_updated', payload);
      
      // Also emit to transaction updates for backward compatibility
      console.log(`[WEBSOCKET_TRACE] ${logId}: Emitting to 'transactions:updates' channel (backward compatibility)`);
      this.io.to('transactions:updates').emit('payment_status_updated', payload);
      
      console.log(`[WEBSOCKET_TRACE] ${logId}: Payment status update emitted successfully`);
    } else {
      console.log(`[WEBSOCKET_TRACE] ${logId}: WebSocket IO not available, payment status emission skipped`);
    }
  }

  static emitCustomerCreated(data: {
    customer: any;
    created_by: number;
    has_initial_transaction: boolean;
    timestamp: Date;
  }): void {
    if (this.io) {
      const payload = {
        customer: data.customer,
        created_by: data.created_by,
        has_initial_transaction: data.has_initial_transaction,
        timestamp: data.timestamp
      };
      
      // Emit to sales agents and administrators
      this.io.to('role:sales').emit('customer_created', payload);
      this.io.to('role:admin').emit('customer_created', payload);
      
      // Enhanced notification to cashiers with processing context
      this.io.to('role:cashier').emit('new_customer_for_processing', {
        ...payload,
        message: `New customer ${data.customer.name} registered by sales agent. Ready for transaction processing.`,
        priority: data.customer.priority_flags?.senior_citizen || 
                  data.customer.priority_flags?.pregnant || 
                  data.customer.priority_flags?.pwd,
        notification_type: 'new_customer_registration'
      });
    }
  }

  // Enhanced method for cashier-specific notifications
  static emitCashierNotification(data: {
    type: string;
    customer_id: number;
    customer_name: string;
    or_number: string;
    token_number: number;
    message: string;
    priority: 'high' | 'normal';
    created_by: number;
    created_by_name: string;
    timestamp: Date;
    metadata?: any;
  }): void {
    if (this.io) {
      const payload = {
        ...data,
        id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      
      this.io.to('role:cashier').emit('cashier_notification', payload);
      console.log(`[NOTIFICATION] Sent cashier notification: ${data.type} for customer ${data.customer_name} (Token #${data.token_number})`);
    }
  }

  // Customer registration notification for cashiers
  static emitCustomerRegistrationNotification(data: {
    customer: any;
    created_by: number;
    created_by_name: string;
    location_id?: number;
  }): void {
    if (this.io) {
      const priorityType = data.customer.priority_flags?.senior_citizen ? 'Senior Citizen' :
                          data.customer.priority_flags?.pregnant ? 'Pregnant' :
                          data.customer.priority_flags?.pwd ? 'PWD' :
                          'Standard Customer';
      
      const isPriority = data.customer.priority_flags?.senior_citizen || 
                        data.customer.priority_flags?.pregnant || 
                        data.customer.priority_flags?.pwd;
      
      const payload = {
        id: `reg_notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'customer_registration',
        customer_id: data.customer.id,
        customer_name: data.customer.name,
        or_number: data.customer.or_number,
        token_number: data.customer.token_number,
        payment_amount: data.customer.payment_info?.amount || 0,
        payment_mode: data.customer.payment_info?.mode,
        distribution_method: data.customer.distribution_info,
        priority_type: priorityType,
        is_priority: isPriority,
        priority_flags: data.customer.priority_flags,
        created_by: data.created_by,
        created_by_name: data.created_by_name,
        location_id: data.location_id || 1, // Default location
        message: `New ${priorityType.toLowerCase()} registration: ${data.customer.name} (${data.customer.or_number}) - ₱${data.customer.payment_info?.amount || 0}`,
        timestamp: new Date(),
        expires_at: new Date(Date.now() + (8 * 60 * 60 * 1000)), // 8 hours from now
        metadata: {
          estimated_time: data.customer.estimated_time,
          contact_number: data.customer.contact_number,
          age: data.customer.age
        }
      };
      
      // Send to all cashiers for now (can be location-specific later)
      this.io.to('role:cashier').emit('customer_registration_notification', payload);
      
      // Also emit to cashier notifications channel for users who subscribed
      this.io.to('cashier:notifications').emit('customer_registration_notification', payload);
      
      console.log(`[CUSTOMER_REGISTRATION] Notification sent to cashiers: ${data.customer.name} (${priorityType}) - OR: ${data.customer.or_number}`);
    }
  }

  // ISOLATED: Facebook-style customer registration notifications (separate from queue/SMS)
  static emitCustomerRegistrationNotificationIsolated(notification: any): void {
    if (this.io) {
      // Use completely separate channel to avoid any interference
      this.io.to('customer_registration:notifications').emit('new_customer_registration_notification', {
        notification_id: notification.notification_id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        customer_data: notification.customer_data,
        created_by_name: notification.created_by_name,
        created_by_role: notification.created_by_role,
        expires_at: notification.expires_at,
        created_at: notification.created_at,
        actions: notification.actions,
        timestamp: new Date()
      });
      
      console.log(`[CUSTOMER_NOTIFICATION_ISOLATED] Facebook-style notification sent: ${notification.notification_id}`);
    }
  }

  // REAL-TIME ANALYTICS: Emit notification statistics updates
  static async emitNotificationStatsUpdate(targetRole: string = 'cashier'): Promise<void> {
    if (this.io) {
      try {
        // Import here to avoid circular dependency
        const { CustomerNotificationService } = await import('./CustomerNotificationService');
        
        // Get current notification statistics
        const stats = await CustomerNotificationService.getNotificationStats(targetRole);
        const analytics = await CustomerNotificationService.getNotificationAnalytics(targetRole);
        
        // Combine stats and analytics for comprehensive update
        const statsUpdate = {
          ...stats,
          ...analytics,
          target_role: targetRole,
          last_updated: new Date(),
          timestamp: Date.now()
        };
        
        // Emit to role-specific analytics subscribers
        this.io.to(`analytics:${targetRole}`).emit('notification_stats_update', statsUpdate);
        
        // Also emit to general analytics channel
        this.io.to('analytics:notifications').emit('notification_stats_update', statsUpdate);
        
        console.log(`[REAL_TIME_ANALYTICS] Notification stats update emitted for role: ${targetRole}`, 
          JSON.stringify({
            total_active: stats.total_active,
            total_unread: stats.total_unread,
            expires_soon: stats.expires_soon,
            avg_response_time: analytics.avg_response_time_minutes
          }));
        
      } catch (error) {
        console.error(`[REAL_TIME_ANALYTICS] Error emitting notification stats for role ${targetRole}:`, error);
      }
    }
  }

  // REAL-TIME ANALYTICS: Emit stats update for all roles
  static async emitNotificationStatsUpdateForAllRoles(): Promise<void> {
    const roles = ['cashier', 'admin', 'sales'];
    
    for (const role of roles) {
      await this.emitNotificationStatsUpdate(role);
    }
  }
}
