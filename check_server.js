const http = require('http');

function testConnection() {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log(`✅ Server is running - Status: ${res.statusCode}`);
    console.log('Headers:', res.headers);
  });

  req.on('error', (error) => {
    console.error('❌ Error connecting to server:', error.message);
  });

  req.end();
}

testConnection();
