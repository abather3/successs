import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import CircularLogo from '../CircularLogo';

// Debug helper to log with timestamp
const logWithTimestamp = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [LOGIN] ${message}`, data || '');
};

const Login: React.FC = () => {
  const { login, error, clearError, user, isLoading, accessToken } = useAuth();
  const { darkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Log initial component state
  logWithTimestamp('Login component mounted/re-rendered', {
    user: user ? { id: user.id, email: user.email } : null,
    isLoading,
    error,
    pathname: location.pathname,
    hasSuccessMessage: !!successMessage
  });

  // Check for success message from password reset
  useEffect(() => {
    logWithTimestamp('Success message effect triggered', {
      hasMessage: !!location.state?.message,
      message: location.state?.message,
      pathname: location.pathname
    });
    
    if (location.state?.message) {
      logWithTimestamp('Setting success message from location state', location.state.message);
      setSuccessMessage(location.state.message);
      // Clear the message from navigation state
      navigate(location.pathname, { replace: true, state: undefined });
      logWithTimestamp('Cleared message from navigation state');
    }
  }, [location.state, navigate, location.pathname]);

  // Redirect to dashboard after successful login
  useEffect(() => {
    logWithTimestamp('User redirect effect triggered', {
      user: user ? { id: user.id, email: user.email } : null,
      isLoading,
      error,
      hasAccessToken: !!accessToken,
      hasSuccessMessage: !!successMessage,
      willRedirect: !!(user && accessToken && !isLoading && !error && !successMessage),
      currentPath: location.pathname
    });
    
    // Only redirect if:
    // 1. User is authenticated (both user and accessToken exist)
    // 2. Not currently loading (prevents redirect during auth verification)
    // 3. No error occurred (prevents redirect after failed login attempts)
    // 4. No success message is showing (prevents redirect while showing password reset confirmation)
    if (user && accessToken && !isLoading && !error && !successMessage) {
      logWithTimestamp('🚨 REDIRECT TRIGGERED: Successful login detected, navigating to /', {
        user: { id: user.id, email: user.email },
        hasAccessToken: !!accessToken,
        isLoading,
        error,
        hasSuccessMessage: !!successMessage,
        currentPath: location.pathname
      });
      navigate('/', { replace: true });
      logWithTimestamp('Navigate to / executed');
    } else {
      logWithTimestamp('🚫 REDIRECT BLOCKED:', {
        user: !!user,
        hasAccessToken: !!accessToken,
        isLoading,
        error,
        hasSuccessMessage: !!successMessage,
        reason: !user ? 'no user' : !accessToken ? 'no access token' : isLoading ? 'still loading' : error ? 'error occurred' : successMessage ? 'success message showing' : 'unknown'
      });
    }
  }, [user, accessToken, navigate, isLoading, error, successMessage, location.pathname]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    // Prevent multiple submissions while loading
    if (isLoading) {
      logWithTimestamp('⚠️ Login submission blocked - already in progress');
      return;
    }
    
    logWithTimestamp('🔐 Login form submitted', {
      email,
      isLoading,
      currentUser: user ? { id: user.id, email: user.email } : null
    });
    
    try {
      logWithTimestamp('Calling login function...');
      await login(email, password);
      logWithTimestamp('✅ Login function completed successfully');
      // Success - navigation will happen automatically when user is set
    } catch (error) {
      logWithTimestamp('❌ Login function failed', error);
      // Clear password field on failed login for security
      setPassword('');
      // Error handling is done in AuthContext
      // Ensure loading state is cleared by clearing any potential error state
      if (error instanceof Error && error.message.includes('INVALID_CREDENTIALS')) {
        logWithTimestamp('🚨 Invalid credentials detected, ensuring clean error state');
      }
    }
  };

  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setter(event.target.value);
    if (error) clearError();
    if (successMessage) setSuccessMessage('');
  };

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 ${
      darkMode 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' 
        : 'bg-gradient-to-br from-primary-50 via-white to-accent-50'
    }`}>
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <CircularLogo size={64} alt="Welcome to EscaShop" />
          </div>
          <h2 className={`mt-6 text-3xl font-bold ${
            darkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Welcome to ESCA SHOP
          </h2>
          <p className={`mt-2 text-sm ${
            darkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
            PREMIUM EYEWEAR
          </p>
        </div>

        {/* Login Form */}
        <div className={`py-8 px-6 shadow-xl rounded-2xl border ${
          darkMode 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-100'
        }`}>
          {successMessage && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${
              darkMode 
                ? 'bg-green-900/20 border-green-700 text-green-300' 
                : 'bg-green-50 border-green-200 text-green-700'
            }`}>
              {successMessage}
            </div>
          )}
          
          {error && (
            <div className={`mb-4 px-4 py-3 rounded-lg text-sm border flex items-start justify-between ${
              darkMode 
                ? 'bg-red-900/20 border-red-700 text-red-300' 
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              <div className="flex items-start">
                {/* Error Icon */}
                <svg 
                  className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" 
                  fill="currentColor" 
                  viewBox="0 0 20 20"
                >
                  <path 
                    fillRule="evenodd" 
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
                    clipRule="evenodd" 
                  />
                </svg>
                <span className="flex-1">{error}</span>
              </div>
              {/* Dismiss Button */}
              <button
                type="button"
                onClick={clearError}
                className={`ml-2 flex-shrink-0 p-0.5 rounded transition-colors ${
                  darkMode
                    ? 'text-red-400 hover:text-red-300 hover:bg-red-800/30'
                    : 'text-red-500 hover:text-red-700 hover:bg-red-100'
                }`}
                aria-label="Dismiss error"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path 
                    fillRule="evenodd" 
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" 
                    clipRule="evenodd" 
                  />
                </svg>
              </button>
            </div>
          )}
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className={`block text-sm font-medium mb-2 ${
                darkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                autoFocus
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
                placeholder="Enter your email address"
                value={email}
                onChange={handleInputChange(setEmail)}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="password" className={`block text-sm font-medium ${
                  darkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className={`text-xs font-medium ${
                    darkMode 
                      ? 'text-primary-400 hover:text-primary-300' 
                      : 'text-primary-600 hover:text-primary-500'
                  }`}
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
                placeholder="Enter your password"
                value={password}
                onChange={handleInputChange(setPassword)}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {isLoading ? (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013 3v1" />
                  </svg>
                )}
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className={`text-xs ${
            darkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            © 2025 ESCA SHOP PREMIUM EYEWEAR. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

