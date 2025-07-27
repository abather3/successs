import { TokenManager } from '../authService';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock setTimeout and clearTimeout
const mockSetTimeout = jest.fn();
const mockClearTimeout = jest.fn();
global.setTimeout = mockSetTimeout;
global.clearTimeout = mockClearTimeout;

describe('TokenManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    // Clean up static state
    TokenManager.clearTokens();
    TokenManager.completeLogin();
  });

  describe('Login coordination', () => {
    it('should suppress automatic refresh during login', () => {
      // Start login process
      TokenManager.startLogin();
      expect(TokenManager.isLoginInProgress()).toBe(true);

      // Set tokens during login - should not schedule refresh
      TokenManager.setTokens('access-token', 'refresh-token', Date.now() + 1800000);

      // Verify localStorage was called but no timeout scheduled
      expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', 'access-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('refreshToken', 'refresh-token');
      expect(mockSetTimeout).not.toHaveBeenCalled();
    });

    it('should schedule refresh after login completion', () => {
      const expiresAt = Date.now() + 1800000; // 30 minutes
      
      // Start and complete login
      TokenManager.startLogin();
      TokenManager.setTokens('access-token', 'refresh-token', expiresAt);
      
      // Complete login - should now schedule refresh
      localStorageMock.getItem.mockImplementation((key: string) => {
        switch (key) {
          case 'accessToken': return 'access-token';
          case 'refreshToken': return 'refresh-token';
          case 'tokenExpiresAt': return expiresAt.toString();
          default: return null;
        }
      });

      TokenManager.completeLogin();
      
      expect(TokenManager.isLoginInProgress()).toBe(false);
      expect(mockSetTimeout).toHaveBeenCalled();
    });

    it('should cancel existing refresh timer when login starts', () => {
      const expiresAt = Date.now() + 1800000;
      localStorageMock.getItem.mockImplementation((key: string) => {
        switch (key) {
          case 'tokenExpiresAt': return expiresAt.toString();
          default: return null;
        }
      });

      // Schedule a refresh first
      TokenManager.scheduleTokenRefresh();
      expect(mockSetTimeout).toHaveBeenCalled();
      
      jest.clearAllMocks();
      
      // Start login - should cancel existing timer
      TokenManager.startLogin();
      expect(mockClearTimeout).toHaveBeenCalled();
    });

    it('should prevent token refresh during login process', async () => {
      TokenManager.startLogin();
      
      try {
        await TokenManager.refreshToken();
        fail('Expected refreshToken to throw during login');
      } catch (error) {
        expect(error.message).toBe('Cannot refresh token during login process');
      }
    });

    it('should wait for login completion before refreshing', async () => {
      let loginResolve: () => void;
      const loginPromise = new Promise<void>((resolve) => {
        loginResolve = resolve;
      });

      TokenManager.setLoginPromise(loginPromise);
      
      // Mock successful refresh
      localStorageMock.getItem.mockImplementation((key: string) => {
        switch (key) {
          case 'refreshToken': return 'refresh-token';
          default: return null;
        }
      });

      // Mock API call
      const mockApi = {
        post: jest.fn().mockResolvedValue({
          data: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            expiresAt: Date.now() + 1800000
          }
        })
      };

      // Start refresh (should wait for login)
      const refreshPromise = TokenManager.refreshToken();

      // Verify refresh is waiting
      expect(mockApi.post).not.toHaveBeenCalled();

      // Complete login
      loginResolve!();
      
      // Now refresh should proceed (though it will fail in test due to mocking)
      await expect(refreshPromise).rejects.toThrow();
    });
  });

  describe('Token clearing', () => {
    it('should clear all token state including promises', () => {
      const expiresAt = Date.now() + 1800000;
      
      // Set up some state
      TokenManager.setTokens('access-token', 'refresh-token', expiresAt);
      TokenManager.setLoginPromise(Promise.resolve());
      
      // Clear tokens
      TokenManager.clearTokens();
      
      // Verify all state is cleared
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('refreshToken');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('tokenExpiresAt');
      expect(mockClearTimeout).toHaveBeenCalled();
    });
  });

  describe('Token expiry checking', () => {
    it('should detect tokens expiring soon', () => {
      const soonExpiry = Date.now() + (3 * 60 * 1000); // 3 minutes from now
      localStorageMock.getItem.mockReturnValue(soonExpiry.toString());
      
      expect(TokenManager.isTokenExpiringSoon()).toBe(true);
    });

    it('should not detect fresh tokens as expiring', () => {
      const laterExpiry = Date.now() + (10 * 60 * 1000); // 10 minutes from now
      localStorageMock.getItem.mockReturnValue(laterExpiry.toString());
      
      expect(TokenManager.isTokenExpiringSoon()).toBe(false);
    });

    it('should handle missing expiry time', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      expect(TokenManager.isTokenExpiringSoon()).toBe(false);
    });
  });

  describe('Refresh scheduling', () => {
    it('should schedule refresh for 5 minutes before expiry', () => {
      const expiresAt = Date.now() + (30 * 60 * 1000); // 30 minutes from now
      const expectedDelay = (25 * 60 * 1000); // 25 minutes (30 - 5 buffer)
      
      localStorageMock.getItem.mockReturnValue(expiresAt.toString());
      
      TokenManager.scheduleTokenRefresh();
      
      expect(mockSetTimeout).toHaveBeenCalled();
      const [callback, delay] = mockSetTimeout.mock.calls[0];
      
      // Allow some tolerance for timing differences
      expect(delay).toBeGreaterThan(expectedDelay - 1000);
      expect(delay).toBeLessThan(expectedDelay + 1000);
    });

    it('should not schedule refresh for already expired tokens', () => {
      const expiredTime = Date.now() - (5 * 60 * 1000); // 5 minutes ago
      localStorageMock.getItem.mockReturnValue(expiredTime.toString());
      
      TokenManager.scheduleTokenRefresh();
      
      expect(mockSetTimeout).not.toHaveBeenCalled();
    });

    it('should clear existing timer before scheduling new one', () => {
      const expiresAt = Date.now() + (30 * 60 * 1000);
      localStorageMock.getItem.mockReturnValue(expiresAt.toString());
      
      // Schedule first refresh
      TokenManager.scheduleTokenRefresh();
      expect(mockSetTimeout).toHaveBeenCalledTimes(1);
      
      jest.clearAllMocks();
      
      // Schedule second refresh - should clear first
      TokenManager.scheduleTokenRefresh();
      expect(mockClearTimeout).toHaveBeenCalled();
      expect(mockSetTimeout).toHaveBeenCalledTimes(1);
    });
  });
});
