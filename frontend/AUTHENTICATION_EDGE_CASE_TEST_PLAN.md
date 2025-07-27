# Authentication Edge Case Test Plan

## Overview
This document provides a systematic approach to test and validate all edge cases for the authentication system as specified in Step 6.

## Test Categories

### 1. Valid and Invalid Credentials Testing

#### 1.1 Valid Credentials Test
**Objective**: Verify successful login with valid credentials
**Steps**:
1. Navigate to `/login`
2. Enter valid email: `admin@example.com`
3. Enter valid password: `admin123`
4. Click "Sign In"
5. **Expected Results**:
   - Loading spinner appears
   - No error messages
   - Redirect to `/` (dashboard)
   - User session established
   - Debug logs show successful flow

**Validation Points**:
- `[LOGIN] 🔐 Login form submitted`
- `[AUTH_CONTEXT] ✅ authService.login successful`
- `[LOGIN] 🚨 REDIRECT TRIGGERED: User exists, navigating to /`
- `[PROTECTED_ROUTE] ✅ Access granted`

#### 1.2 Invalid Credentials Test
**Objective**: Verify error handling with invalid credentials
**Steps**:
1. Navigate to `/login`
2. Enter invalid email: `wrong@example.com`
3. Enter invalid password: `wrongpassword`
4. Click "Sign In"
5. **Expected Results**:
   - Error message displayed
   - Password field cleared
   - No redirect occurs
   - User remains on login page

**Validation Points**:
- Error message appears with dismiss button
- `[AUTH_CONTEXT] ❌ Login failed, dispatching LOGIN_ERROR`
- Password input value is empty after error
- No navigation calls in debug logs

#### 1.3 Network Error Test
**Objective**: Test handling of network failures
**Steps**:
1. Disconnect network or use invalid API endpoint
2. Attempt login with any credentials
3. **Expected Results**:
   - Network error message displayed
   - Error can be dismissed
   - Clean state maintained

### 2. Initial Page Load Scenarios

#### 2.1 Login Page Load Without Token
**Objective**: Verify login page loads correctly when user is not authenticated
**Steps**:
1. Clear browser localStorage
2. Navigate directly to `/login`
3. **Expected Results**:
   - Login form displays
   - No redirect occurs
   - No error messages
   - Form is interactive

**Validation Points**:
- `[AUTH_CONTEXT] 📋 Initial AuthContext state created` with hasAccessToken: false
- `[LOGIN] Login component mounted/re-rendered` with user: null

#### 2.2 Login Page Load With Valid Token
**Objective**: Verify redirect when authenticated user visits login page
**Steps**:
1. Login successfully first
2. Navigate back to `/login`
3. **Expected Results**:
   - Immediate redirect to `/`
   - No login form display
   - User session maintained

**Validation Points**:
- `[AUTH_CONTEXT] ✅ Token verification successful`
- Redirect to dashboard occurs automatically

#### 2.3 Protected Route Without Token
**Objective**: Verify protection of routes requiring authentication
**Steps**:
1. Clear browser localStorage
2. Navigate directly to `/dashboard` or any protected route
3. **Expected Results**:
   - Immediate redirect to `/login`
   - No protected content displayed
   - Clean redirect behavior

**Validation Points**:
- `[PROTECTED_ROUTE] 🚨 NO USER - Redirecting to /login`
- Navigation to `/login` occurs

#### 2.4 Protected Route With Valid Token
**Objective**: Verify access to protected routes with valid authentication
**Steps**:
1. Login successfully
2. Navigate to protected routes
3. **Expected Results**:
   - Protected content displays
   - No redirects occur
   - User session maintained

**Validation Points**:
- `[PROTECTED_ROUTE] ✅ Access granted - rendering protected content`
- Content renders without issues

#### 2.5 Protected Route With Expired Token
**Objective**: Test handling of expired tokens on protected routes
**Steps**:
1. Login successfully
2. Wait for token expiration OR manually expire token in localStorage
3. Attempt to access protected route
4. **Expected Results**:
   - Token verification fails
   - Redirect to `/login`
   - Clean state reset
   - User can login again

**Validation Points**:
- `[AUTH_CONTEXT] ❌ Token verification failed`
- `[PROTECTED_ROUTE] 🚨 NO USER - Redirecting to /login`
- localStorage tokens cleared

### 3. Race Condition Testing

#### 3.1 Rapid Login Attempts
**Objective**: Test handling of rapid successive login attempts
**Steps**:
1. Navigate to `/login`
2. Enter credentials
3. Rapidly click "Sign In" button multiple times
4. **Expected Results**:
   - Only one login request sent
   - Button disabled during processing
   - No duplicate requests
   - Clean completion

**Validation Points**:
- Single `[AUTH_CONTEXT] 🔑 Login function called` log
- Button shows loading state
- No race conditions in auth flow

#### 3.2 Quick Login After Session Expiry
**Objective**: Test login immediately after session expires
**Steps**:
1. Login successfully
2. Let session expire naturally OR trigger expiration
3. Immediately attempt new login
4. **Expected Results**:
   - Clean session reset
   - New login succeeds
   - No state conflicts
   - Proper redirect

**Validation Points**:
- Session expiry handled cleanly
- New login flow starts fresh
- No conflicting auth states

#### 3.3 Login During Token Refresh
**Objective**: Test login attempt while token refresh is in progress
**Steps**:
1. Login with token near expiration
2. Trigger login attempt during automatic refresh
3. **Expected Results**:
   - Login coordinates with refresh
   - No conflicts occur
   - Login takes precedence
   - Clean state maintained

**Validation Points**:
- `[AUTH_CONTEXT] 🔑 Login function called` during refresh
- TokenManager coordination works correctly
- No duplicate auth calls

### 4. Automatic Token Expiration

#### 4.1 Token Expiration During Active Session
**Objective**: Test handling of token expiration during user activity
**Steps**:
1. Login successfully
2. Use the application normally
3. Wait for or force token expiration
4. Continue using application
5. **Expected Results**:
   - Session expiration warning appears
   - Option to extend session provided
   - Graceful handling of expiration
   - Clean logout if not extended

**Validation Points**:
- Session warning dialog appears
- User can choose to extend or logout
- Clean state transitions

#### 4.2 Automatic Token Refresh Success
**Objective**: Test successful automatic token refresh
**Steps**:
1. Login successfully
2. Monitor for automatic refresh before expiration
3. **Expected Results**:
   - Token refreshes automatically
   - User session continues uninterrupted
   - New tokens stored
   - No user interaction required

**Validation Points**:
- Automatic refresh occurs before expiration
- New tokens received and stored
- Session continues seamlessly

#### 4.3 Automatic Token Refresh Failure
**Objective**: Test handling of failed token refresh
**Steps**:
1. Login successfully
2. Simulate refresh token expiration or server error
3. Wait for automatic refresh attempt
4. **Expected Results**:
   - Refresh fails gracefully
   - User logged out automatically
   - Redirect to login page
   - Clean state reset

**Validation Points**:
- Failed refresh handled gracefully
- Automatic logout occurs
- State cleaned properly

### 5. State Consistency and Loop Prevention

#### 5.1 Prevent Infinite Redirects
**Objective**: Verify no infinite redirect loops occur
**Steps**:
1. Create scenarios that might cause loops:
   - Invalid token on protected route
   - Expired session during navigation
   - Multiple rapid navigations
2. **Expected Results**:
   - Maximum one redirect per scenario
   - Clean navigation flow
   - No browser freezing
   - Proper error handling

**Validation Points**:
- Debug logs show controlled navigation
- No excessive redirect attempts
- Clean state between navigations

#### 5.2 Clean State After Logout
**Objective**: Verify complete state cleanup after logout
**Steps**:
1. Login successfully
2. Use application features
3. Logout
4. Attempt to access protected routes
5. Login again
6. **Expected Results**:
   - All previous state cleared
   - Fresh authentication state
   - No residual data
   - Clean login process

**Validation Points**:
- localStorage cleared completely
- AuthContext state reset
- No previous session data remains
- Fresh login succeeds

#### 5.3 Consistent State Across Components
**Objective**: Verify auth state consistency across all components
**Steps**:
1. Login successfully
2. Navigate between different protected routes
3. Check that all components see same auth state
4. **Expected Results**:
   - Consistent user data across components
   - No state mismatches
   - Synchronized auth status
   - Proper role-based access

**Validation Points**:
- User object consistent across components
- Role checks work correctly
- No auth state conflicts

## Execution Instructions

### Prerequisites
1. Start the backend server
2. Open browser developer console
3. Clear all browser data before testing
4. Have admin credentials ready

### Test Execution Process
1. Execute tests in order listed
2. Document results for each test
3. Note any debug log anomalies
4. Record timing of state changes
5. Verify expected outcomes

### Success Criteria
- All tests pass expected results
- No infinite loops detected
- Clean state transitions
- Proper error handling
- Consistent user experience
- Debug logs show expected flow

### Failure Investigation
If any test fails:
1. Review debug console logs
2. Check network requests
3. Verify localStorage state
4. Document exact failure point
5. Test related scenarios

## Debug Log Analysis

### Key Log Patterns to Watch

#### Successful Login Flow
```
[LOGIN] Login component mounted/re-rendered - user: null
[LOGIN] 🔐 Login form submitted
[AUTH_CONTEXT] 🔑 Login function called
[AUTH_CONTEXT] 📤 Dispatching LOGIN_START...
[AUTH_CONTEXT] 🌐 Calling authService.login...
[AUTH_CONTEXT] ✅ authService.login successful, dispatching LOGIN_SUCCESS
[AUTH_CONTEXT] 🔄 Auth reducer called with action: LOGIN_SUCCESS
[LOGIN] 🚨 REDIRECT TRIGGERED: User exists, navigating to /
[PROTECTED_ROUTE] ✅ Access granted - rendering protected content
```

#### Failed Login Flow
```
[LOGIN] 🔐 Login form submitted
[AUTH_CONTEXT] 🔑 Login function called
[AUTH_CONTEXT] 📤 Dispatching LOGIN_START...
[AUTH_CONTEXT] ❌ Login failed, dispatching LOGIN_ERROR
[LOGIN] 🚫 REDIRECT BLOCKED: error occurred
```

#### Token Expiration Flow
```
[AUTH_CONTEXT] ❌ Token verification failed
[AUTH_CONTEXT] 🚪 LOGOUT: Clearing user and tokens
[PROTECTED_ROUTE] 🚨 NO USER - Redirecting to /login
```

## Final Validation Checklist

- [ ] Valid credentials login works
- [ ] Invalid credentials handled properly
- [ ] Login page loads correctly without token
- [ ] Authenticated users redirect from login
- [ ] Protected routes block unauthenticated access
- [ ] Protected routes allow authenticated access
- [ ] Expired tokens trigger proper cleanup
- [ ] Rapid login attempts handled safely
- [ ] Session expiry works correctly
- [ ] Token refresh works automatically
- [ ] Failed refresh triggers logout
- [ ] No infinite redirect loops
- [ ] State consistency maintained
- [ ] Clean logout and re-login
- [ ] Role-based access works correctly
- [ ] Debug logs show expected patterns
- [ ] No JavaScript errors in console
- [ ] Network requests are appropriate
- [ ] localStorage managed correctly
- [ ] User experience is smooth

This comprehensive test plan ensures all edge cases are systematically validated and any issues are identified and resolved.
