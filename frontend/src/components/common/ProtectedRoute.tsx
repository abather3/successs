import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import { CircularProgress, Box } from '@mui/material';

// Production-safe debug logging - disabled by default
const logWithTimestamp = (message: string, data?: any) => {
  // Only log in development if DEBUG_ROUTES is explicitly enabled
  if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_DEBUG_ROUTES === 'true') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [PROTECTED_ROUTE] ${message}`, data || '');
  }
};

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  requiredRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole, requiredRoles }) => {
  const { user, isLoading, accessToken } = useAuth();
  
  logWithTimestamp('ProtectedRoute render', {
    user: user ? { id: user.id, email: user.email, role: user.role } : null,
    isLoading,
    hasAccessToken: !!accessToken,
    requiredRole,
    requiredRoles,
    currentPath: typeof window !== 'undefined' ? window.location.pathname : 'unknown'
  });

  // Show loading if auth is in progress OR if we have a token but no user yet (auth verification in progress)
  if (isLoading || (accessToken && !user)) {
    logWithTimestamp('🔄 Showing loading spinner - auth in progress', {
      isLoading,
      hasAccessToken: !!accessToken,
      hasUser: !!user,
      currentPath: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      reason: isLoading ? 'isLoading is true' : 'has token but no user (verification in progress)'
    });
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  // Only redirect to login if we have no user AND no access token (fully unauthenticated)
  if (!user && !accessToken) {
    logWithTimestamp('🚨 NO USER & NO TOKEN - Redirecting to /login', {
      isLoading,
      hasAccessToken: !!accessToken,
      hasUser: !!user,
      currentPath: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      reason: 'No user and no access token - fully unauthenticated'
    });
    return <Navigate to="/login" replace />;
  }

  // If we have a token but no user, something is wrong - wait for auth to resolve
  if (!user && accessToken) {
    logWithTimestamp('⏳ Has token but no user - waiting for auth verification', {
      hasAccessToken: !!accessToken,
      hasUser: !!user,
      currentPath: typeof window !== 'undefined' ? window.location.pathname : 'unknown'
    });
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  // At this point, we know user exists (previous checks ensure this)
  // But TypeScript doesn't know, so we add an extra safety check
  if (!user) {
    logWithTimestamp('🚨 Unexpected null user after auth checks - redirecting to login', {
      currentPath: typeof window !== 'undefined' ? window.location.pathname : 'unknown'
    });
    return <Navigate to="/login" replace />;
  }

  // Check role requirements
  const hasRequiredRole = () => {
    if (user.role === UserRole.ADMIN) return true; // Admin has access to everything
    
    if (requiredRoles && requiredRoles.length > 0) {
      return requiredRoles.includes(user.role);
    }
    
    if (requiredRole) {
      return user.role === requiredRole;
    }
    
    return true; // No specific role requirement
  };

  if (!hasRequiredRole()) {
    logWithTimestamp('🚨 INSUFFICIENT ROLE - Redirecting to /', {
      userRole: user.role,
      requiredRole,
      requiredRoles,
      currentPath: typeof window !== 'undefined' ? window.location.pathname : 'unknown'
    });
    return <Navigate to="/" replace />;
  }

  logWithTimestamp('✅ Access granted - rendering protected content', {
    user: { id: user.id, email: user.email, role: user.role },
    requiredRole,
    currentPath: typeof window !== 'undefined' ? window.location.pathname : 'unknown'
  });
  
  return <>{children}</>;
};

export default ProtectedRoute;
