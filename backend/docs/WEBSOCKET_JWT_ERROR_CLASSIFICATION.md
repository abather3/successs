# WebSocket JWT Error Classification

This document describes the refactored WebSocket authentication middleware that provides classified JWT error handling for improved client-side error management.

## Overview

The WebSocket authentication middleware has been enhanced to:
1. Classify JWT verification errors into specific error codes
2. Provide structured error responses that clients can parse
3. Use appropriate logging levels for expected authentication failures
4. Maintain consistency with HTTP middleware error handling

## Error Classification

### Error Codes

The middleware now maps JWT errors to the following custom error codes:

| Error Code | Description | JWT Error Type |
|------------|-------------|----------------|
| `TOKEN_MISSING` | No authentication token provided | N/A |
| `TOKEN_EXPIRED` | Token has expired | `jwt.TokenExpiredError` |
| `TOKEN_INVALID` | Invalid token format, signature, or claims | `jwt.JsonWebTokenError`, `jwt.NotBeforeError` |

### Error Response Format

All authentication errors are now returned as JSON-stringified objects with the following structure:

```json
{
  "code": "TOKEN_EXPIRED",
  "message": "jwt expired"
}
```

This allows clients to parse the error and handle different scenarios appropriately.

## Implementation Details

### WebSocket Middleware (`src/services/websocket.ts`)

The WebSocket authentication middleware now:

1. **Missing Token Handling**:
   ```typescript
   if (!token) {
     const errorResponse = JSON.stringify({code: 'TOKEN_MISSING', message: 'Authentication token required'});
     console.warn('Authentication token required');
     return next(new Error(errorResponse));
   }
   ```

2. **JWT Error Classification**:
   ```typescript
   try {
     const decoded = jwt.verify(token, config.JWT_SECRET) as any;
     // ... validation logic
   } catch (error) {
     let code = 'TOKEN_INVALID';
     if (error instanceof jwt.TokenExpiredError) {
       code = 'TOKEN_EXPIRED';
     } else if (error instanceof jwt.NotBeforeError) {
       code = 'TOKEN_INVALID';
     } else if (error instanceof jwt.JsonWebTokenError) {
       code = 'TOKEN_INVALID';
     }
     const errorResponse = JSON.stringify({ code, message: error.message });
     console.warn(`JWT verification failed: ${error.message}`);
     return next(new Error(errorResponse));
   }
   ```

### JWT Service (`src/services/jwtService.ts`)

The JWT service's `verifyToken` method has been updated to return classified errors:

```typescript
try {
  const payload = jwt.verify(token, key.publicKey, {
    algorithms: [key.algorithm as jwt.Algorithm]
  }) as JwtPayload;
  // ... token validation
  return payload;
} catch (error) {
  // Map JWT errors to custom error codes
  if (error instanceof jwt.TokenExpiredError) {
    throw new Error(JSON.stringify({ code: 'TOKEN_EXPIRED', message: error.message }));
  } else if (error instanceof jwt.NotBeforeError) {
    throw new Error(JSON.stringify({ code: 'TOKEN_INVALID', message: error.message }));
  } else if (error instanceof jwt.JsonWebTokenError) {
    throw new Error(JSON.stringify({ code: 'TOKEN_INVALID', message: error.message }));
  }
  throw new Error(`Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
```

### Auth Middleware (`src/middleware/auth.ts`)

The HTTP authentication middleware has been updated for consistency:

```typescript
try {
  const decoded = jwt.verify(token, config.JWT_SECRET) as any;
  // ... validation logic
} catch (jwtError) {
  let code = 'TOKEN_INVALID';
  let message = 'Invalid token';
  
  if (jwtError instanceof jwt.TokenExpiredError) {
    code = 'TOKEN_EXPIRED';
    message = 'Token has expired';
  } else if (jwtError instanceof jwt.NotBeforeError) {
    code = 'TOKEN_INVALID';
    message = 'Token not active yet';
  } else if (jwtError instanceof jwt.JsonWebTokenError) {
    code = 'TOKEN_INVALID';
    message = 'Invalid token format';
  }
  
  console.warn(`JWT verification failed: ${jwtError.message}`);
  res.status(403).json({ error: message, code });
}
```

## Logging Changes

### Before
```typescript
console.error('WebSocket authentication error:', error);
```

### After
```typescript
console.warn(`JWT verification failed: ${error.message}`);
console.warn('Authentication token required');
console.warn('Invalid or inactive user');
```

**Rationale**: Authentication failures are expected events in a production system and should be logged as warnings rather than errors. This reduces noise in error logs and allows for better monitoring and alerting.

## Client-Side Usage

Clients can now parse WebSocket connection errors to handle different scenarios:

```javascript
socket.on('connect_error', (error) => {
  try {
    const parsedError = JSON.parse(error.message);
    
    switch (parsedError.code) {
      case 'TOKEN_MISSING':
        // Redirect to login
        break;
      case 'TOKEN_EXPIRED':
        // Attempt token refresh
        break;
      case 'TOKEN_INVALID':
        // Clear stored token and redirect to login
        break;
      default:
        // Handle generic authentication error
        break;
    }
  } catch (e) {
    // Handle non-JSON error messages
    console.error('Authentication error:', error.message);
  }
});
```

## Testing

A comprehensive test suite has been created at `src/__tests__/websocket-auth-errors.test.ts` that verifies:

1. **Error Classification**: Each JWT error type is properly mapped to the correct error code
2. **Error Response Format**: Errors are returned as properly formatted JSON objects
3. **Logging Behavior**: Authentication failures are logged with `console.warn`
4. **Client Parsing**: Error messages can be parsed as JSON by clients

## Benefits

1. **Better Client Experience**: Clients can distinguish between different types of authentication failures
2. **Improved Error Handling**: Structured error responses enable better error recovery strategies
3. **Reduced Log Noise**: Using `console.warn` for expected failures reduces error log volume
4. **Consistency**: WebSocket and HTTP authentication now use the same error classification system
5. **Debugging**: Specific error codes make it easier to identify and resolve authentication issues

## Migration Notes

Existing clients that rely on generic error messages will continue to work, but they should be updated to take advantage of the new structured error format for better user experience and error handling.
