# JSON Parse Error Solution

## Issue Description
The frontend applications (Queue Management, Display Monitor, Historical Analytics) are showing "JSON.parse: unexpected character at line 1 column 1" errors when trying to fetch queue data from the API.

## Root Cause Analysis

### Main Issues Identified:
1. **Production Mode Proxy Problem**: Frontend runs in production mode using `serve` static server, which doesn't support React's proxy configuration
2. **API Routing Mismatch**: API calls to `/api/*` endpoints return HTML instead of JSON
3. **Authentication Token Issues**: Missing or invalid authentication tokens cause non-JSON error responses
4. **Network Configuration**: Docker networking between frontend and backend not properly configured

## Solutions Implemented

### 1. API Configuration Fix
**File**: `frontend/src/utils/api.ts`

Updated API base URL configuration to handle both development and production modes:
```typescript
const getApiBaseUrl = () => {
  if (process.env.NODE_ENV === 'development') {
    return process.env.REACT_APP_API_URL || '/api';
  } else {
    const isDockerProduction = window.location.port === '80';
    return isDockerProduction ? '/api' : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');
  }
};
```

### 2. Development Mode Configuration
**File**: `docker-compose.dev.yml`

Switched to development mode with proper proxy support:
- Frontend runs with `npm run dev` (React development server)
- Proxy configuration: `"proxy": "http://backend:5000"`
- Memory optimizations applied to prevent ENOMEM errors

### 3. Authentication Flow
Ensure users are properly logged in before accessing protected endpoints:
- All queue API endpoints require authentication tokens
- Check localStorage for valid access tokens
- Implement proper error handling for authentication failures

## Recommended Access Method

### For Development:
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# Access application at:
http://localhost:3000
```

### For Production:
```bash
# Start production environment
docker-compose up -d

# Access application through nginx proxy at:
http://localhost
```

## Testing Steps

1. **Start Development Environment**:
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. **Verify Container Health**:
   ```bash
   docker ps
   # All containers should show "healthy" status
   ```

3. **Test API Connectivity**:
   ```bash
   # Test backend API directly
   docker exec escashop_backend_dev curl -s http://localhost:5000/api/queue/all-statuses
   # Should return: {"error":{"code":"TOKEN_MISSING","message":"Authentication token is required"}}
   ```

4. **Login and Test Frontend**:
   - Navigate to http://localhost:3000/login
   - Login with valid credentials
   - Access Queue Management, Display Monitor, and Historical Analytics
   - Verify no JSON parse errors appear in browser console

## Troubleshooting

### If JSON Parse Errors Persist:

1. **Check Authentication**:
   - Verify user is logged in
   - Check browser localStorage for `accessToken`
   - Clear localStorage and login again

2. **Network Issues**:
   ```bash
   # Restart containers
   docker-compose -f docker-compose.dev.yml down
   docker-compose -f docker-compose.dev.yml up -d
   ```

3. **API Response Debugging**:
   - Open browser Developer Tools
   - Check Network tab for API calls
   - Verify responses are JSON, not HTML

4. **Backend Logs**:
   ```bash
   docker logs escashop_backend_dev --tail 50
   ```

### Common Error Patterns:

- **HTML Response**: Frontend receiving HTML instead of JSON indicates proxy or routing issue
- **TOKEN_MISSING**: Expected response for unauthenticated requests - user needs to login
- **ECONNRESET**: Network connectivity issues between containers

## Environment Variables

### Development:
```env
NODE_ENV=development
REACT_APP_API_URL="" # Uses proxy configuration
```

### Production:
```env
NODE_ENV=production
REACT_APP_API_URL=http://localhost:5000/api # Direct backend connection
```

## Final Resolution Status

✅ **Root Cause Identified**: Production mode proxy configuration issue
✅ **Development Environment**: Configured with proper proxy support
✅ **API Configuration**: Updated to handle multiple deployment scenarios  
✅ **Authentication Flow**: Verified token-based authentication working
✅ **Memory Issues**: Resolved ENOMEM errors in Docker containers

The application should now work correctly in development mode without JSON parsing errors.
