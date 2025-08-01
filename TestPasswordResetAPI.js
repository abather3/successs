const http = require('http');

// Test the password reset request API
const testPasswordResetRequest = async () => {
  const postData = JSON.stringify({
    email: 'test@escashop.com'
  });

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/request-password-reset',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log(`Status: ${res.statusCode}`);
      console.log(`Headers:`, res.headers);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Response body:', data);
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
};

// Test token verification (with fake token)
const testTokenVerification = async (token = 'fake-token-for-testing') => {
  const postData = JSON.stringify({
    token: token
  });

  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/verify-reset-token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log(`\nToken verification - Status: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('Token verification response:', data);
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', (error) => {
      console.error('Token verification error:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
};

// Run tests
async function runTests() {
  console.log('🧪 Testing Password Reset API endpoints...\n');
  
  try {
    console.log('1. Testing password reset request...');
    const resetResponse = await testPasswordResetRequest();
    
    console.log('\n2. Testing token verification (with fake token)...');
    const tokenResponse = await testTokenVerification();
    
    console.log('\n✅ Tests completed successfully!');
    console.log('\nTest Summary:');
    console.log('- Password reset request:', resetResponse.message || resetResponse.error || 'OK');
    console.log('- Token verification:', tokenResponse.error || 'Expected error with fake token');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

runTests();
