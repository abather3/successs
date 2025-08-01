# Password Reset Testing Steps

## Current Status
- Docker containers are running properly
- Backend API is responding (tested internally)
- A test reset token has been created: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2`

## Testing Steps

### 1. Test the Password Reset URL
Try accessing this URL in your browser:
```
http://localhost:3000/reset-password/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

### 2. Check Browser Network Tab
1. Open Developer Tools (F12)
2. Go to Network tab
3. Clear existing entries
4. Navigate to the password reset URL
5. Look for the request to `/api/auth/verify-reset-token`
6. Check if it returns JSON or HTML

### 3. Expected Behavior
The API should return:
```json
{
  "valid": true,
  "email": "admin@escashop.com",
  "name": "System Administrator"
}
```

### 4. If Still Getting Errors

#### Option A: Test Direct Backend Access
Try accessing the backend directly (bypassing proxy):
```
http://localhost:5000/api/auth/verify-reset-token
```

#### Option B: Check Container Network
```bash
# Test container-to-container communication
docker exec escashop_frontend_dev curl -X POST http://backend:5000/api/auth/verify-reset-token \
  -H "Content-Type: application/json" \
  -d '{"token":"a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"}'
```

#### Option C: Rebuild with Fresh Code
```bash
cd "E:\7-23\New folder\new update escashop\escashop1\escashop"
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml build --no-cache
docker-compose -f docker-compose.dev.yml up -d
```

## Troubleshooting Common Issues

### Issue: "Invalid Reset Link" immediately
**Cause**: Frontend not reaching backend API
**Solution**: Check proxy configuration and container networking

### Issue: JSON Parse Error
**Cause**: Backend returning HTML instead of JSON
**Solution**: Check backend error handling and ensure proper JSON responses

### Issue: Network Error
**Cause**: Backend container not accessible
**Solution**: Restart containers and check health status

## Container Health Check
```bash
# Check all containers are healthy
docker ps --filter name=escashop

# Check backend logs
docker logs escashop_backend_dev --tail 20

# Check frontend logs  
docker logs escashop_frontend_dev --tail 20
```

## Quick Fix Commands

### Restart All Containers
```bash
cd "E:\7-23\New folder\new update escashop\escashop1\escashop"
docker-compose -f docker-compose.dev.yml restart
```

### Create New Test Token
```bash
docker exec escashop_postgres_dev psql -U postgres -d escashop -c "UPDATE users SET reset_token = 'test123test456test789test012test345test678test901test234test567test890', reset_token_expiry = NOW() + INTERVAL '1 hour' WHERE email = 'admin@escashop.com';"
```

Then test with: `http://localhost:3000/reset-password/test123test456test789test012test345test678test901test234test567test890`

## Success Indicators
1. ✅ No "Invalid Reset Link" error
2. ✅ Password reset form is displayed
3. ✅ User's email is shown on the form
4. ✅ No JSON parse errors in console
5. ✅ Network tab shows successful API responses

## Next Steps if Working
1. Test password reset submission
2. Verify new password works for login
3. Test token expiry (should become invalid after 1 hour)
4. Test invalid/malformed tokens show proper error messages
