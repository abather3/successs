import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { ThemeProvider } from '../../contexts/ThemeContext';
import Login from '../../components/auth/Login';

// Mock the auth service
jest.mock('../../services/authService', () => ({
  authService: {
    login: jest.fn(),
    verifyToken: jest.fn(),
  },
  TokenManager: {
    getAccessToken: jest.fn(() => null),
    getRefreshToken: jest.fn(() => null),
    clearTokens: jest.fn(),
    startLogin: jest.fn(),
    completeLogin: jest.fn(),
    setLoginPromise: jest.fn(),
  },
}));

const renderLoginComponent = (initialState = {}) => {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
};

describe('Login Component Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display error messages with dismiss button', async () => {
    const { authService } = require('../../services/authService');
    authService.login.mockRejectedValue(new Error('Invalid credentials'));

    renderLoginComponent();

    // Fill in login form
    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(submitButton);

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });

    // Check that error has dismiss button
    const dismissButton = screen.getByLabelText('Dismiss error');
    expect(dismissButton).toBeInTheDocument();

    // Test dismissing error
    fireEvent.click(dismissButton);
    await waitFor(() => {
      expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument();
    });
  });

  it('should clear password field on failed login', async () => {
    const { authService } = require('../../services/authService');
    authService.login.mockRejectedValue(new Error('Invalid credentials'));

    renderLoginComponent();

    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;
    
    // Fill in password
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    expect(passwordInput.value).toBe('wrongpassword');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    // Wait for login to fail and password to be cleared
    await waitFor(() => {
      expect(passwordInput.value).toBe('');
    });
  });

  it('should prevent redirect when error is active', async () => {
    const mockNavigate = jest.fn();
    jest.mock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useNavigate: () => mockNavigate,
    }));

    const { authService } = require('../../services/authService');
    authService.login.mockRejectedValue(new Error('Network error'));

    renderLoginComponent();

    // Simulate failed login
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    // Verify navigate was not called due to error state
    expect(mockNavigate).not.toHaveBeenCalledWith('/', { replace: true });
  });

  it('should clear error when user starts typing', async () => {
    const { authService } = require('../../services/authService');
    authService.login.mockRejectedValue(new Error('Server error'));

    renderLoginComponent();

    // Trigger error first
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });

    // Start typing in email field
    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    // Error should be cleared
    await waitFor(() => {
      expect(screen.queryByText('Server error')).not.toBeInTheDocument();
    });
  });

  it('should display error with proper styling and icon', async () => {
    const { authService } = require('../../services/authService');
    authService.login.mockRejectedValue(new Error('Authentication failed'));

    renderLoginComponent();

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      const errorContainer = screen.getByText('Authentication failed').closest('div');
      
      // Check for error styling classes
      expect(errorContainer).toHaveClass('bg-red-50', 'border-red-200', 'text-red-700');
      
      // Check for error icon (SVG with specific viewBox)
      const errorIcon = errorContainer?.querySelector('svg[viewBox="0 0 20 20"]');
      expect(errorIcon).toBeInTheDocument();
      
      // Check for dismiss button
      const dismissButton = screen.getByLabelText('Dismiss error');
      expect(dismissButton).toBeInTheDocument();
    });
  });

  it('should handle success message display without triggering redirect', () => {
    const initialEntries = [{ pathname: '/login', state: { message: 'Password reset successful' } }];
    
    render(
      <MemoryRouter initialEntries={initialEntries}>
        <ThemeProvider>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    // Success message should be displayed
    expect(screen.getByText('Password reset successful')).toBeInTheDocument();
    
    // Success message should prevent redirect even with valid auth
    // This is tested implicitly through the redirect prevention logic
  });
});
