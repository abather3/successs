const http = require('http');

// Test the DELETE endpoint directly
const testData = JSON.stringify({});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/transactions/reports/daily/2025-07-27',
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWRtaW5AZXNjYXNob3AuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzQzNTE5ODIxLCJleHAiOjE3NDM1NDg2MjF9.k8jh3WcWCAUEJEhExJcXnGvKLPF5rQvnfR8PCBOd4k8' // Admin token
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);

  let responseBody = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    responseBody += chunk;
  });
  
  res.on('end', () => {
    console.log('Response body:', responseBody);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

// Send the request
req.write(testData);
req.end();

console.log('Sending DELETE request to:', options.path);
