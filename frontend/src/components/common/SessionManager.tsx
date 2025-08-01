import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import SessionExpiredDialog from './SessionExpiredDialog';

// Production-safe debug logging - disabled by default
const logWithTimestamp = (message: string, data?: any) => {
  // Only log in development if DEBUG_SESSION is explicitly enabled
  if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_SESSION === 'true') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [SESSION_MANAGER] ${message}`, data || '');
  }
};

interface SessionManagerProps {
  children: React.ReactNode;
}

export const SessionManager: React.FC<SessionManagerProps> = ({ children }) => {
  const [showSessionExpiredDialog, setShowSessionExpiredDialog] = useState(false);
  const { 
    sessionExpireWarning, 
    sessionExpiredDialogOpen, 
    dismissSessionWarning, 
    closeSessionExpiredDialog 
  } = useAuth();
  const { warn } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  
  logWithTimestamp('SessionManager render', {
    currentPath: location.pathname,
    sessionExpireWarning,
    sessionExpiredDialogOpen,
    showSessionExpiredDialog
  });

  // Handle session expiry warning (from session timeout)
  useEffect(() => {
    logWithTimestamp('Session expire warning effect triggered', {
      sessionExpireWarning,
      currentPath: location.pathname
    });
    
    if (sessionExpireWarning) {
      logWithTimestamp('⚠️ Session expiry warning active - showing dialog');
      setShowSessionExpiredDialog(true);
      warn('Your session is about to expire. Please save any unsaved work.', 8000);
    }
  }, [sessionExpireWarning, warn, location.pathname]);

  // Handle TOKEN_EXPIRED dialog (from Axios interceptor)
  useEffect(() => {
    logWithTimestamp('Session expired dialog effect triggered', {
      sessionExpiredDialogOpen,
      currentPath: location.pathname
    });
    
    if (sessionExpiredDialogOpen) {
      logWithTimestamp('🚨 Session expired dialog active - showing dialog');
      setShowSessionExpiredDialog(true);
      warn('Your session has expired. Please log in again.', 8000);
    }
  }, [sessionExpiredDialogOpen, warn, location.pathname]);

  const handleDismissDialog = () => {
    setShowSessionExpiredDialog(false);
    if (sessionExpireWarning) {
      dismissSessionWarning();
    }
    if (sessionExpiredDialogOpen) {
      closeSessionExpiredDialog();
    }
  };

  const handleRelogin = () => {
    logWithTimestamp('🔄 Handling relogin from session manager', {
      currentPath: location.pathname + location.search,
      sessionExpireWarning,
      sessionExpiredDialogOpen
    });
    
    setShowSessionExpiredDialog(false);
    if (sessionExpireWarning) {
      dismissSessionWarning();
    }
    if (sessionExpiredDialogOpen) {
      closeSessionExpiredDialog();
    }
    
    // Store the current location to redirect back after login
    const currentPath = location.pathname + location.search;
    if (currentPath !== '/login' && currentPath !== '/forgot-password') {
      logWithTimestamp('📍 Storing redirect path in sessionStorage', currentPath);
      sessionStorage.setItem('redirectPath', currentPath);
    }
    
    logWithTimestamp('🚀 Navigating to /login from SessionManager');
    navigate('/login', { replace: true });
  };

  return (
    <>
      {children}
      <SessionExpiredDialog
        open={showSessionExpiredDialog}
        onClose={handleDismissDialog}
        onRelogin={handleRelogin}
      />
    </>
  );
};

export default SessionManager;
