import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { User, AuthResponse } from '../types';
import { authService, TokenManager } from '../services/authService';

// Production-safe debug logging - disabled by default
const logWithTimestamp = (message: string, data?: any) => {
  // Only log in development if DEBUG_AUTH is explicitly enabled
  if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_AUTH === 'true') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AUTH_CONTEXT] ${message}`, data || '');
  }
};

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
  sessionExpireWarning: boolean;
  sessionExpiredDialogOpen: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  extendSession: () => void;
  dismissSessionWarning: () => void;
  closeSessionExpiredDialog: () => void;
}

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: AuthResponse }
  | { type: 'LOGIN_ERROR'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SESSION_EXPIRE_WARNING'; payload: boolean }
  | { type: 'SESSION_EXPIRED_DIALOG'; payload: boolean }
  | { type: 'TOKEN_REFRESH_SUCCESS'; payload: { accessToken: string; refreshToken: string } };

// Clear any expired tokens immediately
const checkAndClearExpiredTokens = () => {
  logWithTimestamp('🔍 Checking for expired tokens on initialization');
  const token = TokenManager.getAccessToken();
  
  if (token) {
    logWithTimestamp('Found access token, checking expiration', { tokenLength: token.length });
    try {
      // Check if token is expired by parsing the JWT
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      
      logWithTimestamp('Token payload parsed', {
        exp: payload.exp,
        currentTime,
        isExpired: payload.exp && payload.exp < currentTime
      });
      
      if (payload.exp && payload.exp < currentTime) {
        // Token is expired, clear it
        logWithTimestamp('⚠️ Token expired, clearing tokens');
        TokenManager.clearTokens();
        return { accessToken: null, refreshToken: null };
      }
    } catch (error) {
      // Invalid token format, clear it
      logWithTimestamp('⚠️ Invalid token format, clearing tokens', error);
      TokenManager.clearTokens();
      return { accessToken: null, refreshToken: null };
    }
  } else {
    logWithTimestamp('No access token found in storage');
  }
  
  const tokens = {
    accessToken: TokenManager.getAccessToken(),
    refreshToken: TokenManager.getRefreshToken()
  };
  
  logWithTimestamp('Token check completed', {
    hasAccessToken: !!tokens.accessToken,
    hasRefreshToken: !!tokens.refreshToken
  });
  
  return tokens;
};

const { accessToken, refreshToken } = checkAndClearExpiredTokens();

const initialState: AuthState = {
  user: null,
  accessToken,
  refreshToken,
  isLoading: false,
  error: null,
  sessionExpireWarning: false,
  sessionExpiredDialogOpen: false,
};

logWithTimestamp('📋 Initial AuthContext state created', {
  hasAccessToken: !!initialState.accessToken,
  hasRefreshToken: !!initialState.refreshToken,
  isLoading: initialState.isLoading,
  user: initialState.user
});

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  logWithTimestamp(`🔄 Auth reducer called with action: ${action.type}`, {
    currentUser: state.user ? { id: state.user.id, email: state.user.email } : null,
    currentLoading: state.isLoading,
    actionPayload: action.type.includes('SUCCESS') || action.type.includes('ERROR') ? 
      (action as any).payload : undefined
  });
  
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'LOGIN_SUCCESS':
      logWithTimestamp('✅ LOGIN_SUCCESS: Setting user and tokens', {
        user: { id: action.payload.user.id, email: action.payload.user.email },
        hasAccessToken: !!action.payload.accessToken,
        hasRefreshToken: !!action.payload.refreshToken
      });
      return {
        ...state,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken,
        isLoading: false,
        error: null,
      };
    case 'LOGIN_ERROR':
      // Ensure complete state cleanup on login error
      logWithTimestamp('❌ LOGIN_ERROR: Clearing all auth state', {
        error: action.payload,
        previousUser: state.user ? { id: state.user.id, email: state.user.email } : null,
        previousLoading: state.isLoading
      });
      // Clear tokens from storage to ensure clean state
      TokenManager.clearTokens();
      return {
        ...state,
        user: null,
        accessToken: null,
        refreshToken: null,
        isLoading: false,
        error: action.payload,
        sessionExpireWarning: false,
        sessionExpiredDialogOpen: false,
      };
    case 'LOGOUT':
      logWithTimestamp('🚪 LOGOUT: Clearing user and tokens');
      return {
        ...state,
        user: null,
        accessToken: null,
        refreshToken: null,
        isLoading: false,
        error: null,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    case 'SESSION_EXPIRE_WARNING':
      return {
        ...state,
        sessionExpireWarning: action.payload,
      };
    case 'SESSION_EXPIRED_DIALOG':
      return {
        ...state,
        sessionExpiredDialogOpen: action.payload,
      };
    case 'TOKEN_REFRESH_SUCCESS':
      return {
        ...state,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken,
        sessionExpireWarning: false,
      };
    default:
      return state;
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  
  logWithTimestamp('🏗️ AuthProvider component rendered', {
    user: state.user ? { id: state.user.id, email: state.user.email } : null,
    isLoading: state.isLoading,
    hasAccessToken: !!state.accessToken,
    currentPath: typeof window !== 'undefined' ? window.location.pathname : 'unknown'
  });

  useEffect(() => {
    logWithTimestamp('🚀 AuthProvider initialization effect triggered', {
      hasAccessToken: !!state.accessToken,
      currentPath: window.location.pathname,
      shouldInitialize: !!state.accessToken
    });
    
    // Always verify token if available to ensure consistent auth state
    // regardless of current route to prevent state mismatches
    const initializeAuth = async () => {
      if (state.accessToken) {
        logWithTimestamp('🔐 Starting token verification...', {
          tokenLength: state.accessToken.length,
          currentPath: window.location.pathname
        });
        
        try {
          const user = await authService.verifyToken();
          logWithTimestamp('✅ Token verification successful, dispatching LOGIN_SUCCESS', {
            user: { id: user.id, email: user.email }
          });
          
          dispatch({ 
            type: 'LOGIN_SUCCESS', 
            payload: { 
              user, 
              accessToken: state.accessToken!, 
              refreshToken: state.refreshToken! 
            } 
          });
        } catch (error) {
          logWithTimestamp('❌ Token verification failed, logging out', error);
          TokenManager.clearTokens();
          dispatch({ type: 'LOGOUT' });
        }
      } else {
        logWithTimestamp('⏭️ Skipping token verification - no token available', {
          hasToken: !!state.accessToken,
          currentPath: window.location.pathname
        });
      }
    };

    // Always initialize if we have a token, regardless of current route
    if (state.accessToken) {
      logWithTimestamp('🎯 Calling initializeAuth...');
      initializeAuth();
    } else {
      logWithTimestamp('🚫 Skipping initialization - no access token');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Session management effects
  useEffect(() => {
    const handleSessionExpired = () => {
      dispatch({ type: 'SESSION_EXPIRE_WARNING', payload: true });
    };

    const handleSessionExpiredDialog = () => {
      dispatch({ type: 'SESSION_EXPIRED_DIALOG', payload: true });
    };

    const handleUserActivity = () => {
      // Reset session expiry warning on user activity
      if (state.sessionExpireWarning) {
        dispatch({ type: 'SESSION_EXPIRE_WARNING', payload: false });
      }
    };

    // Listen for session expiry events
    window.addEventListener('session-expired', handleSessionExpired);
    window.addEventListener('session-expired-dialog', handleSessionExpiredDialog);
    
    // Listen for user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      document.addEventListener(event, handleUserActivity, true);
    });

    return () => {
      window.removeEventListener('session-expired', handleSessionExpired);
      window.removeEventListener('session-expired-dialog', handleSessionExpiredDialog);
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleUserActivity, true);
      });
    };
  }, [state.sessionExpireWarning]);

  const login = async (email: string, password: string) => {
    logWithTimestamp('🔑 Login function called', {
      email,
      currentUser: state.user ? { id: state.user.id, email: state.user.email } : null
    });
    
    // Create login promise for coordination
    const loginPromise = (async () => {
      try {
        logWithTimestamp('📤 Dispatching LOGIN_START...');
        dispatch({ type: 'LOGIN_START' });
        
        // Mark login as in progress to prevent automatic token refresh
        TokenManager.startLogin();
        
        logWithTimestamp('🌐 Calling authService.login...');
        const response = await authService.login(email, password);
        
        logWithTimestamp('✅ authService.login successful, dispatching LOGIN_SUCCESS', {
          user: { id: response.user.id, email: response.user.email },
          hasAccessToken: !!response.accessToken,
          hasRefreshToken: !!response.refreshToken
        });
        
        // Tokens are already stored by the authService
        // Just dispatch the success action
        dispatch({ type: 'LOGIN_SUCCESS', payload: response });
        
        // Clear any existing session warnings
        dispatch({ type: 'SESSION_EXPIRE_WARNING', payload: false });
        dispatch({ type: 'SESSION_EXPIRED_DIALOG', payload: false });
        
        logWithTimestamp('🎉 Login process completed successfully');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Login failed';
        logWithTimestamp('❌ Login failed, dispatching LOGIN_ERROR', {
          error: errorMessage
        });
        dispatch({ type: 'LOGIN_ERROR', payload: errorMessage });
        throw error;
      } finally {
        // Complete login process regardless of success/failure
        TokenManager.completeLogin();
      }
    })();
    
    // Set the login promise for coordination with token refresh
    TokenManager.setLoginPromise(loginPromise);
    
    return loginPromise;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      dispatch({ type: 'LOGOUT' });
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const extendSession = async () => {
    try {
      const newToken = await authService.refreshToken();
      dispatch({ 
        type: 'TOKEN_REFRESH_SUCCESS', 
        payload: { 
          accessToken: newToken, 
          refreshToken: TokenManager.getRefreshToken() || '' 
        } 
      });
    } catch (error) {
      console.error('Failed to extend session:', error);
      dispatch({ type: 'LOGOUT' });
    }
  };

  const dismissSessionWarning = () => {
    dispatch({ type: 'SESSION_EXPIRE_WARNING', payload: false });
  };

  const closeSessionExpiredDialog = () => {
    dispatch({ type: 'SESSION_EXPIRED_DIALOG', payload: false });
  };

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    clearError,
    extendSession,
    dismissSessionWarning,
    closeSessionExpiredDialog,
  };

  // Session timing will be handled by the useSessionManager hook

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
