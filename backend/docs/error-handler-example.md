# Unified HTTP Error Response Structure

This document demonstrates how the new unified error handling system works in the backend.

## Overview

The system converts thrown authentication errors into standardized JSON responses with the format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly error message"
  }
}
```

## Error Types

### Authentication Errors

| Error Code | HTTP Status | User Message |
|------------|-------------|--------------|
| `TOKEN_MISSING` | 401 | "Authentication token is required" |
| `TOKEN_EXPIRED` | 401 | "Your session has expired" |
| `TOKEN_INVALID` | 401 | "Invalid authentication token" |
| `TOKEN_MALFORMED` | 401 | "Invalid token format" |
| `USER_NOT_FOUND` | 401 | "Invalid user credentials" |
| `USER_INACTIVE` | 401 | "Your account is inactive" |
| `INSUFFICIENT_PERMISSIONS` | 403 | "You do not have permission to access this resource" |
| `INVALID_CREDENTIALS` | 401 | "Invalid email or password" |
| `REFRESH_TOKEN_MISSING` | 400 | "Refresh token is required" |
| `REFRESH_TOKEN_INVALID` | 401 | "Invalid refresh token" |
| `REFRESH_TOKEN_EXPIRED` | 401 | "Your refresh token has expired" |

## Example Usage

### In Controllers

```typescript
// Before (inconsistent error handling)
if (!user) {
  res.status(401).json({ error: 'Invalid credentials' });
  return;
}

// After (unified error handling)
if (!user) {
  throwAuthError(AuthErrors.INVALID_CREDENTIALS);
}
```

### In Middleware

```typescript
// Before (inconsistent error handling)
if (!token) {
  res.status(401).json({ error: 'Access token required', code: 'TOKEN_MISSING' });
  return;
}

// After (unified error handling)
if (!token) {
  throwAuthError(AuthErrors.TOKEN_MISSING);
}
```

## Example Error Responses

### Token Expired
```json
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Your session has expired"
  }
}
```

### Insufficient Permissions
```json
{
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "You do not have permission to access this resource"
  }
}
```

### Invalid Credentials
```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

## Implementation Details

### Files Modified/Created

1. **`src/middleware/errorHandler.ts`** - New unified error handling middleware
2. **`src/middleware/auth.ts`** - Updated to use new error handling
3. **`src/routes/auth.ts`** - Updated login and refresh routes to use new error handling
4. **`src/index.ts`** - Added global error handler middleware

### Key Components

- **`AuthError`** - Custom error class for authentication errors
- **`AuthErrors`** - Predefined error constants
- **`errorHandler`** - Global Express error handler middleware
- **`asyncErrorHandler`** - Wrapper for async route handlers
- **`throwAuthError`** - Helper function to throw authentication errors

### Benefits

1. **Consistency** - All auth errors follow the same format
2. **Maintainability** - Error messages are centralized
3. **Type Safety** - TypeScript interfaces ensure correct structure
4. **Flexibility** - Easy to add new error types
5. **User Experience** - Clear, user-friendly error messages
6. **Debugging** - Separate internal and user messages for logging

## Testing

The error handler is thoroughly tested with unit tests covering:
- Error class creation
- Error type constants
- JWT error handling
- Generic error handling
- Async error wrapper functionality

All tests pass successfully, ensuring the error handling system works as expected.
