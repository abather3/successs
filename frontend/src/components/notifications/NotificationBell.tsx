import React, { useState, useEffect } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  Button,
  Fade,
  Tooltip
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsNone as NotificationsNoneIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { NotificationDropdown } from './NotificationDropdown';
import { CustomerRegistrationNotification, CustomerRegistrationToast } from './CustomerRegistrationToast';

interface NotificationBellProps {
  className?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ className }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<CustomerRegistrationNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<CustomerRegistrationNotification | null>(null);

  // Only show for cashiers
  const isEnabled = user?.role === 'cashier';
  const isOpen = Boolean(anchorEl);

  // WebSocket connection handling
  useEffect(() => {
    if (!socket || !isEnabled) return;

    const handleConnect = () => {
      console.log('[NOTIFICATION_BELL] Connected to WebSocket');
      setIsConnected(true);
      socket.emit('subscribe:customer_registration_notifications');
    };

    const handleDisconnect = () => {
      console.log('[NOTIFICATION_BELL] Disconnected from WebSocket');
      setIsConnected(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket, isEnabled]);

  // Handle new notifications
  useEffect(() => {
    if (!socket || !isEnabled) return;

    const handleNewNotification = (data: CustomerRegistrationNotification) => {
      console.log('[NOTIFICATION_BELL] New notification received:', data);
      
      setNotifications(prev => {
        const exists = prev.some(n => n.notification_id === data.notification_id);
        if (exists) return prev;
        
        const updated = [data, ...prev];
        return updated.slice(0, 20); // Keep last 20 notifications
      });
      
      setUnreadCount(prev => prev + 1);
    };

    const handleNotificationRead = (data: { notificationId: string }) => {
      console.log('[NOTIFICATION_BELL] Notification marked as read:', data.notificationId);
      setNotifications(prev => 
        prev.filter(n => n.notification_id !== data.notificationId)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    };

    socket.on('new_customer_registration_notification', handleNewNotification);
    socket.on('customer_notification_marked_read', handleNotificationRead);

    return () => {
      socket.off('new_customer_registration_notification', handleNewNotification);
      socket.off('customer_notification_marked_read', handleNotificationRead);
    };
  }, [socket, isEnabled]);

  // Load existing notifications on mount
  useEffect(() => {
    if (!isEnabled) return;
    
    const loadNotifications = async () => {
      try {
        const response = await fetch('/api/customer-notifications/active', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.notifications) {
            setNotifications(data.notifications);
            setUnreadCount(data.notifications.length);
            console.log('[NOTIFICATION_BELL] Loaded existing notifications:', data.notifications.length);
          }
        }
      } catch (error) {
        console.error('[NOTIFICATION_BELL] Error loading notifications:', error);
      }
    };

    loadNotifications();
  }, [isEnabled]);

  const handleBellClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = async (notificationId: string, customerId: number) => {
    // Find the clicked notification
    const notification = notifications.find(n => n.notification_id === notificationId);
    if (!notification) return;

    // Close dropdown
    handleClose();
    
    // Show detailed toast for this notification
    setSelectedNotification(notification);
  };

  // Handle toast action (Process Transaction, View Details)
  const handleToastAction = async (actionType: string, customerId: number, notificationId: string) => {
    console.log('[NOTIFICATION_BELL] Toast action triggered:', actionType, customerId, notificationId);

    // Mark notification as read
    try {
      await fetch(`/api/customer-notifications/${notificationId}/mark-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
    } catch (error) {
      console.error('[NOTIFICATION_BELL] Error marking notification as read:', error);
    }

    // Remove from local state
    setNotifications(prev => 
      prev.filter(n => n.notification_id !== notificationId)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    // Close toast
    setSelectedNotification(null);

    // Handle action
    switch (actionType) {
      case 'view_customer':
        // Navigate to customer management page and trigger customer details view
        // Since there's no direct route to individual customer, we'll go to customers page
        // and use URL params to indicate which customer to highlight/view
        window.location.href = `/customers?viewCustomer=${customerId}`;
        break;
      
      case 'start_transaction':
        // Navigate to transactions page with a query parameter to pre-select the customer
        // This allows the transaction management component to auto-populate customer data
        window.location.href = `/transactions?customerId=${customerId}`;
        break;
      
      default:
        console.warn('[NOTIFICATION_BELL] Unknown action type:', actionType);
    }
  };

  // Handle toast dismissal
  const handleToastDismiss = async (notificationId: string) => {
    console.log('[NOTIFICATION_BELL] Dismissing toast:', notificationId);

    // Mark as read in backend
    try {
      await fetch(`/api/customer-notifications/${notificationId}/mark-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
    } catch (error) {
      console.error('[NOTIFICATION_BELL] Error marking notification as read:', error);
    }

    // Remove from local state
    setNotifications(prev => 
      prev.filter(n => n.notification_id !== notificationId)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));

    // Close toast
    setSelectedNotification(null);
  };

  const handleMarkAllAsRead = async () => {
    try {
      // Mark all notifications as read
      const promises = notifications.map(notification =>
        fetch(`/api/customer-notifications/${notification.notification_id}/mark-read`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        })
      );

      await Promise.all(promises);
      setNotifications([]);
      setUnreadCount(0);
      handleClose();
    } catch (error) {
      console.error('[NOTIFICATION_BELL] Error marking all notifications as read:', error);
    }
  };

  // Don't render if not enabled (not a cashier)
  if (!isEnabled) {
    return null;
  }

  return (
    <>
      <Tooltip title="Customer Notifications" arrow>
        <IconButton
          onClick={handleBellClick}
          className={className}
          sx={{
            color: 'inherit',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
        >
          <Badge 
            badgeContent={unreadCount} 
            color="error"
            sx={{
              '& .MuiBadge-badge': {
                fontSize: '0.75rem',
                minWidth: '16px',
                height: '16px'
              }
            }}
          >
            {unreadCount > 0 ? (
              <NotificationsIcon sx={{ fontSize: 24 }} />
            ) : (
              <NotificationsNoneIcon sx={{ fontSize: 24 }} />
            )}
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={isOpen}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: 380,
            maxHeight: 500,
            mt: 1,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            borderRadius: 2,
            overflow: 'hidden'
          }
        }}
        TransitionComponent={Fade}
        transitionDuration={200}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Notifications
            </Typography>
            {notifications.length > 0 && (
              <Button
                size="small"
                onClick={handleMarkAllAsRead}
                sx={{ 
                  fontSize: '0.75rem',
                  textTransform: 'none',
                  color: 'primary.main'
                }}
              >
                Mark all as read
              </Button>
            )}
          </Box>
          
          {/* Connection status indicator */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: isConnected ? 'success.main' : 'error.main'
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {isConnected ? 'Connected' : 'Disconnected'}
            </Typography>
          </Box>
        </Box>

        <NotificationDropdown
          notifications={notifications}
          onNotificationClick={handleNotificationClick}
          onClose={handleClose}
        />
      </Popover>

      {/* Detailed toast for selected notification */}
      {selectedNotification && (
        <CustomerRegistrationToast
          key={selectedNotification.notification_id}
          notification={selectedNotification}
          onAction={handleToastAction}
          onDismiss={handleToastDismiss}
          index={0}
        />
      )}
    </>
  );
};

export default NotificationBell;
