/**
 * Authentication Edge Case Validation Script
 * 
 * This script provides automated validation of authentication edge cases.
 * Run in browser console to test various authentication scenarios.
 */

class AuthEdgeCaseValidator {
  constructor() {
    this.testResults = [];
    this.currentTest = null;
    this.originalConsoleLog = console.log;
    this.logs = [];
  }

  // Capture console logs for analysis
  captureConsoleLog() {
    console.log = (...args) => {
      this.logs.push(args.join(' '));
      this.originalConsoleLog(...args);
    };
  }

  restoreConsoleLog() {
    console.log = this.originalConsoleLog;
  }

  // Clear localStorage and sessionStorage
  clearStorage() {
    localStorage.clear();
    sessionStorage.clear();
    console.log('🧹 Storage cleared');
  }

  // Wait for a condition to be true
  async waitFor(condition, timeout = 5000, interval = 100) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error('Condition not met within timeout');
  }

  // Simulate user input in form fields
  simulateInput(selector, value) {
    const element = document.querySelector(selector);
    if (element) {
      element.value = value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    return false;
  }

  // Click an element
  clickElement(selector) {
    const element = document.querySelector(selector);
    if (element) {
      element.click();
      return true;
    }
    return false;
  }

  // Check if element exists
  elementExists(selector) {
    return document.querySelector(selector) !== null;
  }

  // Get localStorage tokens
  getStorageTokens() {
    return {
      accessToken: localStorage.getItem('accessToken'),
      refreshToken: localStorage.getItem('refreshToken'),
      tokenExpiresAt: localStorage.getItem('tokenExpiresAt')
    };
  }

  // Log test result
  logResult(testName, passed, details = '') {
    const result = {
      test: testName,
      passed,
      details,
      timestamp: new Date().toISOString(),
      logs: [...this.logs]
    };
    
    this.testResults.push(result);
    
    const emoji = passed ? '✅' : '❌';
    console.log(`${emoji} ${testName}: ${passed ? 'PASSED' : 'FAILED'} ${details}`);
    
    this.logs = []; // Clear logs for next test
  }

  // Test 1: Valid Credentials Login
  async testValidLogin() {
    this.currentTest = 'Valid Credentials Login';
    console.log(`\n🧪 Testing: ${this.currentTest}`);
    
    try {
      // Navigate to login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
        await this.waitFor(() => window.location.pathname === '/login');
      }

      await this.waitFor(() => this.elementExists('input[name="email"]'), 3000);

      // Enter valid credentials (adjust these based on your test data)
      const emailEntered = this.simulateInput('input[name="email"]', 'admin@example.com');
      const passwordEntered = this.simulateInput('input[name="password"]', 'admin123');
      
      if (!emailEntered || !passwordEntered) {
        throw new Error('Could not enter credentials');
      }

      // Click login button
      const loginClicked = this.clickElement('button[type="submit"]');
      if (!loginClicked) {
        throw new Error('Could not click login button');
      }

      // Wait for either redirect or error
      await this.waitFor(() => {
        return window.location.pathname !== '/login' || 
               this.elementExists('[role="alert"], .error, .alert-error') ||
               this.logs.some(log => log.includes('REDIRECT TRIGGERED') || log.includes('LOGIN_ERROR'));
      }, 10000);

      // Check if login was successful
      const tokens = this.getStorageTokens();
      const redirectOccurred = window.location.pathname !== '/login';
      const hasTokens = tokens.accessToken && tokens.refreshToken;
      const hasLoginSuccess = this.logs.some(log => log.includes('LOGIN_SUCCESS'));

      const passed = redirectOccurred && hasTokens && hasLoginSuccess;
      this.logResult(this.currentTest, passed, 
        `Redirect: ${redirectOccurred}, Tokens: ${!!hasTokens}, Success Log: ${hasLoginSuccess}`);

      return passed;
    } catch (error) {
      this.logResult(this.currentTest, false, `Error: ${error.message}`);
      return false;
    }
  }

  // Test 2: Invalid Credentials
  async testInvalidLogin() {
    this.currentTest = 'Invalid Credentials Login';
    console.log(`\n🧪 Testing: ${this.currentTest}`);
    
    try {
      this.clearStorage();

      // Navigate to login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
        await this.waitFor(() => window.location.pathname === '/login');
      }

      await this.waitFor(() => this.elementExists('input[name="email"]'), 3000);

      // Enter invalid credentials
      this.simulateInput('input[name="email"]', 'invalid@example.com');
      this.simulateInput('input[name="password"]', 'wrongpassword');
      
      // Click login button
      this.clickElement('button[type="submit"]');

      // Wait for error message
      await this.waitFor(() => 
        this.elementExists('[role="alert"], .error, .alert-error') ||
        this.logs.some(log => log.includes('LOGIN_ERROR')), 
        10000
      );

      // Check results
      const hasError = this.elementExists('[role="alert"], .error, .alert-error');
      const stayedOnLogin = window.location.pathname === '/login';
      const noTokens = !this.getStorageTokens().accessToken;
      const hasErrorLog = this.logs.some(log => log.includes('LOGIN_ERROR'));

      const passed = hasError && stayedOnLogin && noTokens && hasErrorLog;
      this.logResult(this.currentTest, passed, 
        `Error shown: ${hasError}, Stayed on login: ${stayedOnLogin}, No tokens: ${noTokens}`);

      return passed;
    } catch (error) {
      this.logResult(this.currentTest, false, `Error: ${error.message}`);
      return false;
    }
  }

  // Test 3: Protected Route Without Token
  async testProtectedRouteWithoutToken() {
    this.currentTest = 'Protected Route Without Token';
    console.log(`\n🧪 Testing: ${this.currentTest}`);
    
    try {
      this.clearStorage();

      // Try to navigate to a protected route
      window.location.href = '/dashboard';
      
      // Wait for redirect to login
      await this.waitFor(() => window.location.pathname === '/login', 5000);

      const redirectedToLogin = window.location.pathname === '/login';
      const hasProtectedRouteLog = this.logs.some(log => log.includes('NO USER - Redirecting to /login'));

      const passed = redirectedToLogin;
      this.logResult(this.currentTest, passed, 
        `Redirected to login: ${redirectedToLogin}, Log present: ${hasProtectedRouteLog}`);

      return passed;
    } catch (error) {
      this.logResult(this.currentTest, false, `Error: ${error.message}`);
      return false;
    }
  }

  // Test 4: Login Page with Valid Token
  async testLoginPageWithValidToken() {
    this.currentTest = 'Login Page With Valid Token';
    console.log(`\n🧪 Testing: ${this.currentTest}`);
    
    try {
      // First, perform a successful login to get tokens
      await this.testValidLogin();
      
      // Then try to visit login page again
      window.location.href = '/login';
      
      // Wait for redirect away from login
      await this.waitFor(() => window.location.pathname !== '/login', 5000);

      const redirectedAway = window.location.pathname !== '/login';
      const passed = redirectedAway;
      
      this.logResult(this.currentTest, passed, 
        `Redirected away from login: ${redirectedAway}`);

      return passed;
    } catch (error) {
      this.logResult(this.currentTest, false, `Error: ${error.message}`);
      return false;
    }
  }

  // Test 5: Rapid Login Attempts
  async testRapidLoginAttempts() {
    this.currentTest = 'Rapid Login Attempts';
    console.log(`\n🧪 Testing: ${this.currentTest}`);
    
    try {
      this.clearStorage();

      // Navigate to login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
        await this.waitFor(() => window.location.pathname === '/login');
      }

      await this.waitFor(() => this.elementExists('input[name="email"]'), 3000);

      // Enter credentials
      this.simulateInput('input[name="email"]', 'admin@example.com');
      this.simulateInput('input[name="password"]', 'admin123');
      
      // Click login button multiple times rapidly
      const button = document.querySelector('button[type="submit"]');
      if (!button) {
        throw new Error('Login button not found');
      }

      // Count initial login calls
      const initialLoginCalls = this.logs.filter(log => log.includes('Login function called')).length;
      
      // Rapid clicks
      button.click();
      button.click();
      button.click();
      
      // Wait a moment for any processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if button becomes disabled
      const buttonDisabled = button.disabled;
      
      // Count final login calls
      const finalLoginCalls = this.logs.filter(log => log.includes('Login function called')).length;
      const singleCallMade = (finalLoginCalls - initialLoginCalls) === 1;

      const passed = buttonDisabled && singleCallMade;
      this.logResult(this.currentTest, passed, 
        `Button disabled: ${buttonDisabled}, Single call: ${singleCallMade}`);

      return passed;
    } catch (error) {
      this.logResult(this.currentTest, false, `Error: ${error.message}`);
      return false;
    }
  }

  // Test 6: Token Expiration Handling
  async testTokenExpiration() {
    this.currentTest = 'Token Expiration Handling';
    console.log(`\n🧪 Testing: ${this.currentTest}`);
    
    try {
      // First login successfully
      await this.testValidLogin();
      
      // Manually expire the token by setting an expired timestamp
      const expiredTime = Date.now() - 10000; // 10 seconds ago
      localStorage.setItem('tokenExpiresAt', expiredTime.toString());
      
      // Or set an obviously expired token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      localStorage.setItem('accessToken', expiredToken);
      
      // Try to access a protected route
      window.location.href = '/dashboard';
      
      // Wait for redirect to login due to expired token
      await this.waitFor(() => 
        window.location.pathname === '/login' ||
        this.logs.some(log => log.includes('Token verification failed')), 
        10000
      );

      const redirectedToLogin = window.location.pathname === '/login';
      const tokenVerificationFailed = this.logs.some(log => log.includes('Token verification failed'));
      const tokensCleared = !this.getStorageTokens().accessToken;

      const passed = redirectedToLogin && (tokenVerificationFailed || tokensCleared);
      this.logResult(this.currentTest, passed, 
        `Redirected: ${redirectedToLogin}, Token verification failed: ${tokenVerificationFailed}, Tokens cleared: ${tokensCleared}`);

      return passed;
    } catch (error) {
      this.logResult(this.currentTest, false, `Error: ${error.message}`);
      return false;
    }
  }

  // Test 7: State Consistency
  async testStateConsistency() {
    this.currentTest = 'State Consistency';
    console.log(`\n🧪 Testing: ${this.currentTest}`);
    
    try {
      // Login successfully
      await this.testValidLogin();
      
      // Navigate to different protected routes
      const routes = ['/dashboard', '/', '/admin', '/queue'];
      let consistentAccess = true;
      
      for (const route of routes) {
        try {
          window.location.href = route;
          await this.waitFor(() => window.location.pathname === route || window.location.pathname === '/login', 3000);
          
          // If we're redirected to login, that might be due to route not existing or access control
          // The key is that we don't get errors or infinite loops
          if (window.location.pathname === '/login') {
            console.log(`Route ${route} redirected to login (might be access control or non-existent route)`);
          }
        } catch (error) {
          console.log(`Route ${route} caused error: ${error.message}`);
          consistentAccess = false;
        }
      }

      // Check for any JavaScript errors in logs
      const noJSErrors = !this.logs.some(log => 
        log.includes('Error:') || 
        log.includes('Uncaught') || 
        log.includes('TypeError')
      );

      const passed = consistentAccess && noJSErrors;
      this.logResult(this.currentTest, passed, 
        `Consistent access: ${consistentAccess}, No JS errors: ${noJSErrors}`);

      return passed;
    } catch (error) {
      this.logResult(this.currentTest, false, `Error: ${error.message}`);
      return false;
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('🚀 Starting Authentication Edge Case Validation');
    console.log('================================================');
    
    this.captureConsoleLog();
    this.testResults = [];
    
    const tests = [
      this.testProtectedRouteWithoutToken.bind(this),
      this.testInvalidLogin.bind(this),
      this.testValidLogin.bind(this),
      this.testLoginPageWithValidToken.bind(this),
      this.testRapidLoginAttempts.bind(this),
      this.testTokenExpiration.bind(this),
      this.testStateConsistency.bind(this),
    ];

    let passedCount = 0;
    let failedCount = 0;

    for (const test of tests) {
      try {
        const result = await test();
        if (result) {
          passedCount++;
        } else {
          failedCount++;
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Test execution error:', error);
        failedCount++;
      }
    }

    this.restoreConsoleLog();

    console.log('\n📊 Test Results Summary');
    console.log('========================');
    console.log(`✅ Passed: ${passedCount}`);
    console.log(`❌ Failed: ${failedCount}`);
    console.log(`📈 Success Rate: ${((passedCount / (passedCount + failedCount)) * 100).toFixed(1)}%`);
    
    console.log('\n📋 Detailed Results:');
    this.testResults.forEach(result => {
      const emoji = result.passed ? '✅' : '❌';
      console.log(`${emoji} ${result.test}: ${result.details}`);
    });

    // Return summary
    return {
      passed: passedCount,
      failed: failedCount,
      total: passedCount + failedCount,
      results: this.testResults
    };
  }

  // Manual test helpers for specific scenarios
  
  // Simulate network failure
  simulateNetworkFailure() {
    console.log('🌐 Simulating network failure...');
    console.log('Note: Disconnect your network or use browser dev tools to simulate offline mode');
    console.log('Then try to login to test network error handling');
  }

  // Test session expiration
  simulateSessionExpiration() {
    console.log('⏰ Simulating session expiration...');
    
    // Dispatch session expired event
    window.dispatchEvent(new CustomEvent('session-expired'));
    console.log('Session expiration event dispatched');
    
    // Also dispatch session expired dialog
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('session-expired-dialog'));
      console.log('Session expired dialog event dispatched');
    }, 1000);
  }

  // Check current authentication state
  checkAuthState() {
    console.log('\n🔍 Current Authentication State');
    console.log('================================');
    
    const tokens = this.getStorageTokens();
    console.log('Tokens:', tokens);
    console.log('Current path:', window.location.pathname);
    console.log('User logged in:', !!tokens.accessToken);
    
    if (tokens.tokenExpiresAt) {
      const expiresAt = parseInt(tokens.tokenExpiresAt);
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;
      console.log('Token expires in:', Math.round(timeUntilExpiry / 1000), 'seconds');
    }
    
    return tokens;
  }
}

// Create global instance
window.authValidator = new AuthEdgeCaseValidator();

// Quick start function
window.runAuthTests = () => window.authValidator.runAllTests();

console.log('🔧 Authentication Edge Case Validator Loaded');
console.log('📝 Run: runAuthTests() to start all tests');
console.log('🔍 Run: authValidator.checkAuthState() to check current state');
console.log('🌐 Run: authValidator.simulateNetworkFailure() for network testing');
console.log('⏰ Run: authValidator.simulateSessionExpiration() for session testing');
