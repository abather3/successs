# Password Reset Quick Fix Guide

## Current Issue
The backend is receiving malformed JSON from the frontend, causing parsing errors.

## Immediate Test
Try this URL in your browser:
```
http://localhost:3000/reset-password/test123test456test789test012test345test678test901test234test567test890
```

## If Still Not Working

### Option 1: Bypass JSON Parsing Issue
Add this temporary debugging to the backend to see what's actually being received:

1. **Add console logging to auth routes** (temporary):
```javascript
// In backend/src/routes/auth.ts - line 276 (verify-reset-token)
router.post('/verify-reset-token', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Raw body:', req.body);
    console.log('Body type:', typeof req.body);
    console.log('Body string:', JSON.stringify(req.body));
    
    const { token } = req.body;
    // ... rest of the code
```

### Option 2: Alternative Request Method
Try using a different approach in ResetPassword.tsx:

```javascript
const validateToken = async () => {
  try {
    const response = await fetch('/api/auth/verify-reset-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: token }),
    });

    if (response.ok) {
      const data = await response.json();
      setTokenValidation(data);
    } else {
      const errorData = await response.json();
      setError(errorData.error || 'Invalid or expired reset token');
    }
  } catch (err) {
    console.error('Token validation error:', err);
    setError('Network error. Please check your connection and try again.');
  } finally {
    setIsValidating(false);
  }
};
```

### Option 3: Backend Route Fix
Replace the verify-reset-token route with this more robust version:

```javascript
router.post('/verify-reset-token', async (req: Request, res: Response): Promise<void> => {
  try {
    let token;
    
    // Handle different body formats
    if (typeof req.body === 'string') {
      try {
        const parsed = JSON.parse(req.body);
        token = parsed.token;
      } catch {
        token = req.body;
      }
    } else if (req.body && req.body.token) {
      token = req.body.token;
    } else {
      res.status(400).json({ error: 'Token is required' });
      return;
    }

    if (!token) {
      res.status(400).json({ error: 'Token is required' });
      return;
    }

    const query = `
      SELECT id, full_name, email, reset_token_expiry
      FROM users 
      WHERE reset_token = $1 AND reset_token_expiry > CURRENT_TIMESTAMP
    `;
    
    const result = await pool.query(query, [token]);
    
    if (result.rows.length === 0) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    const user = result.rows[0];
    res.json({ 
      valid: true, 
      email: user.email,
      name: user.full_name
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

## Test Commands

### Test Container Health
```bash
docker ps --filter name=escashop
docker logs escashop_backend_dev --tail 10
docker logs escashop_frontend_dev --tail 10
```

### Test Direct API Call
```bash
# From outside container
curl -X POST http://localhost:5000/api/auth/verify-reset-token \
  -H "Content-Type: application/json" \
  -d '{"token":"test123test456test789test012test345test678test901test234test567test890"}'

# From inside frontend container  
docker exec escashop_frontend_dev curl -X POST http://localhost:3000/api/auth/verify-reset-token \
  -H "Content-Type: application/json" \
  -d '{"token":"test123test456test789test012test345test678test901test234test567test890"}'
```

### Verify Database Token
```bash
docker exec escashop_postgres_dev psql -U postgres -d escashop -c \
  "SELECT email, reset_token, reset_token_expiry FROM users WHERE reset_token = 'test123test456test789test012test345test678test901test234test567test890';"
```

## Expected Working Behavior
1. ✅ URL loads without "Invalid Reset Link" 
2. ✅ Shows password reset form
3. ✅ Displays user email: admin@escashop.com
4. ✅ No console errors

## If Nothing Works
As a last resort, you can test password reset by directly updating the password in the database:

```bash
# Generate password hash (example with bcrypt)
docker exec escashop_backend_dev node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('NewPassword123!', 10, (err, hash) => {
  if (err) console.error(err);
  else console.log(hash);
});
"

# Then update user password directly
docker exec escashop_postgres_dev psql -U postgres -d escashop -c \
  "UPDATE users SET password_hash = 'HASH_FROM_ABOVE', reset_token = NULL, reset_token_expiry = NULL WHERE email = 'admin@escashop.com';"
```

Try the browser test first and let me know what happens!
