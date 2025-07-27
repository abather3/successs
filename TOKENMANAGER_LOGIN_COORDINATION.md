# TokenManager Login Coordination Enhancement

## Overview

This document outlines the enhancements made to the `TokenManager` class to ensure proper coordination between login processes and automatic token refresh mechanisms.

## Problem Statement

The original TokenManager had potential race conditions and state conflicts during login:
- Automatic token refresh could occur during login, potentially overwriting fresh login tokens
- No mechanism to suppress refresh operations during critical authentication flows
- Login process could be interrupted by scheduled refresh timers

## Solution

### 1. Login State Management

Added login state tracking to coordinate operations:

```typescript
private static isLoginInProgress: boolean = false;
private static loginPromise: Promise<void> | null = null;

static startLogin(): void
static completeLogin(): void 
static isLoginInProgress(): boolean
static setLoginPromise(promise: Promise<void>): void
```

### 2. Automatic Refresh Suppression

During login, automatic refresh is suppressed:

- `setTokens()` only schedules refresh when not in login state
- Request interceptor skips proactive refresh during login
- Scheduled refresh timers are cancelled when login starts

### 3. Token Refresh Coordination  

The `refreshToken()` method now:

- Waits for any in-progress login to complete
- Throws an error if called during login process
- Prevents race conditions between login and refresh

### 4. State Cleanup

Enhanced `clearTokens()` to:
- Clear refresh promises
- Cancel scheduled timers
- Reset all token-related state

## Implementation Details

### Login Flow Changes

**AuthContext login function:**
```typescript
const login = async (email: string, password: string) => {
  const loginPromise = (async () => {
    try {
      dispatch({ type: 'LOGIN_START' });
      TokenManager.startLogin(); // Suppress automatic refresh
      
      const response = await authService.login(email, password);
      dispatch({ type: 'LOGIN_SUCCESS', payload: response });
      
    } finally {
      TokenManager.completeLogin(); // Resume normal token management
    }
  })();
  
  TokenManager.setLoginPromise(loginPromise);
  return loginPromise;
};
```

### Enhanced TokenManager Methods

**setTokens() with login awareness:**
```typescript
static setTokens(accessToken: string, refreshToken: string, expiresAt?: number): void {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
  
  if (expiresAt) {
    localStorage.setItem('tokenExpiresAt', expiresAt.toString());
  }

  // Only schedule refresh if not during login process
  if (!this.isLoginInProgress) {
    this.scheduleTokenRefresh();
  }
}
```

**refreshToken() with coordination:**
```typescript
static async refreshToken(): Promise<string> {
  // Wait for any in-progress login to complete first
  await this.waitForLoginCompletion();
  
  // Don't refresh during login process
  if (this.isLoginInProgress) {
    throw new Error('Cannot refresh token during login process');
  }
  
  // Proceed with refresh...
}
```

**Request interceptor update:**
```typescript
api.interceptors.request.use(async (config) => {
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
```

## Benefits

### 1. Race Condition Prevention
- Login tokens cannot be overwritten by automatic refresh
- Clear coordination between competing token operations

### 2. State Consistency
- Guaranteed clean login flow without interference
- Proper state management across async operations

### 3. Improved Reliability
- Reduced risk of authentication failures during login
- Better error handling and recovery

### 4. Maintainable Architecture
- Clear separation of concerns
- Well-defined state transitions
- Comprehensive test coverage

## Testing

Comprehensive test suite validates:
- Login state management
- Refresh suppression during login
- Token clearing and cleanup
- Scheduling behavior
- Coordination mechanisms

## Usage Examples

### Successful Login Flow
```typescript
// 1. User initiates login
TokenManager.startLogin();           // Suppress automatic refresh
TokenManager.setLoginPromise(...);   // Set coordination promise

// 2. Login API call succeeds
TokenManager.setTokens(accessToken, refreshToken, expiresAt); // No refresh scheduled

// 3. Login completes
TokenManager.completeLogin();        // Resume normal token management
```

### Refresh During Login Attempt
```typescript
// Login is in progress
TokenManager.startLogin();

// Some other operation tries to refresh token
try {
  await TokenManager.refreshToken(); // Throws error
} catch (error) {
  // "Cannot refresh token during login process"
}
```

### Automatic Refresh Coordination
```typescript
// Login promise exists
const loginPromise = login(email, password);
TokenManager.setLoginPromise(loginPromise);

// Later, automatic refresh waits for login
await TokenManager.refreshToken(); // Waits for loginPromise to resolve
```

## Migration Impact

- **Breaking Changes:** None - all changes are internal to TokenManager
- **Backward Compatibility:** Full compatibility maintained
- **Performance:** Minimal overhead from state tracking
- **Dependencies:** No additional dependencies required

## Future Enhancements

Potential improvements:
1. **Configurable Timeouts:** Allow customization of refresh timing
2. **Metrics Collection:** Track token refresh success/failure rates  
3. **Advanced Retry Logic:** Exponential backoff for refresh failures
4. **Multi-tab Coordination:** Synchronize token state across browser tabs
