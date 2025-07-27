import { test, expect, Page } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

test.describe('WebSocket Connection Loss and Recovery', () => {
  let page: Page;
  
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Login as admin to access all features
    await page.goto('/login');
    await page.fill('[data-testid="email"], input[name="email"]', 'admin@escashop.com');
    await page.fill('[data-testid="password"], input[name="password"]', 'admin123');
    await page.click('[data-testid="login-button"], button[type="submit"]');
    
    // Wait for successful login
    await page.waitForURL(/\/(dashboard|transactions|$)/);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should show connection lost message and recover when WebSocket server is killed', async () => {
    // Track connection status messages
    const connectionMessages: string[] = [];
    const consoleMessages: string[] = [];
    
    // Listen for console messages that might indicate connection status
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push(text);
      
      if (text.toLowerCase().includes('socket') || 
          text.toLowerCase().includes('connection') ||
          text.toLowerCase().includes('disconnect') ||
          text.toLowerCase().includes('reconnect')) {
        console.log('WebSocket console message:', text);
      }
    });

    // Navigate to a page that uses WebSocket (likely dashboard or queue management)
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Wait for initial connection to establish
    await page.waitForTimeout(3000);
    
    // Look for any existing connection status indicators
    const connectionStatusElements = page.locator('[data-testid*="connection"], .connection-status, [data-testid*="socket"], .websocket-status');
    
    // Add custom JavaScript to track WebSocket connection status
    await page.evaluate(() => {
      // Try to access the WebSocket connection from the React context or window
      // This is a bit hacky but necessary for testing WebSocket state
      
      let originalWebSocket = window.WebSocket;
      let currentSocket: WebSocket | null = null;
      
      // Override WebSocket constructor to track connections
      window.WebSocket = function(url: string, protocols?: string | string[]) {
        console.log('WebSocket connecting to:', url);
        currentSocket = new originalWebSocket(url, protocols);
        
        currentSocket.onopen = function(event) {
          console.log('WebSocket connected');
          document.body.setAttribute('data-websocket-status', 'connected');
          originalWebSocket.prototype.onopen?.call(this, event);
        };
        
        currentSocket.onclose = function(event) {
          console.log('WebSocket disconnected:', event.reason);
          document.body.setAttribute('data-websocket-status', 'disconnected');
          originalWebSocket.prototype.onclose?.call(this, event);
        };
        
        currentSocket.onerror = function(event) {
          console.log('WebSocket error');
          document.body.setAttribute('data-websocket-status', 'error');
          originalWebSocket.prototype.onerror?.call(this, event);
        };
        
        return currentSocket;
      } as any;
      
      // Copy static properties
      Object.setPrototypeOf(window.WebSocket, originalWebSocket);
      Object.defineProperty(window.WebSocket, 'prototype', {
        value: originalWebSocket.prototype,
        writable: false
      });
    });

    // Wait for WebSocket connection to be established
    await page.waitForTimeout(2000);
    
    // Check if WebSocket is connected
    const initialStatus = await page.getAttribute('body', 'data-websocket-status');
    console.log('Initial WebSocket status:', initialStatus);

    // Step 1: Kill the WebSocket server (backend)
    console.log('Killing WebSocket server...');
    
    try {
      // Try to kill the backend server process
      // On Windows, use taskkill, on Unix-like systems use pkill
      const platform = process.platform;
      
      if (platform === 'win32') {
        // Windows - kill node processes running on port 5000
        await execAsync('netstat -ano | findstr :5000').then(async (result) => {
          const lines = result.stdout.split('\n');
          const pids = lines
            .filter(line => line.includes('LISTENING'))
            .map(line => line.trim().split(/\s+/).pop())
            .filter(pid => pid && pid !== '0');
          
          for (const pid of pids) {
            try {
              await execAsync(`taskkill /F /PID ${pid}`);
              console.log(`Killed process ${pid}`);
            } catch (e) {
              console.log(`Failed to kill process ${pid}`);
            }
          }
        }).catch(() => {
          console.log('No processes found on port 5000');
        });
      } else {
        // Unix-like systems
        await execAsync('pkill -f "node.*backend" || pkill -f "npm.*dev:backend" || true');
      }
    } catch (error) {
      console.log('Error killing server (this may be expected):', error);
    }

    // Step 2: Wait and check for connection lost indication
    await page.waitForTimeout(5000);
    
    // Look for connection lost messages in various places
    const connectionLostIndicators = [
      '[data-testid*="connection-lost"]',
      '[data-testid*="offline"]',
      '[data-testid*="disconnected"]',
      '.connection-lost',
      '.offline-indicator',
      '.websocket-disconnected',
      '[role="alert"]:has-text("connection"i)',
      '[role="alert"]:has-text("lost"i)',
      '[role="alert"]:has-text("offline"i)',
      '.notification:has-text("connection"i)',
      '.error:has-text("connection"i)',
      '[data-testid="error-message"]:has-text("connection"i)'
    ];
    
    let connectionLostShown = false;
    
    for (const selector of connectionLostIndicators) {
      if (await page.locator(selector).count() > 0) {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          const text = await element.textContent();
          if (text && (text.toLowerCase().includes('connection') || 
                      text.toLowerCase().includes('lost') || 
                      text.toLowerCase().includes('offline'))) {
            connectionMessages.push(text);
            connectionLostShown = true;
            console.log('Found connection lost indicator:', text);
            break;
          }
        }
      }
    }
    
    // Also check WebSocket status attribute we set
    const statusAfterKill = await page.getAttribute('body', 'data-websocket-status');
    console.log('WebSocket status after kill:', statusAfterKill);
    
    if (statusAfterKill === 'disconnected' || statusAfterKill === 'error') {
      connectionLostShown = true;
    }
    
    // Check console messages for connection lost indications
    const hasConnectionLostConsoleMessage = consoleMessages.some(msg => 
      msg.toLowerCase().includes('disconnect') || 
      msg.toLowerCase().includes('connection') && msg.toLowerCase().includes('lost') ||
      msg.toLowerCase().includes('websocket') && msg.toLowerCase().includes('error')
    );
    
    if (hasConnectionLostConsoleMessage) {
      connectionLostShown = true;
    }

    // Step 3: Restart the backend server
    console.log('Restarting WebSocket server...');
    
    // Start the backend server again
    const platform = process.platform;
    const startCommand = platform === 'win32' 
      ? 'start /b npm run dev:backend' 
      : 'npm run dev:backend &';
    
    try {
      execAsync(startCommand);
      console.log('Started backend server');
    } catch (error) {
      console.log('Error starting server:', error);
    }
    
    // Step 4: Wait for reconnection (10 seconds as specified)
    console.log('Waiting for reconnection...');
    await page.waitForTimeout(12000); // Wait a bit longer than 10s to ensure connection
    
    // Check for reconnection
    let reconnected = false;
    
    // Check WebSocket status
    const statusAfterRestart = await page.getAttribute('body', 'data-websocket-status');
    console.log('WebSocket status after restart:', statusAfterRestart);
    
    if (statusAfterRestart === 'connected') {
      reconnected = true;
    }
    
    // Check for reconnection messages
    const reconnectionIndicators = [
      '[data-testid*="connected"]',
      '[data-testid*="online"]',
      '.connection-restored',
      '.online-indicator',
      '.websocket-connected',
      '[role="alert"]:has-text("connected"i)',
      '[role="alert"]:has-text("restored"i)',
      '.notification:has-text("connected"i)'
    ];
    
    for (const selector of reconnectionIndicators) {
      if (await page.locator(selector).count() > 0) {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          reconnected = true;
          const text = await element.textContent();
          console.log('Found reconnection indicator:', text);
          break;
        }
      }
    }
    
    // Check console messages for reconnection
    const hasReconnectionConsoleMessage = consoleMessages.some(msg => 
      msg.toLowerCase().includes('reconnect') || 
      msg.toLowerCase().includes('connection') && msg.toLowerCase().includes('restored') ||
      msg.toLowerCase().includes('websocket') && msg.toLowerCase().includes('connected')
    );
    
    if (hasReconnectionConsoleMessage) {
      reconnected = true;
    }
    
    // Step 5: Verify the test results
    console.log('Connection messages captured:', connectionMessages);
    console.log('Console messages:', consoleMessages.filter(msg => 
      msg.toLowerCase().includes('socket') || msg.toLowerCase().includes('connection')
    ));
    
    // Assert that connection lost was shown
    expect(connectionLostShown).toBe(true);
    
    // Assert that reconnection happened
    expect(reconnected).toBe(true);
    
    // Verify the UI is still functional after reconnection
    await page.waitForTimeout(2000);
    
    // Try to navigate to verify the app is working
    const navigationWorked = await page.goto('/dashboard').then(() => true).catch(() => false);
    expect(navigationWorked).toBe(true);
    
    console.log('WebSocket connection recovery test completed successfully');
  });

  test('should handle WebSocket disconnection gracefully during user interactions', async () => {
    const consoleMessages: string[] = [];
    
    page.on('console', (msg) => {
      consoleMessages.push(msg.text());
    });

    // Navigate to a WebSocket-dependent page
    await page.goto('/queue'); // Queue management likely uses WebSocket for real-time updates
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Simulate network interruption by navigating to offline
    await page.context().setOffline(true);
    
    // Wait for disconnection to be detected
    await page.waitForTimeout(5000);
    
    // Try to perform some user action that would normally require WebSocket
    const actionButtons = page.locator('button, [data-testid*="button"]');
    const buttonCount = await actionButtons.count();
    
    if (buttonCount > 0) {
      // Try clicking a button while offline
      await actionButtons.first().click({ timeout: 5000 }).catch(() => {
        console.log('Button click failed while offline (expected)');
      });
    }
    
    // Restore connection
    await page.context().setOffline(false);
    await page.waitForTimeout(8000);
    
    // Verify the page is still responsive
    const isResponsive = await page.locator('body').isVisible();
    expect(isResponsive).toBe(true);
    
    // Check if any error handling messages appeared
    const hasConnectionErrors = consoleMessages.some(msg => 
      msg.toLowerCase().includes('connection') || 
      msg.toLowerCase().includes('network') ||
      msg.toLowerCase().includes('offline')
    );
    
    console.log('Network interruption test completed');
    console.log('Had connection-related console messages:', hasConnectionErrors);
  });

  test('should maintain WebSocket connection across page navigation', async () => {
    // Track WebSocket events across navigation
    const wsEvents: string[] = [];
    
    // Add tracking to the page
    await page.addInitScript(() => {
      const originalWebSocket = window.WebSocket;
      window.WebSocket = function(url: string, protocols?: string | string[]) {
        console.log('WebSocket created for:', url);
        const ws = new originalWebSocket(url, protocols);
        
        ws.addEventListener('open', () => {
          console.log('WebSocket opened');
          (window as any).__wsConnectionCount = ((window as any).__wsConnectionCount || 0) + 1;
        });
        
        ws.addEventListener('close', () => {
          console.log('WebSocket closed');
        });
        
        return ws;
      } as any;
      
      Object.setPrototypeOf(window.WebSocket, originalWebSocket);
    });

    // Navigate to different pages that might use WebSocket
    const pages = ['/dashboard', '/queue', '/transactions'];
    
    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Check if WebSocket connections are being created properly
      const connectionCount = await page.evaluate(() => (window as any).__wsConnectionCount || 0);
      console.log(`WebSocket connections after navigating to ${pagePath}:`, connectionCount);
    }
    
    // Final verification that WebSocket is working
    const finalConnectionCount = await page.evaluate(() => (window as any).__wsConnectionCount || 0);
    expect(finalConnectionCount).toBeGreaterThan(0);
  });
});
