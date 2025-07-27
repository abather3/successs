// ISOLATED: Customer Registration Notification Manager
// This manages Facebook-style notifications completely separate from queue management

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { 
  CustomerRegistrationToast, 
  CustomerRegistrationNotification 
} from './CustomerRegistrationToast';
import { Box, Snackbar, Alert } from '@mui/material';

interface CustomerNotificationManagerProps {
  // Only show for cashiers
  enabled?: boolean;
}

export const CustomerNotificationManager: React.FC<CustomerNotificationManagerProps> = ({
  enabled = true
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<CustomerRegistrationNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);

  // Only enable for cashiers
  const isEnabled = enabled && user?.role === 'cashier';

  // WebSocket connection for isolated customer registration notifications
  const { socket } = useSocket();
  const [isConnected, setIsConnected] = useState(false);

  // Handle socket connection events
  useEffect(() => {
    if (!socket || !isEnabled) return;

    const handleConnect = () => {
      console.log('[CUSTOMER_NOTIFICATION] Connected to WebSocket for customer registration notifications');
      setIsConnected(true);
      // Subscribe to isolated customer registration notifications
      socket.emit('subscribe:customer_registration_notifications');
    };

    const handleDisconnect = () => {
      console.log('[CUSTOMER_NOTIFICATION] Disconnected from customer registration notifications');
      setIsConnected(false);
    };

    // Set up connection handlers
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Check if already connected
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket, isEnabled]);

  // Initialize notification sound (optional)
  useEffect(() => {
    try {
      notificationSoundRef.current = new Audio('/notification-sound.mp3');
      notificationSoundRef.current.volume = 0.5;
      
      // Test if the sound can load
      notificationSoundRef.current.addEventListener('error', () => {
        console.log('[CUSTOMER_NOTIFICATION] Notification sound file not found - notifications will be silent');
        notificationSoundRef.current = null;
      });
    } catch (error) {
      console.log('[CUSTOMER_NOTIFICATION] Could not initialize notification sound:', error);
      notificationSoundRef.current = null;
    }
  }, []);

  // Handle incoming customer registration notifications
  const handleNewNotification = useCallback((data: CustomerRegistrationNotification) => {
    console.log('[CUSTOMER_NOTIFICATION] Received new customer registration notification:', data);
    
    setNotifications(prev => {
      // Avoid duplicates
      const exists = prev.some(n => n.notification_id === data.notification_id);
      if (exists) return prev;
      
      // Add to beginning of array (newest first)
      const updated = [data, ...prev];
      
      // Limit to 5 notifications max
      return updated.slice(0, 5);
    });

    // Play notification sound
    try {
      notificationSoundRef.current?.play().catch(() => {
        console.log('[CUSTOMER_NOTIFICATION] Could not play notification sound');
      });
    } catch (error) {
      console.log('[CUSTOMER_NOTIFICATION] Notification sound error:', error);
    }

    // Show browser notification if permission granted
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('New Customer Registration', {
          body: `${data.customer_data.name} has been registered (${data.customer_data.priority_type})`,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: data.notification_id,
          renotify: true
        });
      } catch (error) {
        console.log('[CUSTOMER_NOTIFICATION] Browser notification error:', error);
      }
    }
  }, []);

  // Set up WebSocket listeners
  useEffect(() => {
    if (!socket || !isEnabled) return;

    // Listen for isolated customer registration notifications
    socket.on('new_customer_registration_notification', handleNewNotification);

    // Listen for notification read confirmations
    socket.on('customer_notification_marked_read', (data: { notificationId: string }) => {
      console.log('[CUSTOMER_NOTIFICATION] Notification marked as read:', data.notificationId);
      setNotifications(prev => 
        prev.filter(n => n.notification_id !== data.notificationId)
      );
    });

    // Listen for errors
    socket.on('customer_notification_error', (error: { error: string; notificationId?: string }) => {
      console.error('[CUSTOMER_NOTIFICATION] WebSocket error:', error);
      setError(error.error);
    });

    return () => {
      socket.off('new_customer_registration_notification', handleNewNotification);
      socket.off('customer_notification_marked_read');
      socket.off('customer_notification_error');
    };
  }, [socket, isEnabled, handleNewNotification]);

  // Request browser notification permission on mount
  useEffect(() => {
    if (!isEnabled) return;
    
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('[CUSTOMER_NOTIFICATION] Notification permission:', permission);
      });
    }
  }, [isEnabled]);

  // Load existing notifications on component mount
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
            setNotifications(data.notifications.slice(0, 5)); // Limit to 5
            console.log('[CUSTOMER_NOTIFICATION] Loaded existing notifications:', data.notifications.length);
          }
        } else {
          console.error('[CUSTOMER_NOTIFICATION] Failed to load notifications:', response.status);
        }
      } catch (error) {
        console.error('[CUSTOMER_NOTIFICATION] Error loading notifications:', error);
        setError('Failed to load notifications');
      }
    };

    loadNotifications();
  }, [isEnabled]);

  // Handle notification actions
  const handleNotificationAction = useCallback(async (
    actionType: string, 
    customerId: number, 
    notificationId: string
  ) => {
    console.log('[CUSTOMER_NOTIFICATION] Action triggered:', actionType, customerId, notificationId);

    // Mark notification as read
    try {
      const response = await fetch(`/api/customer-notifications/${notificationId}/mark-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        // Remove from local state
        setNotifications(prev => 
          prev.filter(n => n.notification_id !== notificationId)
        );
      }
    } catch (error) {
      console.error('[CUSTOMER_NOTIFICATION] Error marking notification as read:', error);
    }

    // Handle action
    switch (actionType) {
      case 'view_customer':
        navigate(`/customers/${customerId}`);
        break;
      
      case 'start_transaction':
        navigate(`/transactions/new?customerId=${customerId}`);
        break;
      
      case 'call_customer':
        // You could integrate with queue management here
        navigate(`/queue?highlight=${customerId}`);
        break;
      
      default:
        console.warn('[CUSTOMER_NOTIFICATION] Unknown action type:', actionType);
    }
  }, [navigate]);

  // Handle notification dismissal
  const handleNotificationDismiss = useCallback(async (notificationId: string) => {
    console.log('[CUSTOMER_NOTIFICATION] Dismissing notification:', notificationId);

    // Mark as read in backend
    try {
      await fetch(`/api/customer-notifications/${notificationId}/mark-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
    } catch (error) {
      console.error('[CUSTOMER_NOTIFICATION] Error marking notification as read:', error);
    }

    // Remove from local state
    setNotifications(prev => 
      prev.filter(n => n.notification_id !== notificationId)
    );
  }, []);

  // Auto-remove expired notifications
  useEffect(() => {
    const cleanupExpired = () => {
      const now = new Date();
      setNotifications(prev => 
        prev.filter(n => new Date(n.expires_at) > now)
      );
    };

    const interval = setInterval(cleanupExpired, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // Don't render if not enabled
  if (!isEnabled) {
    return null;
  }

  return (
    <Box>
      {/* Render notification toasts */}
      {notifications.map((notification, index) => (
        <CustomerRegistrationToast
          key={notification.notification_id}
          notification={notification}
          onAction={handleNotificationAction}
          onDismiss={handleNotificationDismiss}
          index={index}
        />
      ))}

      {/* Error snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert 
          onClose={() => setError(null)} 
          severity="error" 
          sx={{ width: '100%' }}
        >
          {error}
        </Alert>
      </Snackbar>

      {/* Connection indicator for debugging */}
      {process.env.NODE_ENV === 'development' && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 20,
            left: 20,
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: isConnected ? 'success.main' : 'error.main',
            zIndex: 10000,
            opacity: 0.7
          }}
          title={isConnected ? 'Customer notifications connected' : 'Customer notifications disconnected'}
        />
      )}
    </Box>
  );
};

export default CustomerNotificationManager;
