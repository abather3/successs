import axios from 'axios';
import { AuthResponse, User } from '../types';

// Use consistent API URL logic for Docker development
// Prioritize nginx proxy detection over environment variables
const getApiBaseUrl = () => {
  const currentLocation = window.location;
  console.log('[AUTH] Location detection:', {
    port: currentLocation.port,
    protocol: currentLocation.protocol,
    host: currentLocation.host,
    href: currentLocation.href
  });
  
  // First priority: Detect nginx proxy access (port 80 or no port specified)
  const isNginxProxy = currentLocation.port === '80' || currentLocation.port === '' || currentLocation.port === undefined;
  
  if (isNginxProxy) {
    console.log('[AUTH] Detected nginx proxy access - using /api');
    return '/api';
  }
  
  // Second priority: Explicit environment variable for direct access
  if (process.env.REACT_APP_API_URL) {
    console.log('[AUTH] Using environment variable:', process.env.REACT_APP_API_URL);
    return process.env.REACT_APP_API_URL;
  }
  
  // Fallback: Use proxy path
  console.log('[AUTH] Using fallback - /api');
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Support cookies
});

// Token management
class TokenManager {
  private static refreshPromise: Promise<string> | null = null;
  private static tokenExpiryTimer: NodeJS.Timeout | null = null;
  private static _isLoginInProgress: boolean = false;
  private static loginPromise: Promise<void> | null = null;

  static getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  static getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  /**
   * Sets tokens and schedules refresh. During login, suppresses automatic refresh.
   */
  static setTokens(accessToken: string, refreshToken: string, expiresAt?: number): void {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    
    if (expiresAt) {
      localStorage.setItem('tokenExpiresAt', expiresAt.toString());
    }

    // Only schedule refresh if not during login process
    if (!this._isLoginInProgress) {
      this.scheduleTokenRefresh();
    }
  }

  static clearTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenExpiresAt');
    
    if (this.tokenExpiryTimer) {
      clearTimeout(this.tokenExpiryTimer);
      this.tokenExpiryTimer = null;
    }
    
    // Clear any in-flight refresh
    this.refreshPromise = null;
  }

  /**
   * Marks login as in progress to suppress automatic refresh
   */
  static startLogin(): void {
    this._isLoginInProgress = true;
    // Cancel any scheduled refresh during login
    if (this.tokenExpiryTimer) {
      clearTimeout(this.tokenExpiryTimer);
      this.tokenExpiryTimer = null;
    }
  }

  /**
   * Completes login process and resumes normal token management
   */
  static completeLogin(): void {
    this._isLoginInProgress = false;
    this.loginPromise = null;
    // Schedule refresh now that login is complete
    this.scheduleTokenRefresh();
  }

  /**
   * Sets a login promise for coordination
   */
  static setLoginPromise(promise: Promise<void>): void {
    this.loginPromise = promise;
  }

  /**
   * Waits for any in-progress login before proceeding with refresh
   */
  private static async waitForLoginCompletion(): Promise<void> {
    if (this.loginPromise) {
      try {
        await this.loginPromise;
      } catch {
        // Login failed, continue with refresh attempt
      }
    }
  }

  /**
   * Returns whether login is currently in progress
   */
  static isLoginInProgress(): boolean {
    return this._isLoginInProgress;
  }

  static isTokenExpiringSoon(): boolean {
    const expiresAt = localStorage.getItem('tokenExpiresAt');
    if (!expiresAt) return false;
    
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
    return Date.now() >= (parseInt(expiresAt) - bufferTime);
  }

  static scheduleTokenRefresh(): void {
    if (this.tokenExpiryTimer) {
      clearTimeout(this.tokenExpiryTimer);
    }

    const expiresAt = localStorage.getItem('tokenExpiresAt');
    if (!expiresAt) return;

    const refreshTime = parseInt(expiresAt) - Date.now() - (5 * 60 * 1000); // 5 minutes before expiry
    
    if (refreshTime > 0) {
      this.tokenExpiryTimer = setTimeout(() => {
        this.refreshToken();
      }, refreshTime);
    }
  }

  static async refreshToken(): Promise<string> {
    // Wait for any in-progress login to complete first
    await this.waitForLoginCompletion();
    
    // Don't refresh during login process
    if (this._isLoginInProgress) {
      throw new Error('Cannot refresh token during login process');
    }
    
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh();
    
    try {
      const newToken = await this.refreshPromise;
      return newToken;
    } finally {
      this.refreshPromise = null;
    }
  }

  private static async performRefresh(): Promise<string> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await api.post('/auth/refresh', {
      refreshToken,
    });

    const { accessToken, refreshToken: newRefreshToken, expiresAt } = response.data;
    
    this.setTokens(accessToken, newRefreshToken || refreshToken, expiresAt);
    
    return accessToken;
  }
}

// Add interceptor to include auth token
api.interceptors.request.use(async (config) => {
  // Don't add auth headers to login/register/public endpoints
  if (config.url?.includes('/auth/login') || 
      config.url?.includes('/auth/register') || 
      config.url?.includes('/auth/request-password-reset') ||
      config.url?.includes('/auth/reset-password') ||
      config.url?.includes('/auth/verify-reset-token')) {
    return config;
  }
  
  let token = TokenManager.getAccessToken();
  
  // Skip proactive token refresh during login process
  if (token && TokenManager.isTokenExpiringSoon() && !TokenManager.isLoginInProgress()) {
    try {
      token = await TokenManager.refreshToken();
    } catch (error) {
      console.error('Proactive token refresh failed:', error);
    }
  }
  
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  
  return config;
});

// Add interceptor to handle token refresh on 401/403
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    
    // Don't try to refresh tokens for login requests - let them fail normally
    if (original.url?.includes('/auth/login')) {
      return Promise.reject(error);
    }
    
    // Handle 401/403 errors for authenticated requests only
    if ((error.response?.status === 401 || error.response?.status === 403) && !original._retry) {
      original._retry = true;
      
      // Check if the error is specifically TOKEN_EXPIRED
      if (error.response?.data?.error?.code === 'TOKEN_EXPIRED') {
        // Trigger SessionExpiredDialog
        window.dispatchEvent(new CustomEvent('session-expired-dialog'));
        
        try {
          // Attempt silent refresh once
          const newToken = await TokenManager.refreshToken();
          original.headers['Authorization'] = `Bearer ${newToken}`;
          
          // Retry the original request
          return api(original);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          TokenManager.clearTokens();
          
          // If refresh fails, logout and redirect to login
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          
          return Promise.reject(refreshError);
        }
      } else {
        // Handle other 401/403 errors (non-TOKEN_EXPIRED) but only if we have refresh token
        const refreshToken = TokenManager.getRefreshToken();
        if (refreshToken) {
          try {
            const newToken = await TokenManager.refreshToken();
            original.headers['Authorization'] = `Bearer ${newToken}`;
            return api(original);
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            TokenManager.clearTokens();
            
            // Emit custom event for session expiry
            window.dispatchEvent(new CustomEvent('session-expired'));
            
            if (window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
            
            return Promise.reject(refreshError);
          }
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export const authService = {
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { accessToken, refreshToken } = response.data;
      
      // Set tokens with expiry calculation (30 minutes)
      const expiresAt = Date.now() + (30 * 60 * 1000);
      TokenManager.setTokens(accessToken, refreshToken, expiresAt);
      
      return response.data;
    } catch (error: any) {
      // Clear any existing tokens on login failure to ensure clean state
      TokenManager.clearTokens();
      
      // Handle different error response formats
      let errorMessage = 'Login failed';
      
      if (error.response?.data) {
        const data = error.response.data;
        // Handle backend format: { error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } }
        if (data.error?.message) {
          errorMessage = data.error.message;
        }
        // Handle legacy format: { error: "Auth error [INVALID_CREDENTIALS]: Invalid email or password" }
        else if (data.error && typeof data.error === 'string') {
          errorMessage = data.error;
        }
        // Handle format: { message: "Invalid credentials" }
        else if (data.message) {
          errorMessage = data.message;
        }
      }
      
      // Clean up the error message for display
      if (errorMessage.includes('INVALID_CREDENTIALS') || errorMessage.includes('Invalid email or password')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      }
      
      throw new Error(errorMessage);
    }
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      TokenManager.clearTokens();
    }
  },

  async verifyToken(): Promise<User> {
    try {
      const response = await api.get('/auth/verify');
      return response.data.user;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Token verification failed');
    }
  },

  async changePassword(email: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      await api.post('/auth/change-password', {
        email,
        currentPassword,
        newPassword,
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Password change failed');
    }
  },

  async resetPassword(email: string): Promise<void> {
    try {
      await api.post('/auth/request-password-reset', { email });
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Password reset failed');
    }
  },
  
  // Utility methods
  isAuthenticated(): boolean {
    return !!TokenManager.getAccessToken();
  },
  
  getAccessToken(): string | null {
    return TokenManager.getAccessToken();
  },
  
  async refreshToken(): Promise<string> {
    return TokenManager.refreshToken();
  },
  
  clearTokens(): void {
    TokenManager.clearTokens();
  }
};

// Export TokenManager for advanced usage
export { TokenManager };

export default api;
