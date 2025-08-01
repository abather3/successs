const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  console.log('[PROXY] Setting up proxy middleware for Docker environment');
  
  // Test backend connectivity first
  const testBackendConnection = async () => {
    try {
      const http = require('http');
      const options = {
        hostname: 'backend',
        port: 5000,
        path: '/health',
        method: 'GET',
        timeout: 5000
      };
      
      const req = http.request(options, (res) => {
        console.log(`[PROXY] Backend connection test: ${res.statusCode}`);
      });
      
      req.on('error', (err) => {
        console.error('[PROXY] Backend connection failed:', err.message);
      });
      
      req.on('timeout', () => {
        console.error('[PROXY] Backend connection timeout');
        req.destroy();
      });
      
      req.end();
    } catch (error) {
      console.error('[PROXY] Failed to test backend connection:', error.message);
    }
  };
  
  testBackendConnection();
  
  // Proxy API requests to backend with detailed logging
  const apiProxy = createProxyMiddleware({
    target: 'http://backend:5000',
    changeOrigin: true,
    secure: false,
    logLevel: 'info',
    // Enable binary data handling
    buffer: true,
    selfHandleResponse: false,
    onProxyReq: (proxyReq, req, res) => {
      console.log(`[PROXY] API Request: ${req.method} ${req.url} -> http://backend:5000${req.url}`);
      // Add debug headers
      proxyReq.setHeader('X-Forwarded-For', req.connection.remoteAddress || 'unknown');
      proxyReq.setHeader('X-Forwarded-Proto', 'http');
      
      // For binary downloads, ensure proper content handling
      if (req.url.includes('/export/')) {
        console.log(`[PROXY] Binary export request detected: ${req.url}`);
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      const contentType = proxyRes.headers['content-type'] || '';
      const contentLength = proxyRes.headers['content-length'] || '0';
      console.log(`[PROXY] API Response: ${req.method} ${req.url} -> ${proxyRes.statusCode} (${contentType}, ${contentLength} bytes)`);
      
      // Ensure binary data is properly handled
      if (req.url.includes('/export/') && proxyRes.statusCode === 200) {
        console.log(`[PROXY] Binary export response: ${contentLength} bytes`);
        // Preserve all headers for binary responses
        Object.keys(proxyRes.headers).forEach(key => {
          res.setHeader(key, proxyRes.headers[key]);
        });
      }
    },
    onError: (err, req, res) => {
      console.error(`[PROXY] API Proxy error for ${req.method} ${req.url}:`, err.message);
      if (!res.headersSent) {
        res.status(502).json({ 
          error: 'Backend connection failed',
          details: err.message,
          url: req.url,
          method: req.method
        });
      }
    }
  });
  
  app.use('/api', apiProxy);
  
  // Proxy WebSocket connections for Socket.IO
  app.use(
    '/socket.io',
    createProxyMiddleware({
      target: 'http://backend:5000',
      changeOrigin: true,
      ws: true,
      logLevel: 'info',
      onProxyReq: (proxyReq, req, res) => {
        console.log(`[PROXY] Socket.IO Request: ${req.method} ${req.url}`);
      },
      onError: (err, req, res) => {
        console.error(`[PROXY] Socket.IO Proxy error:`, err.message);
      }
    })
  );
  
  console.log('[PROXY] Proxy middleware setup complete');
};
