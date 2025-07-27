const http = require('http');
const WebSocket = require('ws');

// Function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => reject(new Error('Request timeout')));
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Function to authenticate and get token
async function authenticate() {
  console.log('🔐 Authenticating...');
  
  const loginOptions = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const loginData = {
    email: 'admin@escashop.com',
    password: 'admin123'
  };
  
  try {
    const loginResult = await makeRequest(loginOptions, loginData);
    
    if (loginResult.status === 200 && loginResult.data.accessToken) {
      console.log('✅ Authentication successful!');
      return loginResult.data.accessToken;
    } else {
      console.log('❌ Authentication failed:', loginResult.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Authentication error:', error.message);
    return null;
  }
}

// Function to create a test transaction
async function createTestTransaction(token) {
  console.log('💰 Creating test transaction...');
  
  const transactionOptions = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/transactions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };
  
  const transactionData = {
    customer_id: 24, // Using an existing customer ID
    or_number: `TEST-SETTLEMENT-${Date.now()}`,
    amount: 1000.00,
    payment_mode: 'gcash',
    sales_agent_id: 1,
    cashier_id: 1
  };
  
  try {
    const result = await makeRequest(transactionOptions, transactionData);
    
    if (result.status === 201) {
      console.log('✅ Test transaction created:', result.data.id);
      return result.data.id;
    } else {
      console.log('❌ Failed to create transaction:', result.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Transaction creation error:', error.message);
    return null;
  }
}

// Function to create a payment settlement
async function createSettlement(token, transactionId, amount, paymentMode = 'cash', notes = '') {
  console.log(`💳 Creating settlement for transaction ${transactionId}: ₱${amount}...`);
  
  const settlementOptions = {
    hostname: 'localhost',
    port: 5000,
    path: `/api/transactions/${transactionId}/settlements`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };
  
  const settlementData = {
    amount: amount,
    payment_mode: paymentMode,
    cashier_id: 1,
    notes: notes
  };
  
  try {
    const result = await makeRequest(settlementOptions, settlementData);
    
    if (result.status === 201) {
      console.log(`✅ Settlement created: ID ${result.data.id}, Amount: ₱${result.data.amount}`);
      return result.data;
    } else {
      console.log('❌ Failed to create settlement:', result.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Settlement creation error:', error.message);
    return null;
  }
}

// Function to get transaction details
async function getTransactionDetails(token, transactionId) {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: `/api/transactions/${transactionId}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };
  
  try {
    const result = await makeRequest(options);
    
    if (result.status === 200) {
      return result.data;
    } else {
      console.log('❌ Failed to get transaction details:', result.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Error getting transaction details:', error.message);
    return null;
  }
}

// Function to get settlements for a transaction
async function getSettlements(token, transactionId) {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: `/api/transactions/${transactionId}/settlements`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };
  
  try {
    const result = await makeRequest(options);
    
    if (result.status === 200) {
      return result.data;
    } else {
      console.log('❌ Failed to get settlements:', result.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Error getting settlements:', error.message);
    return null;
  }
}

// Function to test WebSocket connection
function testWebSocket() {
  return new Promise((resolve) => {
    console.log('🔌 Testing WebSocket connection...');
    
    const ws = new WebSocket('ws://localhost:5000');
    const events = [];
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected');
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log('📨 WebSocket message:', message);
        events.push({
          timestamp: new Date().toISOString(),
          message: message
        });
      } catch (e) {
        console.log('📨 WebSocket raw message:', data.toString());
        events.push({
          timestamp: new Date().toISOString(),
          raw: data.toString()
        });
      }
    });
    
    ws.on('error', (error) => {
      console.log('❌ WebSocket error:', error.message);
    });
    
    ws.on('close', () => {
      console.log('🔌 WebSocket disconnected');
      resolve(events);
    });
    
    // Close after 5 seconds to collect events
    setTimeout(() => {
      ws.close();
    }, 5000);
  });
}

// Main function to reproduce the bug
async function reproduceSettlementBug() {
  console.log('🚀 Starting settlement bug reproduction test...');
  console.log('🎯 Testing: Confirmation processing loop with duplicate WebSocket events\n');
  
  // Step 1: Authenticate
  const token = await authenticate();
  if (!token) {
    console.log('❌ Cannot proceed without authentication');
    return;
  }
  
  // Step 2: Create a test transaction
  const transactionId = await createTestTransaction(token);
  if (!transactionId) {
    console.log('❌ Cannot proceed without a test transaction');
    return;
  }
  
  // Step 3: Start WebSocket monitoring in background
  console.log('\n📊 Starting WebSocket monitoring...');
  const websocketPromise = testWebSocket();
  
  // Give WebSocket time to connect
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Step 4: Create multiple partial settlements rapidly
  console.log('\n💳 Creating multiple partial settlements rapidly...');
  
  const settlements = [];
  
  // Create first settlement
  const settlement1 = await createSettlement(token, transactionId, 300, 'cash', 'First partial payment');
  if (settlement1) settlements.push(settlement1);
  
  // Short delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Create second settlement
  const settlement2 = await createSettlement(token, transactionId, 250, 'gcash', 'Second partial payment');
  if (settlement2) settlements.push(settlement2);
  
  // Short delay  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Create third settlement
  const settlement3 = await createSettlement(token, transactionId, 200, 'maya', 'Third partial payment');
  if (settlement3) settlements.push(settlement3);
  
  // Step 5: Check transaction status
  console.log('\n🔍 Checking transaction status...');
  const transactionDetails = await getTransactionDetails(token, transactionId);
  if (transactionDetails) {
    console.log('📄 Transaction Status:');
    console.log(`  ID: ${transactionDetails.id}`);
    console.log(`  Amount: ₱${transactionDetails.amount}`);
    console.log(`  Paid Amount: ₱${transactionDetails.paid_amount}`);
    console.log(`  Balance: ₱${transactionDetails.balance_amount}`);
    console.log(`  Payment Status: ${transactionDetails.payment_status}`);
  }
  
  // Step 6: Get all settlements
  const allSettlements = await getSettlements(token, transactionId);
  if (allSettlements) {
    console.log('\n📋 All Settlements:');
    allSettlements.forEach((settlement, index) => {
      console.log(`  ${index + 1}. ID: ${settlement.id}, Amount: ₱${settlement.amount}, Mode: ${settlement.payment_mode}, Time: ${settlement.created_at}`);
    });
  }
  
  // Step 7: Wait for WebSocket events and analyze
  console.log('\n🕐 Waiting for WebSocket events to complete...');
  const websocketEvents = await websocketPromise;
  
  // Step 8: Analyze results
  console.log('\n📊 BUG ANALYSIS RESULTS:');
  console.log('=' * 50);
  
  // Check for duplicate settlements
  if (allSettlements && allSettlements.length > 3) {
    console.log('❌ POTENTIAL BUG: More settlements than expected!');
    console.log(`   Expected: 3 settlements, Found: ${allSettlements.length} settlements`);
  } else {
    console.log('✅ Settlement count looks correct');
  }
  
  // Check for duplicate WebSocket events
  if (websocketEvents.length > settlements.length) {
    console.log('❌ POTENTIAL BUG: Excessive WebSocket events!');
    console.log(`   Created: ${settlements.length} settlements, WebSocket events: ${websocketEvents.length}`);
    console.log('   This may indicate duplicate event emissions');
  } else {
    console.log('✅ WebSocket event count looks reasonable');
  }
  
  // Check calculation accuracy
  if (transactionDetails) {
    const expectedPaid = settlements.reduce((sum, settlement) => sum + parseFloat(settlement.amount), 0);
    const actualPaid = parseFloat(transactionDetails.paid_amount);
    
    if (Math.abs(expectedPaid - actualPaid) > 0.01) {
      console.log('❌ POTENTIAL BUG: Payment calculation mismatch!');
      console.log(`   Expected paid: ₱${expectedPaid}, Actual paid: ₱${actualPaid}`);
    } else {
      console.log('✅ Payment calculations are accurate');
    }
  }
  
  // Display WebSocket events for analysis
  if (websocketEvents.length > 0) {
    console.log('\n📨 WebSocket Events Captured:');
    websocketEvents.forEach((event, index) => {
      console.log(`  ${index + 1}. ${event.timestamp}: ${JSON.stringify(event.message || event.raw)}`);
    });
  }
  
  // Summary
  console.log('\n📋 TEST SUMMARY:');
  console.log(`  Transaction ID: ${transactionId}`);
  console.log(`  Settlements Created: ${settlements.length}`);
  console.log(`  Total Settlements in DB: ${allSettlements ? allSettlements.length : 'Unknown'}`);
  console.log(`  WebSocket Events: ${websocketEvents.length}`);
  console.log(`  Final Transaction Status: ${transactionDetails ? transactionDetails.payment_status : 'Unknown'}`);
  
  console.log('\n✅ Bug reproduction test completed!');
  console.log('💡 Use browser developer tools and server logs to observe the confirmation processing loop');
  console.log('🔗 Frontend URL: http://localhost:3000');
  console.log(`🔍 Check transaction ID ${transactionId} in the UI for real-time updates`);
}

// Run the test
reproduceSettlementBug().catch(console.error);
