import { test, expect, Page } from '@playwright/test';
import { io, Socket } from 'socket.io-client';

test.describe('Cashier Processing to Completed E2E Flow', () => {
  let page: Page;
  let socket: Socket;
  let testCustomerId: number;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Login as cashier
    await page.goto('/login');
    await page.fill('[data-testid="email"], input[name="email"]', 'cashier@escashop.com');
    await page.fill('[data-testid="password"], input[name="password"]', 'cashier123');
    await page.click('[data-testid="login-button"], button[type="submit"]');
    
    // Wait for successful login
    await page.waitForURL(/\/(dashboard|cashier|transactions|$)/);
    
    // Setup WebSocket connection to monitor events
    socket = io('ws://localhost:5000', {
      auth: {
        token: await page.evaluate(() => localStorage.getItem('authToken'))
      }
    });

    // Create test customer in processing status
    await page.evaluate(async () => {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          name: 'E2E Test Customer',
          contact_number: '1234567890',
          email: 'e2e@test.com',
          age: 30,
          address: 'Test Address',
          or_number: `E2E-${Date.now()}`,
          distribution_info: 'pickup',
          prescription: {},
          grade_type: 'single',
          lens_type: 'regular',
          estimated_time: { days: 1, hours: 0, minutes: 0 },
          payment_info: { mode: 'cash', amount: 1500 },
          priority_flags: { senior_citizen: false, pregnant: false, pwd: false },
          queue_status: 'processing'
        })
      });
      const customer = await response.json();
      window.testCustomerId = customer.id;
    });

    testCustomerId = await page.evaluate(() => window.testCustomerId);
  });

  test.afterEach(async () => {
    if (socket) {
      socket.disconnect();
    }
    
    // Clean up test customer
    if (testCustomerId) {
      await page.evaluate((customerId) => {
        fetch(`/api/customers/${customerId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
      }, testCustomerId);
    }
    
    await page.close();
  });

  test('should mark order Processing → Completed and verify monitor exclusion', async () => {
    let statusChangeReceived = false;
    let excludedFromMonitor = false;

    // Listen for WebSocket events
    socket.on('queue:status_changed', (data) => {
      if (data.customerId === testCustomerId && data.newStatus === 'completed') {
        statusChangeReceived = true;
      }
    });

    socket.on('monitor:customer_excluded', (data) => {
      if (data.customerId === testCustomerId) {
        excludedFromMonitor = true;
      }
    });

    // Navigate to cashier dashboard or queue management
    await page.goto('/cashier-dashboard');
    await page.waitForLoadState('networkidle');

    // Look for the customer in processing status
    const processingSection = page.locator('[data-testid="processing-customers"], .processing-section');
    if (await processingSection.isVisible()) {
      // Find customer in processing list
      const customerCard = processingSection.locator(`[data-customer-id="${testCustomerId}"]`).first();
      await expect(customerCard).toBeVisible();

      // Click complete button
      const completeButton = customerCard.locator('[data-testid="complete-button"], button:has-text("Complete"), button:has-text("Mark Complete")');
      await completeButton.click();
    } else {
      // Alternative: Navigate directly to customer details
      await page.goto(`/customers/${testCustomerId}`);
      await page.waitForLoadState('networkidle');

      // Verify customer is in processing status
      const statusIndicator = page.locator('[data-testid="customer-status"], .customer-status');
      await expect(statusIndicator).toContainText('processing', { ignoreCase: true });

      // Click complete button
      const completeButton = page.locator('[data-testid="complete-button"], button:has-text("Complete"), button:has-text("Mark Complete")');
      await completeButton.click();
    }

    // Wait for confirmation dialog if it exists
    const confirmDialog = page.locator('[data-testid="confirm-dialog"], .confirm-dialog, .modal');
    if (await confirmDialog.isVisible()) {
      const confirmButton = confirmDialog.locator('[data-testid="confirm-yes"], button:has-text("Yes"), button:has-text("Confirm")');
      await confirmButton.click();
    }

    // Wait for status change to propagate
    await page.waitForTimeout(2000);

    // Verify customer status changed to completed
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    if (await page.locator(`[data-customer-id="${testCustomerId}"]`).count() > 0) {
      const updatedCustomerCard = page.locator(`[data-customer-id="${testCustomerId}"]`).first();
      const statusText = await updatedCustomerCard.locator('[data-testid="customer-status"], .customer-status').textContent();
      expect(statusText?.toLowerCase()).toContain('completed');
    }

    // Check that customer is no longer visible in processing section
    const processingCustomers = page.locator('[data-testid="processing-customers"] [data-customer-id]');
    const processingIds = await processingCustomers.evaluateAll(elements => 
      elements.map(el => el.getAttribute('data-customer-id'))
    );
    expect(processingIds).not.toContain(testCustomerId.toString());

    // Verify WebSocket events were received
    await page.waitForTimeout(1000);
    expect(statusChangeReceived).toBe(true);

    // Verify customer is excluded from monitor displays
    // This could be checked by navigating to a monitor view
    await page.goto('/monitor');
    await page.waitForLoadState('networkidle');
    
    const monitorCustomers = page.locator('[data-testid="monitor-customers"] [data-customer-id]');
    if (await monitorCustomers.count() > 0) {
      const monitorIds = await monitorCustomers.evaluateAll(elements => 
        elements.map(el => el.getAttribute('data-customer-id'))
      );
      expect(monitorIds).not.toContain(testCustomerId.toString());
    }

    console.log('Successfully verified Processing → Completed transition and monitor exclusion');
  });

  test('should verify proper API responses during status transition', async () => {
    const apiResponses: { url: string; status: number; method: string }[] = [];

    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/')) {
        apiResponses.push({
          url,
          status: response.status(),
          method: response.request().method()
        });
      }
    });

    // Navigate to customer management
    await page.goto(`/customers/${testCustomerId}`);
    await page.waitForLoadState('networkidle');

    // Mark customer as completed
    const completeButton = page.locator('[data-testid="complete-button"], button:has-text("Complete")');
    await completeButton.click();

    // Wait for API calls to complete
    await page.waitForTimeout(2000);

    // Verify all API calls returned success status codes
    const apiCallsToStatusEndpoint = apiResponses.filter(r => 
      r.url.includes(`/customers/${testCustomerId}/status`) || 
      r.url.includes(`/customers/${testCustomerId}`)
    );

    expect(apiCallsToStatusEndpoint.length).toBeGreaterThan(0);

    const failedApiCalls = apiCallsToStatusEndpoint.filter(r => r.status < 200 || r.status >= 300);
    if (failedApiCalls.length > 0) {
      console.error('Failed API calls:', failedApiCalls);
    }
    expect(failedApiCalls).toHaveLength(0);

    // Verify successful status change API call
    const statusChangeCall = apiCallsToStatusEndpoint.find(r => 
      r.method === 'POST' || r.method === 'PUT' || r.method === 'PATCH'
    );
    expect(statusChangeCall?.status).toBeOneOf([200, 201, 204]);
  });

  test('should handle role-based permissions correctly', async () => {
    // Test that only authorized roles can complete orders
    await page.goto(`/customers/${testCustomerId}`);
    await page.waitForLoadState('networkidle');

    // Verify complete button is visible for cashier role
    const completeButton = page.locator('[data-testid="complete-button"], button:has-text("Complete")');
    await expect(completeButton).toBeVisible();
    expect(await completeButton.isEnabled()).toBe(true);

    // Test the actual completion
    await completeButton.click();

    // Verify no permission error occurs
    const errorMessage = page.locator('[data-testid="error-message"], .error-message, .alert-error');
    if (await errorMessage.isVisible()) {
      const errorText = await errorMessage.textContent();
      expect(errorText).not.toMatch(/permission|unauthorized|access denied/i);
    }
  });
});
