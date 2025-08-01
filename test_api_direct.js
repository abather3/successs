// Direct API test for settlement endpoint
const https = require('https');
const http = require('http');

async function testApiDirect() {
  console.log('🌐 Testing Settlement API Endpoint Directly...\n');
  
  // Test the settlement endpoint for JP's transaction (ID: 12)
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/transactions/12/settlements',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // For now, test without authentication to see if that's the issue
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log(`📡 Response Status: ${res.statusCode}`);
      console.log(`📋 Response Headers:`, res.headers);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`📄 Response Body:`, data);
        
        if (res.statusCode === 200) {
          try {
            const settlements = JSON.parse(data);
            console.log(`✅ API working correctly - returned ${settlements.length} settlements`);
          } catch (parseError) {
            console.log('❌ Response is not valid JSON:', parseError.message);
          }
        } else if (res.statusCode === 401) {
          console.log('🔐 Authentication required - this is expected without auth token');
        } else {
          console.log(`❌ Unexpected status code: ${res.statusCode}`);
        }
        
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.error('❌ Request failed:', err.message);
      resolve();
    });
    
    req.end();
  });
}

async function testWithAuth() {
  console.log('\n🔐 Testing with authentication...\n');
  
  // First, try to get an auth token by logging in
  const loginData = JSON.stringify({
    email: 'admin@escashop.com',
    password: 'admin123'
  });
  
  const loginOptions = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginData)
    }
  };
  
  return new Promise((resolve, reject) => {
    const loginReq = http.request(loginOptions, (res) => {
      console.log(`🔑 Login Response Status: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', async () => {
        if (res.statusCode === 200) {
          try {
            const loginResponse = JSON.parse(data);
            const token = loginResponse.accessToken;
            
            console.log('✅ Login successful, got auth token');
            
            // Now test the settlements endpoint with auth
            await testSettlementsWithAuth(token);
            
          } catch (parseError) {
            console.log('❌ Login response is not valid JSON:', parseError.message);
          }
        } else {
          console.log(`❌ Login failed with status: ${res.statusCode}`);
          console.log('Response:', data);
        }
        
        resolve();
      });
    });
    
    loginReq.on('error', (err) => {
      console.error('❌ Login request failed:', err.message);
      resolve();
    });
    
    loginReq.write(loginData);
    loginReq.end();
  });
}

async function testSettlementsWithAuth(token) {
  console.log('\n💰 Testing settlements endpoint with authentication...\n');
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/transactions/12/settlements',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log(`📡 Settlements Response Status: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`📄 Settlements Response Body:`, data);
        
        if (res.statusCode === 200) {
          try {
            const settlements = JSON.parse(data);
            console.log(`✅ Settlements API working correctly - returned ${settlements.length} settlements`);
            if (settlements.length === 0) {
              console.log('ℹ️  This is expected - JP\'s transaction has no settlements after the reset');
            }
          } catch (parseError) {
            console.log('❌ Response is not valid JSON:', parseError.message);
          }
        } else {
          console.log(`❌ Settlements API failed with status: ${res.statusCode}`);
        }
        
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.error('❌ Settlements request failed:', err.message);
      resolve();
    });
    
    req.end();
  });
}

async function runTests() {
  await testApiDirect();
  await testWithAuth();
}

runTests();
