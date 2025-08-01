# Password Reset Network Error Troubleshooting Guide

## Issue Overview

Users experiencing "Network error. Please check your connection and try again." when clicking password reset links, along with JSON parsing errors in the browser console.

## Root Causes Identified

### 1. **Proxy Configuration Issue**
- **Problem**: Frontend proxy was set to `http://backend:5000` (Docker container name)
- **Environment**: Local development (not Docker)
- **Solution**: Changed proxy to `http://localhost:5000` in `frontend/package.json`

### 2. **Token Validation Endpoint Issues**
- **Problem**: Frontend making requests to `/api/auth/verify-reset-token` but getting network errors
- **Cause**: API proxy not properly forwarding requests to backend
- **Solution**: Fixed proxy configuration

### 3. **JSON Parsing Errors**
- **Problem**: Console shows "Token validation error: SyntaxError: JSON.parse: unexpected character at line 1 column 1 of the JSON data"
- **Cause**: Backend returning HTML error pages instead of JSON responses in some cases

## Solutions Applied

### 1. **Fixed Proxy Configuration**
```json
// frontend/package.json - BEFORE
"proxy": "http://backend:5000"

// frontend/package.json - AFTER  
"proxy": "http://localhost:5000"
```

### 2. **Enhanced Backend Validation**
- Added proper validation schemas import for auth routes
- Improved error handling for password reset endpoints
- Ensured JSON responses are returned consistently

### 3. **API Request Configuration**
- Verified API base URL configuration in `frontend/src/utils/api.ts`
- Ensured proper error handling for network issues
- Added timeout handling (10 seconds default)

## Testing Steps

### 1. **Verify Backend is Running**
```bash
# Check if backend is listening on port 5000
netstat -an | findstr :5000
```
Expected output:
```
TCP    0.0.0.0:5000           0.0.0.0:0              LISTENING
```

### 2. **Test API Endpoints Directly**
```bash
# Test password reset token verification
curl -X POST http://localhost:5000/api/auth/verify-reset-token \
  -H "Content-Type: application/json" \
  -d '{"token":"your_test_token_here"}'
```

### 3. **Check Frontend-Backend Communication**
1. Open browser developer tools (F12)
2. Go to Network tab
3. Navigate to password reset link
4. Check if requests to `/api/auth/verify-reset-token` are successful

## Environment-Specific Configuration

### Local Development
- Backend: `http://localhost:5000`
- Frontend proxy: `http://localhost:5000`
- API Base URL: `/api` (uses proxy)

### Docker Development
- Backend: `http://backend:5000` (service name)
- Frontend proxy: `http://backend:5000`
- API Base URL: `/api` (uses proxy)

### Production
- Backend: Your production API URL
- Frontend: Set `REACT_APP_API_URL` environment variable
- API Base URL: Uses `REACT_APP_API_URL` or falls back to production URL

## Common Issues and Solutions

### Issue: "Request timeout"
**Cause**: Backend not responding within 10 seconds
**Solution**: 
- Check if backend is running and accessible
- Verify database connection
- Check for slow queries in password reset logic

### Issue: "Invalid or expired reset token"
**Cause**: 
- Token has expired (1 hour default)
- Token doesn't exist in database
- Database connection issues

**Solution**:
- Generate new reset token
- Check database connectivity
- Verify token expiry settings

### Issue: CORS errors
**Cause**: Cross-origin requests blocked
**Solution**: 
- Ensure proxy is working correctly
- Add proper CORS headers in backend if needed
- Check if frontend and backend are on same origin in development

## Database Schema Verification

Ensure users table has required columns:
```sql
-- Check if reset token columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('reset_token', 'reset_token_expiry');
```

Expected columns:
- `reset_token` (VARCHAR/TEXT, nullable)
- `reset_token_expiry` (TIMESTAMP, nullable)

## Frontend Error Handling

The `ResetPassword.tsx` component includes comprehensive error handling:

1. **Network errors**: Shows user-friendly message
2. **Token validation**: Validates token before showing form
3. **Form validation**: Client-side password validation
4. **Success handling**: Shows success message and redirects

## Backend Token Generation

Password reset tokens are generated using:
- `crypto.randomBytes(32).toString('hex')` - 64 character hex string
- 1 hour expiry (configurable)
- Stored in database with expiry timestamp

## Restart Instructions

After making configuration changes:

1. **Stop both frontend and backend**
2. **Start backend first**:
   ```bash
   cd backend
   npm start
   ```
3. **Start frontend**:
   ```bash
   cd frontend  
   npm start
   ```
4. **Clear browser cache** and test password reset flow

## Monitoring and Logs

### Backend Logs to Watch
- Database connection errors
- Token generation/validation logs
- Email service logs (if enabled)

### Frontend Console Logs
- API request/response logs
- Network errors
- JSON parsing errors

### Browser Network Tab
- Check response status codes
- Verify response content-type is `application/json`
- Look for CORS or proxy issues

## Security Considerations

1. **Token Generation**: Uses cryptographically secure random bytes
2. **Token Storage**: Hashed in database (optional enhancement)
3. **Token Expiry**: 1 hour default (configurable)
4. **Rate Limiting**: Consider adding to prevent abuse
5. **Email Security**: Tokens sent via secure email links only

## Additional Enhancements

### Recommended Improvements
1. **Add rate limiting** to password reset requests
2. **Hash reset tokens** in database for additional security
3. **Add password reset attempt logging**
4. **Implement account lockout** after multiple failed attempts
5. **Add email verification** before allowing password reset

### Monitoring Recommendations
1. **Track reset token generation/usage**
2. **Monitor failed reset attempts**
3. **Alert on unusual password reset patterns**
4. **Log all password reset activities**

This guide should help resolve the network error issues and provide a framework for handling similar problems in the future.
