import React from 'react';
import { Box } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import useSessionManager from '../../hooks/useSessionManager';
import SessionWarning from '../common/SessionWarning';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { accessToken } = useAuth();
  const {
    timeRemaining,
    warningStage,
    extendSession,
    dismissWarning,
    logout
  } = useSessionManager();

  // Only show session warnings if user is authenticated
  const shouldShowSessionWarning = accessToken && warningStage !== 'none';

  return (
    <Box sx={{ minHeight: '100vh' }}>
      {children}
      
      {/* Session Warning Component */}
      {shouldShowSessionWarning && (
        <SessionWarning
          warningStage={warningStage}
          timeRemaining={timeRemaining}
          onExtend={extendSession}
          onLogout={logout}
          onDismiss={dismissWarning}
        />
      )}
    </Box>
  );
};

export default AppLayout;
