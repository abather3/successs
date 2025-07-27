import { test, expect, Page } from '@playwright/test';

test.describe('Transactions Page - NaN Request Prevention', () => {
  let page: Page;
  
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Login as admin first to access transactions page
    await page.goto('/login');
    await page.fill('[data-testid="email"], input[name="email"]', 'admin@escashop.com');
    await page.fill('[data-testid="password"], input[name="password"]', 'admin123');
    await page.click('[data-testid="login-button"], button[type="submit"]');
    
    // Wait for successful login and redirect
    await page.waitForURL(/\/(dashboard|transactions|$)/);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should open transactions page and ensure no NaN requests occur', async () => {
    // Track all network requests made
    const requests: string[] = [];
    const nanRequests: string[] = [];
    
    page.on('request', (request) => {
      const url = request.url();
      requests.push(url);
      
      // Check if the URL contains 'NaN' which would indicate a bug
      if (url.includes('NaN') || url.includes('undefined')) {
        nanRequests.push(url);
        console.error('Found NaN/undefined in request URL:', url);
      }
      
      // Also check request data for POST/PUT requests
      if (request.method() === 'POST' || request.method() === 'PUT') {
        try {
          const postData = request.postData();
          if (postData && (postData.includes('NaN') || postData.includes('undefined'))) {
            nanRequests.push(url + ' (POST data contains NaN/undefined)');
            console.error('Found NaN/undefined in request data:', url, postData);
          }
        } catch (e) {
          // Ignore errors when trying to read post data (e.g., binary data)
        }
      }
    });

    // Navigate to transactions page
    await page.goto('/transactions');
    
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the transactions page
    expect(page.url()).toContain('/transactions');
    
    // Wait for transactions to load (look for transaction table or loading indicator)
    await expect(page.locator('table, [data-testid="transactions-table"], .transaction-list')).toBeVisible({ timeout: 10000 });
    
    // Wait a bit more to ensure all async requests are complete
    await page.waitForTimeout(2000);
    
    // Try various interactions that might trigger NaN issues:
    
    // 1. Check pagination if it exists
    const paginationButtons = page.locator('[data-testid*="pagination"], .pagination button, .MuiPagination button');
    const paginationCount = await paginationButtons.count();
    if (paginationCount > 0) {
      // Try clicking a pagination button
      await paginationButtons.first().click({ timeout: 5000 });
      await page.waitForTimeout(1000);
    }
    
    // 2. Try filtering if filters exist
    const filterInputs = page.locator('input[type="date"], select, [data-testid*="filter"]');
    const filterCount = await filterInputs.count();
    if (filterCount > 0) {
      // Try interacting with a filter
      const firstFilter = filterInputs.first();
      const tagName = await firstFilter.evaluate(el => el.tagName.toLowerCase());
      
      if (tagName === 'select') {
        await firstFilter.selectOption({ index: 1 });
      } else if (tagName === 'input') {
        const inputType = await firstFilter.getAttribute('type');
        if (inputType === 'date') {
          await firstFilter.fill('2024-01-01');
        } else {
          await firstFilter.fill('test');
        }
      }
      await page.waitForTimeout(1000);
    }
    
    // 3. Try sorting if sortable headers exist
    const sortableHeaders = page.locator('th[role="button"], .sortable, [data-testid*="sort"]');
    const sortableCount = await sortableHeaders.count();
    if (sortableCount > 0) {
      await sortableHeaders.first().click();
      await page.waitForTimeout(1000);
    }
    
    // Wait for any final requests to complete
    await page.waitForTimeout(2000);
    
    // Assert no NaN requests were made
    expect(nanRequests).toHaveLength(0);
    
    // Additional validation: check if any API requests were made to transactions endpoint
    const transactionRequests = requests.filter(url => 
      url.includes('/api/transactions') && 
      !url.includes('NaN') && 
      !url.includes('undefined')
    );
    
    expect(transactionRequests.length).toBeGreaterThan(0);
    console.log('Valid transaction API requests made:', transactionRequests.length);
    
    // Check for any visible errors on the page
    const errorMessages = page.locator('[role="alert"], .error, .alert-error, [data-testid*="error"]');
    const errorCount = await errorMessages.count();
    if (errorCount > 0) {
      const errorTexts = await errorMessages.allTextContents();
      console.log('Error messages found:', errorTexts);
    }
    
    // Ensure page loaded successfully without critical errors
    expect(errorCount).toBe(0);
  });

  test('should handle empty transaction list without NaN errors', async () => {
    const requests: string[] = [];
    const nanRequests: string[] = [];
    
    page.on('request', (request) => {
      const url = request.url();
      requests.push(url);
      if (url.includes('NaN') || url.includes('undefined')) {
        nanRequests.push(url);
      }
    });

    // Navigate to transactions page
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');
    
    // Wait for content to load
    await page.waitForTimeout(3000);
    
    // Even with no data, should not generate NaN requests
    expect(nanRequests).toHaveLength(0);
    
    // Should show some indication of no data or actual data
    const hasData = await page.locator('table tbody tr, .transaction-item, [data-testid="no-transactions"]').count() > 0;
    expect(hasData).toBeTruthy();
  });
});
