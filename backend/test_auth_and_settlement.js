const http = require('http');

async function testAuthAndSettlement() {
  console.log('🧪 Testing Authentication and Settlement APIs...\n');
  
  // First, try to get an auth token
  console.log('1. Testing authentication...');
  
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
      console.log(`   📡 Login Response Status: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', async () => {
        if (res.statusCode === 200) {
          try {
            const loginResponse = JSON.parse(data);
            const token = loginResponse.accessToken;
            
            console.log('   ✅ Login successful, got auth token');
            
            // Now test the settlements endpoint with auth
            await testSettlementsWithAuth(token);
            
          } catch (parseError) {
            console.log('   ❌ Login response is not valid JSON:', parseError.message);
          }
        } else {
          console.log(`   ❌ Login failed with status: ${res.statusCode}`);
          console.log('   Response:', data);
        }
        
        resolve();
      });
    });
    
    loginReq.on('error', (err) => {
      console.error('   ❌ Login request failed:', err.message);
      resolve();
    });
    
    loginReq.write(loginData);
    loginReq.end();
  });
}

async function testSettlementsWithAuth(token) {
  console.log('\n2. Testing settlements endpoint with authentication...');
  
  // Find a transaction with settlements first
  const transactionId = 10; // We know this has settlements from our previous test
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: `/api/transactions/${transactionId}/settlements`,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log(`   📡 Settlements Response Status: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const settlements = JSON.parse(data);
            console.log(`   ✅ Settlements API working correctly - returned ${settlements.length} settlements`);
            
            if (settlements.length > 0) {
              console.log('   📋 Sample settlement:');
              const settlement = settlements[0];
              console.log(`      - ID: ${settlement.id}`);
              console.log(`      - Amount: ₱${settlement.amount}`);
              console.log(`      - Mode: ${settlement.payment_mode}`);
              console.log(`      - Date: ${settlement.settlement_date}`);
            }
          } catch (parseError) {
            console.log('   ❌ Response is not valid JSON:', parseError.message);
            console.log('   Raw response:', data);
          }
        } else {
          console.log(`   ❌ Settlements API failed with status: ${res.statusCode}`);
          console.log('   Response:', data);
        }
        
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.error('   ❌ Settlements request failed:', err.message);
      resolve();
    });
    
    req.end();
  });
}

async function testCreateSettlement(token) {
  console.log('\n3. Testing settlement creation...');
  
  const transactionId = 8; // Transaction OR659352G4RRD1 with balance ₱2020
  const settlementData = JSON.stringify({
    amount: 500,
    payment_mode: 'cash',
    cashier_id: 1
  });
  
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: `/api/transactions/${transactionId}/settlements`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Content-Length': Buffer.byteLength(settlementData)
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      console.log(`   📡 Create Settlement Response Status: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 201) {
          try {
            const response = JSON.parse(data);
            console.log('   ✅ Settlement created successfully');
            console.log(`   📊 Transaction status: ${response.transaction.payment_status}`);
            console.log(`   💰 New balance: ₱${response.transaction.balance_amount}`);
          } catch (parseError) {
            console.log('   ❌ Response is not valid JSON:', parseError.message);
            console.log('   Raw response:', data);
          }
        } else {
          console.log(`   ❌ Settlement creation failed with status: ${res.statusCode}`);
          console.log('   Response:', data);
        }
        
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.error('   ❌ Settlement creation request failed:', err.message);
      resolve();
    });
    
    req.write(settlementData);
    req.end();
  });
}

// Run the comprehensive test
testAuthAndSettlement().catch(console.error);
