import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TokenManager } from '../services/authService';

export type SessionStage = 'none' | 'subtle' | 'urgent';

interface SessionManagerState {
  timeRemaining: number;
  warningStage: SessionStage;
  isExtending: boolean;
}

interface SessionManagerActions {
  extendSession: () => Promise<void>;
  dismissWarning: () => void;
  logout: () => void;
}

export const useSessionManager = (): SessionManagerState & SessionManagerActions => {
  const { accessToken, extendSession, dismissSessionWarning, logout } = useAuth();
  const [timeRemaining, setTimeRemaining] = useState(1800); // 30 minutes in seconds
  const [warningStage, setWarningStage] = useState<SessionStage>('none');
  const [isExtending, setIsExtending] = useState(false);

  // Calculate time remaining and warning stage
  useEffect(() => {
    if (!accessToken) {
      setWarningStage('none');
      return;
    }

    const intervalId = setInterval(() => {
      const expiration = parseInt(localStorage.getItem('tokenExpiresAt') || '0', 10);
      const currentTime = Date.now();
      const timeLeft = Math.max(0, expiration - currentTime);
      const remainingSeconds = Math.floor(timeLeft / 1000);
      
      setTimeRemaining(remainingSeconds);

      // Determine warning stage based on time remaining
      if (timeLeft <= 60000 && timeLeft > 0) {
        // 1 minute or less - urgent
        setWarningStage('urgent');
      } else if (timeLeft <= 300000 && timeLeft > 60000) {
        // 5 minutes or less - subtle warning
        setWarningStage('subtle');
      } else if (timeLeft <= 0) {
        // Expired
        setWarningStage('none');
        logout();
      } else {
        // More than 5 minutes - no warning
        setWarningStage('none');
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [accessToken, logout]);

  // Handle session extension
  const handleExtendSession = useCallback(async () => {
    if (isExtending) return;
    
    setIsExtending(true);
    try {
      await extendSession();
      setWarningStage('none');
    } catch (error) {
      console.error('Failed to extend session:', error);
      // Let the auth context handle the error
    } finally {
      setIsExtending(false);
    }
  }, [extendSession, isExtending]);

  // Handle warning dismissal
  const handleDismissWarning = useCallback(() => {
    dismissSessionWarning();
    setWarningStage('none');
  }, [dismissSessionWarning]);

  // Handle logout
  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  return {
    timeRemaining,
    warningStage,
    isExtending,
    extendSession: handleExtendSession,
    dismissWarning: handleDismissWarning,
    logout: handleLogout
  };
};

export default useSessionManager;
