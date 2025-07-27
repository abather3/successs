import { Page, expect } from '@playwright/test';

export interface LoginCredentials {
  email: string;
  password: string;
}

export const USERS = {
  ADMIN: { email: 'admin@escashop.com', password: 'admin123' },
  CASHIER: { email: 'cashier@escashop.com', password: 'cashier123' },
  SALES: { email: 'sales@escashop.com', password: 'sales123' }
} as const;

/**
 * Login helper function that can be reused across tests
 */
export async function login(page: Page, credentials: LoginCredentials) {
  await page.goto('/login');
  
  // Try multiple selector patterns for email input
  const emailSelectors = [
    '[data-testid="email"]',
    'input[name="email"]',
    'input[type="email"]',
    '#email'
  ];
  
  let emailInput = null;
  for (const selector of emailSelectors) {
    if (await page.locator(selector).count() > 0) {
      emailInput = page.locator(selector);
      break;
    }
  }
  
  if (!emailInput) {
    throw new Error('Could not find email input field');
  }
  
  await emailInput.fill(credentials.email);
  
  // Try multiple selector patterns for password input
  const passwordSelectors = [
    '[data-testid="password"]',
    'input[name="password"]',
    'input[type="password"]',
    '#password'
  ];
  
  let passwordInput = null;
  for (const selector of passwordSelectors) {
    if (await page.locator(selector).count() > 0) {
      passwordInput = page.locator(selector);
      break;
    }
  }
  
  if (!passwordInput) {
    throw new Error('Could not find password input field');
  }
  
  await passwordInput.fill(credentials.password);
  
  // Try multiple selector patterns for submit button
  const submitSelectors = [
    '[data-testid="login-button"]',
    'button[type="submit"]',
    'button:has-text("Login")',
    'button:has-text("Sign In")',
    '.login-button'
  ];
  
  let submitButton = null;
  for (const selector of submitSelectors) {
    if (await page.locator(selector).count() > 0) {
      submitButton = page.locator(selector);
      break;
    }
  }
  
  if (!submitButton) {
    throw new Error('Could not find login button');
  }
  
  await submitButton.click();
  
  // Wait for successful login and redirect
  await page.waitForURL(/\/(dashboard|transactions|cashier|admin|$)/, { timeout: 10000 });
}

/**
 * Helper to wait for network requests to complete
 */
export async function waitForNetworkIdle(page: Page, timeout = 5000) {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Helper to check for error messages on the page
 */
export async function checkForErrors(page: Page) {
  const errorSelectors = [
    '[role="alert"]',
    '.error',
    '.alert-error',
    '[data-testid*="error"]',
    '.notification.error',
    '.toast.error'
  ];
  
  const errors = [];
  
  for (const selector of errorSelectors) {
    const elements = page.locator(selector);
    const count = await elements.count();
    
    for (let i = 0; i < count; i++) {
      const element = elements.nth(i);
      if (await element.isVisible()) {
        const text = await element.textContent();
        if (text) {
          errors.push(text);
        }
      }
    }
  }
  
  return errors;
}

/**
 * Helper to monitor network requests for specific patterns
 */
export class NetworkMonitor {
  private requests: Array<{ url: string; method: string; status?: number }> = [];
  private responses: Array<{ url: string; method: string; status: number }> = [];
  
  constructor(private page: Page) {
    this.page.on('request', (request) => {
      this.requests.push({
        url: request.url(),
        method: request.method()
      });
    });
    
    this.page.on('response', (response) => {
      this.responses.push({
        url: response.url(),
        method: response.request().method(),
        status: response.status()
      });
    });
  }
  
  getRequests() {
    return [...this.requests];
  }
  
  getResponses() {
    return [...this.responses];
  }
  
  getApiRequests() {
    return this.requests.filter(req => req.url.includes('/api/'));
  }
  
  getApiResponses() {
    return this.responses.filter(res => res.url.includes('/api/'));
  }
  
  getFailedApiResponses() {
    return this.responses.filter(res => 
      res.url.includes('/api/') && (res.status < 200 || res.status >= 300)
    );
  }
  
  findRequestsWithPattern(pattern: string | RegExp) {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    return this.requests.filter(req => regex.test(req.url));
  }
  
  hasNaNRequests() {
    return this.requests.some(req => 
      req.url.includes('NaN') || req.url.includes('undefined')
    );
  }
  
  clear() {
    this.requests = [];
    this.responses = [];
  }
}

/**
 * Helper to find form elements with multiple selector strategies
 */
export async function findFormElement(page: Page, fieldName: string, inputType?: string) {
  const selectors = [
    `[data-testid="${fieldName}"]`,
    `input[name="${fieldName}"]`,
    `select[name="${fieldName}"]`,
    `#${fieldName}`,
    `.${fieldName}`,
    `[data-field="${fieldName}"]`
  ];
  
  if (inputType) {
    selectors.unshift(`input[type="${inputType}"][name="${fieldName}"]`);
    selectors.unshift(`input[type="${inputType}"]`);
  }
  
  for (const selector of selectors) {
    const element = page.locator(selector);
    if (await element.count() > 0) {
      return element.first();
    }
  }
  
  return null;
}

/**
 * Helper to wait for WebSocket connection status
 */
export async function waitForWebSocketStatus(page: Page, status: 'connected' | 'disconnected' | 'error', timeout = 10000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const currentStatus = await page.getAttribute('body', 'data-websocket-status');
    if (currentStatus === status) {
      return true;
    }
    await page.waitForTimeout(100);
  }
  
  return false;
}

/**
 * Helper to setup WebSocket monitoring
 */
export async function setupWebSocketMonitoring(page: Page) {
  await page.addInitScript(() => {
    const originalWebSocket = window.WebSocket;
    
    window.WebSocket = function(url: string, protocols?: string | string[]) {
      console.log('WebSocket connecting to:', url);
      const ws = new originalWebSocket(url, protocols);
      
      ws.addEventListener('open', () => {
        console.log('WebSocket connected');
        document.body.setAttribute('data-websocket-status', 'connected');
      });
      
      ws.addEventListener('close', (event) => {
        console.log('WebSocket disconnected:', event.reason);
        document.body.setAttribute('data-websocket-status', 'disconnected');
      });
      
      ws.addEventListener('error', (event) => {
        console.log('WebSocket error');
        document.body.setAttribute('data-websocket-status', 'error');
      });
      
      return ws;
    } as any;
    
    Object.setPrototypeOf(window.WebSocket, originalWebSocket);
  });
}
