const https = require('https');
const http = require('http');

// Function to make HTTP requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.port === 443 ? https : http;
    const req = protocol.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testDailyReportBug() {
  try {
    console.log('🔐 Step 1: Authenticating...');
    
    // First, authenticate to get a valid token
    const loginOptions = {
      hostname: 'localhost',
      port: 5000,
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const loginData = {
      email: 'admin@escashop.com',
      password: 'admin123' // Assuming this is the admin password
    };
    
    const loginResult = await makeRequest(loginOptions, loginData);
    
    if (loginResult.status !== 200) {
      console.error('❌ Login failed:', loginResult.data);
      return;
    }
    
    const token = loginResult.data.accessToken;
    console.log('✅ Successfully authenticated');
    
    console.log('\n📊 Step 2: Testing daily report API...');
    
    // Now test the daily report endpoint
    const today = new Date().toISOString().split('T')[0];
    const reportOptions = {
      hostname: 'localhost',
      port: 5000,
      path: `/transactions/reports/daily?date=${today}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    const reportResult = await makeRequest(reportOptions);
    
    if (reportResult.status !== 200) {
      console.error('❌ Daily report API failed:', reportResult.data);
      return;
    }
    
    console.log('✅ Daily report API response received');
    console.log('\n🔍 ANALYSIS: Checking for the bug (counts ≠ amounts)...');
    
    const report = reportResult.data;
    
    // Display the full response for analysis
    console.log('\n📋 Full API Response:');
    console.log(JSON.stringify(report, null, 2));
    
    console.log('\n🧪 Bug Analysis:');
    console.log('Expected data from our test transactions:');
    console.log('- cash: 2 transactions, $2450 total');
    console.log('- gcash: 1 transaction, $2250.50 total');
    console.log('- maya: 1 transaction, $800.75 total');
    console.log('- credit_card: 1 transaction, $3200 total');
    console.log('- bank_transfer: 1 transaction, $1800.25 total');
    console.log('- Total: 6 transactions, $10501.5 total');
    
    console.log('\n🔍 Actual API Response Analysis:');
    if (report.paymentModeBreakdown) {
      Object.entries(report.paymentModeBreakdown).forEach(([mode, data]) => {
        console.log(`- ${mode}: ${data.count} transactions, $${data.amount} total`);
      });
    }
    
    if (report.totalTransactions && report.totalAmount) {
      console.log(`- Total: ${report.totalTransactions} transactions, $${report.totalAmount} total`);
    }
    
    // Check for the bug: comparing count vs amount values
    console.log('\n🐛 Bug Detection:');
    let bugDetected = false;
    
    if (report.paymentModeBreakdown) {
      Object.entries(report.paymentModeBreakdown).forEach(([mode, data]) => {
        if (data.count === data.amount) {
          console.log(`⚠️  POTENTIAL BUG DETECTED in ${mode}: count (${data.count}) equals amount (${data.amount})`);
          bugDetected = true;
        }
      });
    }
    
    if (bugDetected) {
      console.log('\n❌ BUG CONFIRMED: The API appears to be returning count values instead of amount values in some cases!');
    } else {
      console.log('\n✅ No obvious bugs detected in the response structure.');
    }
    
  } catch (error) {
    console.error('❌ Error testing daily report API:', error.message);
  }
}

// Run the test
testDailyReportBug();
