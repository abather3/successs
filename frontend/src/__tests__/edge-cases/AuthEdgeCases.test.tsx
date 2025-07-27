import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { ThemeProvider } from '../../contexts/ThemeContext';
import Login from '../../components/auth/Login';
import ProtectedRoute from '../../components/common/ProtectedRoute';
import { UserRole } from '../../types';

// Mock the auth service with comprehensive mock functions
const mockAuthService = {
  login: jest.fn(),
  logout: jest.fn(),
  verifyToken: jest.fn(),
  refreshToken: jest.fn(),
};

const mockTokenManager = {
  getAccessToken: jest.fn(() => null),
  getRefreshToken: jest.fn(() => null),
  clearTokens: jest.fn(),
  setTokens: jest.fn(),
  startLogin: jest.fn(),
  completeLogin: jest.fn(),
  setLoginPromise: jest.fn(),
  isLoginInProgress: jest.fn(() => false),
  isTokenExpiringSoon: jest.fn(() => false),
  scheduleTokenRefresh: jest.fn(),
};

jest.mock('../../services/authService', () => ({
  authService: mockAuthService,
  TokenManager: mockTokenManager,
}));

// Mock navigate function
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Helper function to render components with required providers
const renderWithProviders = (component: React.ReactElement, initialEntries?: string[]) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ThemeProvider>
        <AuthProvider>
          {component}
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
};

// Mock user data
const mockUser = {
  id: 1,
  email: 'test@example.com',
  role: UserRole.ADMIN,
  name: 'Test User'
};

const mockAuthResponse = {
  user: mockUser,
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token'
};

describe('Authentication Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
    // Reset token manager mocks to default state
    mockTokenManager.getAccessToken.mockReturnValue(null);
    mockTokenManager.getRefreshToken.mockReturnValue(null);
    mockTokenManager.isLoginInProgress.mockReturnValue(false);
    mockTokenManager.isTokenExpiringSoon.mockReturnValue(false);
  });

  describe('Login with Valid Credentials', () => {
    it('should successfully login with valid credentials and redirect', async () => {
      mockAuthService.login.mockResolvedValue(mockAuthResponse);
      
      renderWithProviders(<Login />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'correct-password' } });
      
      await act(async () => {
        fireEvent.click(submitButton);
      });
      
      await waitFor(() => {
        expect(mockAuthService.login).toHaveBeenCalledWith('test@example.com', 'correct-password');
      });
      
      // Verify successful login flow
      expect(mockTokenManager.startLogin).toHaveBeenCalled();
      expect(mockTokenManager.completeLogin).toHaveBeenCalled();
    });

    it('should prevent multiple simultaneous login attempts', async () => {
      let loginResolve: (value: any) => void;
      const loginPromise = new Promise((resolve) => {
        loginResolve = resolve;
      });
      
      mockAuthService.login.mockReturnValue(loginPromise);
      
      renderWithProviders(<Login />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password' } });
      
      // First login attempt
      fireEvent.click(submitButton);
      
      // Button should be disabled during login
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
      
      // Second login attempt while first is in progress
      fireEvent.click(submitButton);
      
      // Should only call login once
      expect(mockAuthService.login).toHaveBeenCalledTimes(1);
      
      // Complete the first login
      loginResolve!(mockAuthResponse);
    });
  });

  describe('Login with Invalid Credentials', () => {
    it('should handle invalid email format', async () => {
      renderWithProviders(<Login />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.change(passwordInput, { target: { value: 'password' } });
      fireEvent.click(submitButton);
      
      // HTML5 validation should prevent submission
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('should handle login failure with error message', async () => {
      const errorMessage = 'Invalid email or password';
      mockAuthService.login.mockRejectedValue(new Error(errorMessage));
      
      renderWithProviders(<Login />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrong-password' } });
      
      await act(async () => {
        fireEvent.click(submitButton);
      });
      
      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
      
      // Password should be cleared for security
      expect(passwordInput).toHaveValue('');
      
      // Should not redirect on error
      expect(mockNavigate).not.toHaveBeenCalledWith('/', { replace: true });
    });

    it('should handle network failures gracefully', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Network Error'));
      
      renderWithProviders(<Login />);
      
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(screen.getByText('Network Error')).toBeInTheDocument();
      });
      
      // Verify error can be dismissed
      const dismissButton = screen.getByLabelText('Dismiss error');
      fireEvent.click(dismissButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Network Error')).not.toBeInTheDocument();
      });
    });
  });

  describe('Initial Page Load Scenarios', () => {
    it('should load login page without token correctly', () => {
      mockTokenManager.getAccessToken.mockReturnValue(null);
      
      renderWithProviders(<Login />, ['/login']);
      
      expect(screen.getByText('Welcome to ESCA SHOP')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should redirect authenticated user away from login page', async () => {
      mockTokenManager.getAccessToken.mockReturnValue('valid-token');
      mockAuthService.verifyToken.mockResolvedValue(mockUser);
      
      await act(async () => {
        renderWithProviders(<Login />, ['/login']);
      });
      
      // Should attempt to redirect away from login page when user is authenticated
      // The redirect logic is in the useEffect, so we need to wait for it
      await waitFor(() => {
        // The component should detect user authentication and trigger redirect
        expect(mockAuthService.verifyToken).toHaveBeenCalled();
      });
    });

    it('should handle protected route access without token', () => {
      mockTokenManager.getAccessToken.mockReturnValue(null);
      
      renderWithProviders(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>,
        ['/dashboard']
      );
      
      // Should redirect to login
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should handle protected route access with valid token', async () => {
      mockTokenManager.getAccessToken.mockReturnValue('valid-token');
      mockAuthService.verifyToken.mockResolvedValue(mockUser);
      
      await act(async () => {
        renderWithProviders(
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>,
          ['/dashboard']
        );
      });
      
      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
    });

    it('should handle protected route access with expired token', async () => {
      mockTokenManager.getAccessToken.mockReturnValue('expired-token');
      mockAuthService.verifyToken.mockRejectedValue(new Error('Token expired'));
      
      await act(async () => {
        renderWithProviders(
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>,
          ['/dashboard']
        );
      });
      
      await waitFor(() => {
        expect(mockTokenManager.clearTokens).toHaveBeenCalled();
      });
      
      // Should redirect to login after token verification fails
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });

  describe('Race Condition Scenarios', () => {
    it('should handle rapid login attempts after session expiry', async () => {
      // Simulate session expiry state
      mockTokenManager.getAccessToken.mockReturnValue(null);
      
      renderWithProviders(<Login />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password' } });
      
      // Simulate rapid successive clicks
      let resolveFirst: (value: any) => void;
      const firstLoginPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });
      
      mockAuthService.login
        .mockReturnValueOnce(firstLoginPromise)
        .mockResolvedValueOnce(mockAuthResponse);
      
      // First click
      fireEvent.click(submitButton);
      
      // Wait for loading state
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
      
      // Second rapid click should be ignored
      fireEvent.click(submitButton);
      
      // Should only call login once despite multiple clicks
      expect(mockAuthService.login).toHaveBeenCalledTimes(1);
      
      // Complete first login
      resolveFirst!(mockAuthResponse);
      
      await waitFor(() => {
        expect(mockTokenManager.completeLogin).toHaveBeenCalled();
      });
    });

    it('should handle login success while token refresh is in progress', async () => {
      // Start with a token that's about to expire
      mockTokenManager.getAccessToken.mockReturnValue('expiring-token');
      mockTokenManager.isTokenExpiringSoon.mockReturnValue(true);
      
      let refreshResolve: (value: string) => void;
      const refreshPromise = new Promise<string>((resolve) => {
        refreshResolve = resolve;
      });
      
      mockAuthService.refreshToken.mockReturnValue(refreshPromise);
      mockAuthService.login.mockResolvedValue(mockAuthResponse);
      
      renderWithProviders(<Login />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password' } });
      
      // Trigger login while refresh might be in progress
      await act(async () => {
        fireEvent.click(submitButton);
      });
      
      await waitFor(() => {
        expect(mockAuthService.login).toHaveBeenCalled();
      });
      
      // Complete the refresh after login
      refreshResolve!('new-refreshed-token');
      
      // Login should succeed regardless of refresh state
      expect(mockTokenManager.startLogin).toHaveBeenCalled();
      expect(mockTokenManager.completeLogin).toHaveBeenCalled();
    });
  });

  describe('Automatic Token Expiration', () => {
    it('should handle automatic token expiration during user session', async () => {
      // Start with valid token
      mockTokenManager.getAccessToken.mockReturnValue('valid-token');
      mockAuthService.verifyToken.mockResolvedValue(mockUser);
      
      await act(async () => {
        renderWithProviders(
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        );
      });
      
      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
      
      // Simulate token expiration
      mockTokenManager.getAccessToken.mockReturnValue(null);
      mockAuthService.refreshToken.mockRejectedValue(new Error('Refresh failed'));
      
      // Trigger a route change or component re-render that would check auth
      await act(async () => {
        renderWithProviders(
          <ProtectedRoute>
            <div>Still Protected Content</div>
          </ProtectedRoute>
        );
      });
      
      // Should redirect to login after expiration
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });

    it('should handle token refresh success', async () => {
      mockTokenManager.getAccessToken.mockReturnValue('expiring-token');
      mockTokenManager.isTokenExpiringSoon.mockReturnValue(true);
      mockAuthService.refreshToken.mockResolvedValue('new-fresh-token');
      
      await act(async () => {
        renderWithProviders(<Login />);
      });
      
      // Refresh should be called for expiring token
      await waitFor(() => {
        expect(mockAuthService.refreshToken).toHaveBeenCalled();
      });
    });

    it('should handle token refresh failure and logout', async () => {
      mockTokenManager.getAccessToken.mockReturnValue('invalid-token');
      mockAuthService.verifyToken.mockRejectedValue(new Error('Invalid token'));
      mockAuthService.refreshToken.mockRejectedValue(new Error('Refresh failed'));
      
      await act(async () => {
        renderWithProviders(
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        );
      });
      
      await waitFor(() => {
        expect(mockTokenManager.clearTokens).toHaveBeenCalled();
      });
      
      // Should redirect to login after failed refresh
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });

  describe('State Consistency and Clean Redirects', () => {
    it('should maintain clean state after logout', async () => {
      mockTokenManager.getAccessToken.mockReturnValue('valid-token');
      mockAuthService.verifyToken.mockResolvedValue(mockUser);
      mockAuthService.logout.mockResolvedValue(undefined);
      
      await act(async () => {
        renderWithProviders(<Login />);
      });
      
      // Simulate logout
      await act(async () => {
        mockAuthService.logout();
      });
      
      expect(mockTokenManager.clearTokens).toHaveBeenCalled();
      
      // State should be clean for next login attempt
      renderWithProviders(<Login />);
      
      expect(screen.getByText('Welcome to ESCA SHOP')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
    });

    it('should prevent infinite redirect loops', async () => {
      // Set up a scenario that might cause loops
      mockTokenManager.getAccessToken.mockReturnValue('some-token');
      mockAuthService.verifyToken.mockRejectedValue(new Error('Verification failed'));
      
      // Clear navigate calls
      mockNavigate.mockClear();
      
      await act(async () => {
        renderWithProviders(<Login />, ['/login']);
      });
      
      await waitFor(() => {
        expect(mockAuthService.verifyToken).toHaveBeenCalled();
      });
      
      // Should not create infinite redirects
      // If there were infinite redirects, mockNavigate would be called many times
      expect(mockNavigate).toHaveBeenCalledTimes(0); // Should not redirect from login page on verification failure
    });

    it('should handle session expiration with clean state transition', async () => {
      // Start with authenticated state
      mockTokenManager.getAccessToken.mockReturnValue('valid-token');
      mockAuthService.verifyToken.mockResolvedValue(mockUser);
      
      await act(async () => {
        renderWithProviders(
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        );
      });
      
      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });
      
      // Simulate session expiration event
      act(() => {
        window.dispatchEvent(new CustomEvent('session-expired'));
      });
      
      // Should handle the session expiration gracefully
      await waitFor(() => {
        expect(mockTokenManager.clearTokens).toHaveBeenCalled();
      });
    });

    it('should handle multiple authentication state changes gracefully', async () => {
      const { rerender } = renderWithProviders(<Login />);
      
      // Start with no token
      mockTokenManager.getAccessToken.mockReturnValue(null);
      
      rerender(
        <MemoryRouter>
          <ThemeProvider>
            <AuthProvider>
              <Login />
            </AuthProvider>
          </ThemeProvider>
        </MemoryRouter>
      );
      
      // Then add token
      mockTokenManager.getAccessToken.mockReturnValue('new-token');
      mockAuthService.verifyToken.mockResolvedValue(mockUser);
      
      await act(async () => {
        rerender(
          <MemoryRouter>
            <ThemeProvider>
              <AuthProvider>
                <Login />
              </AuthProvider>
            </ThemeProvider>
          </MemoryRouter>
        );
      });
      
      // Then remove token again
      mockTokenManager.getAccessToken.mockReturnValue(null);
      
      await act(async () => {
        rerender(
          <MemoryRouter>
            <ThemeProvider>
              <AuthProvider>
                <Login />
              </AuthProvider>
            </ThemeProvider>
          </MemoryRouter>
        );
      });
      
      // Component should handle all these state changes without errors
      expect(screen.getByText('Welcome to ESCA SHOP')).toBeInTheDocument();
    });
  });

  describe('Role-Based Access Control Edge Cases', () => {
    it('should handle role changes during session', async () => {
      // Start with admin user
      const adminUser = { ...mockUser, role: UserRole.ADMIN };
      mockTokenManager.getAccessToken.mockReturnValue('valid-token');
      mockAuthService.verifyToken.mockResolvedValue(adminUser);
      
      await act(async () => {
        renderWithProviders(
          <ProtectedRoute requiredRole={UserRole.ADMIN}>
            <div>Admin Content</div>
          </ProtectedRoute>
        );
      });
      
      await waitFor(() => {
        expect(screen.getByText('Admin Content')).toBeInTheDocument();
      });
      
      // Simulate role change (user gets demoted)
      const demotedUser = { ...mockUser, role: UserRole.CASHIER };
      mockAuthService.verifyToken.mockResolvedValue(demotedUser);
      
      await act(async () => {
        renderWithProviders(
          <ProtectedRoute requiredRole={UserRole.ADMIN}>
            <div>Still Admin Content</div>
          </ProtectedRoute>
        );
      });
      
      // Should redirect due to insufficient role
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });

    it('should handle missing role information gracefully', async () => {
      const userWithoutRole = { ...mockUser, role: undefined as any };
      mockTokenManager.getAccessToken.mockReturnValue('valid-token');
      mockAuthService.verifyToken.mockResolvedValue(userWithoutRole);
      
      await act(async () => {
        renderWithProviders(
          <ProtectedRoute requiredRole={UserRole.ADMIN}>
            <div>Admin Content</div>
          </ProtectedRoute>
        );
      });
      
      // Should handle missing role by redirecting
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });
});
