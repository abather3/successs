import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';

export interface NotificationMessage {
  id: string;
  message: string;
  severity: AlertColor;
  duration?: number;
}

interface NotificationContextType {
  notify: (message: string, severity: AlertColor, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warn: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  close: (id?: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);

  const generateId = useCallback(() => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }, []);

  const close = useCallback((id?: string) => {
    if (id) {
      setNotifications(prev => prev.filter(notification => notification.id !== id));
    } else {
      // Close the oldest notification if no id provided
      setNotifications(prev => prev.slice(1));
    }
  }, []);

  const notify = useCallback((message: string, severity: AlertColor, duration: number = 6000) => {
    const id = generateId();
    const notification: NotificationMessage = {
      id,
      message,
      severity,
      duration,
    };

    setNotifications(prev => [...prev, notification]);

    // Auto-remove notification after duration
    if (duration > 0) {
      setTimeout(() => {
        close(id);
      }, duration);
    }
  }, [generateId, close]);

  const info = useCallback((message: string, duration?: number) => {
    notify(message, 'info', duration);
  }, [notify]);

  const warn = useCallback((message: string, duration?: number) => {
    notify(message, 'warning', duration);
  }, [notify]);

  const error = useCallback((message: string, duration?: number) => {
    notify(message, 'error', duration);
  }, [notify]);

  const success = useCallback((message: string, duration?: number) => {
    notify(message, 'success', duration);
  }, [notify]);

  const handleClose = useCallback((event?: React.SyntheticEvent | Event, reason?: string, id?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    close(id);
  }, [close]);

  const value: NotificationContextType = {
    notify,
    info,
    warn,
    error,
    success,
    close,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {notifications.map((notification) => (
        <Snackbar
          key={notification.id}
          open={true}
          autoHideDuration={notification.duration || 6000}
          onClose={(event, reason) => handleClose(event, reason, notification.id)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          sx={{
            '& .MuiSnackbar-root': {
              position: 'relative',
            },
          }}
        >
          <Alert
            onClose={(event) => handleClose(event, 'closeButton', notification.id)}
            severity={notification.severity}
            variant="filled"
            sx={{ 
              width: '100%',
              minWidth: 300,
              maxWidth: 500,
            }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      ))}
    </NotificationContext.Provider>
  );
};
