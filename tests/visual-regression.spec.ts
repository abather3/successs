import { test, expect } from '@playwright/test';
import percySnapshot from '@percy/playwright';

/**
 * Visual Regression Test Suite
 * Tests UI components for visual changes during dependency updates
 */

const testData = {
  admin: {
    username: 'admin',
    password: 'admin123'
  },
  customer: {
    name: 'Test Customer',
    phone: '+1234567890',
    service: 'Eye Examination'
  }
};

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Setup test environment
    await page.goto('http://localhost:3000');
    
    // Wait for app to load
    await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 10000 });
    
    // Hide dynamic elements
    await page.addStyleTag({
      content: `
        .loading-spinner,
        .timestamp,
        .real-time-counter,
        .websocket-status {
          visibility: hidden !important;
        }
        
        * {
          animation-duration: 0s !important;
          transition-duration: 0s !important;
        }
      `
    });
  });

  test.describe('Authentication Components', () => {
    test('Login form - initial state', async ({ page }) => {
      await page.goto('/login');
      await page.waitForSelector('.login-form');
      
      await percySnapshot(page, 'Login Form - Initial State');
    });

    test('Login form - with validation errors', async ({ page }) => {
      await page.goto('/login');
      
      // Trigger validation errors
      await page.fill('[data-testid="username-input"]', '');
      await page.fill('[data-testid="password-input"]', '');
      await page.click('[data-testid="login-button"]');
      
      await page.waitForSelector('.error-message');
      
      await percySnapshot(page, 'Login Form - Validation Errors');
    });

    test('Forgot password form', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForSelector('.forgot-password-form');
      
      await percySnapshot(page, 'Forgot Password Form');
    });
  });

  test.describe('Dashboard Components', () => {
    test.beforeEach(async ({ page }) => {
      // Login as admin
      await page.goto('/login');
      await page.fill('[data-testid="username-input"]', testData.admin.username);
      await page.fill('[data-testid="password-input"]', testData.admin.password);
      await page.click('[data-testid="login-button"]');
      
      await page.waitForSelector('[data-testid="dashboard"]');
    });

    test('Admin dashboard - overview', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForSelector('.admin-dashboard');
      
      // Wait for data to load
      await page.waitForSelector('[data-testid="analytics-loaded"]');
      
      await percySnapshot(page, 'Admin Dashboard - Overview');
    });

    test('Admin dashboard - mobile view', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/dashboard');
      await page.waitForSelector('.admin-dashboard');
      
      await percySnapshot(page, 'Admin Dashboard - Mobile');
    });

    test('Cashier dashboard', async ({ page }) => {
      await page.goto('/cashier');
      await page.waitForSelector('.cashier-dashboard');
      
      await percySnapshot(page, 'Cashier Dashboard');
    });

    test('Sales agent dashboard', async ({ page }) => {
      await page.goto('/sales');
      await page.waitForSelector('.sales-dashboard');
      
      await percySnapshot(page, 'Sales Agent Dashboard');
    });
  });

  test.describe('Queue Management Components', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.fill('[data-testid="username-input"]', testData.admin.username);
      await page.fill('[data-testid="password-input"]', testData.admin.password);
      await page.click('[data-testid="login-button"]');
      await page.waitForSelector('[data-testid="dashboard"]');
    });

    test('Queue management - empty state', async ({ page }) => {
      await page.goto('/queue');
      await page.waitForSelector('.queue-management');
      
      // Ensure queue is empty for consistent screenshots
      await page.evaluate(() => {
        // Mock empty queue state
        window.mockQueueState = { customers: [] };
      });
      
      await percySnapshot(page, 'Queue Management - Empty State');
    });

    test('Queue management - with customers', async ({ page }) => {
      await page.goto('/queue');
      await page.waitForSelector('.queue-management');
      
      // Add test customers via API or mock data
      await page.evaluate(() => {
        window.mockQueueState = {
          customers: [
            { id: 1, name: 'Customer 1', token: 'A001', status: 'waiting' },
            { id: 2, name: 'Customer 2', token: 'A002', status: 'called' },
            { id: 3, name: 'Customer 3', token: 'A003', status: 'processing' }
          ]
        };
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="customer-list"]');
      
      await percySnapshot(page, 'Queue Management - With Customers');
    });

    test('Customer registration modal', async ({ page }) => {
      await page.goto('/queue');
      
      // Open registration modal
      await page.click('[data-testid="add-customer-button"]');
      await page.waitForSelector('.customer-registration-modal');
      
      await percySnapshot(page, 'Customer Registration Modal');
    });

    test('Customer registration - filled form', async ({ page }) => {
      await page.goto('/queue');
      
      // Open registration modal and fill form
      await page.click('[data-testid="add-customer-button"]');
      await page.waitForSelector('.customer-registration-modal');
      
      await page.fill('[data-testid="customer-name"]', testData.customer.name);
      await page.fill('[data-testid="customer-phone"]', testData.customer.phone);
      await page.selectOption('[data-testid="service-select"]', testData.customer.service);
      
      await percySnapshot(page, 'Customer Registration - Filled Form');
    });
  });

  test.describe('Transaction Management Components', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.fill('[data-testid="username-input"]', testData.admin.username);
      await page.fill('[data-testid="password-input"]', testData.admin.password);
      await page.click('[data-testid="login-button"]');
      await page.waitForSelector('[data-testid="dashboard"]');
    });

    test('Transaction management - list view', async ({ page }) => {
      await page.goto('/transactions');
      await page.waitForSelector('.transaction-management');
      
      await percySnapshot(page, 'Transaction Management - List View');
    });

    test('Transaction details modal', async ({ page }) => {
      await page.goto('/transactions');
      
      // Click on first transaction (assuming there's test data)
      await page.click('[data-testid="transaction-row"]:first-child');
      await page.waitForSelector('.transaction-details-modal');
      
      await percySnapshot(page, 'Transaction Details Modal');
    });

    test('Payment settlement form', async ({ page }) => {
      await page.goto('/transactions');
      
      // Open settlement form
      await page.click('[data-testid="settle-payment-button"]');
      await page.waitForSelector('.payment-settlement-form');
      
      await percySnapshot(page, 'Payment Settlement Form');
    });
  });

  test.describe('Display Monitor Components', () => {
    test('Display monitor - queue view', async ({ page }) => {
      await page.goto('/display');
      await page.waitForSelector('.display-monitor');
      
      // Wait for queue data to load
      await page.waitForTimeout(2000);
      
      await percySnapshot(page, 'Display Monitor - Queue View');
    });

    test('Display monitor - fullscreen mode', async ({ page }) => {
      await page.goto('/display');
      await page.waitForSelector('.display-monitor');
      
      // Toggle fullscreen
      await page.click('[data-testid="fullscreen-button"]');
      await page.waitForTimeout(1000);
      
      await percySnapshot(page, 'Display Monitor - Fullscreen');
    });

    test('Display monitor - dark mode', async ({ page }) => {
      await page.goto('/display');
      await page.waitForSelector('.display-monitor');
      
      // Toggle dark mode
      await page.click('[data-testid="dark-mode-toggle"]');
      await page.waitForTimeout(500);
      
      await percySnapshot(page, 'Display Monitor - Dark Mode');
    });
  });

  test.describe('Analytics Components', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.fill('[data-testid="username-input"]', testData.admin.username);
      await page.fill('[data-testid="password-input"]', testData.admin.password);
      await page.click('[data-testid="login-button"]');
      await page.waitForSelector('[data-testid="dashboard"]');
    });

    test('Analytics dashboard', async ({ page }) => {
      await page.goto('/analytics');
      await page.waitForSelector('.analytics-dashboard');
      
      // Wait for charts to load
      await page.waitForSelector('[data-testid="analytics-charts-loaded"]');
      
      await percySnapshot(page, 'Analytics Dashboard');
    });

    test('Historical analytics', async ({ page }) => {
      await page.goto('/analytics/historical');
      await page.waitForSelector('.historical-analytics');
      
      // Wait for data visualization
      await page.waitForSelector('[data-testid="historical-charts-loaded"]');
      
      await percySnapshot(page, 'Historical Analytics');
    });

    test('Daily reports', async ({ page }) => {
      await page.goto('/reports/daily');
      await page.waitForSelector('.daily-reports');
      
      await percySnapshot(page, 'Daily Reports');
    });
  });

  test.describe('Responsive Design Tests', () => {
    const viewports = [
      { name: 'Mobile', width: 375, height: 812 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1280, height: 800 },
      { name: 'Large Desktop', width: 1920, height: 1080 }
    ];

    viewports.forEach(viewport => {
      test(`Navigation - ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        
        // Login first
        await page.goto('/login');
        await page.fill('[data-testid="username-input"]', testData.admin.username);
        await page.fill('[data-testid="password-input"]', testData.admin.password);
        await page.click('[data-testid="login-button"]');
        
        await page.waitForSelector('[data-testid="navigation"]');
        
        await percySnapshot(page, `Navigation - ${viewport.name}`);
      });
    });
  });

  test.describe('Error States', () => {
    test('404 page', async ({ page }) => {
      await page.goto('/non-existent-page');
      await page.waitForSelector('.error-page');
      
      await percySnapshot(page, '404 Error Page');
    });

    test('Network error state', async ({ page }) => {
      // Simulate network error
      await page.route('**/api/**', route => {
        route.abort('failed');
      });
      
      await page.goto('/dashboard');
      await page.waitForSelector('.network-error');
      
      await percySnapshot(page, 'Network Error State');
    });

    test('Loading states', async ({ page }) => {
      // Intercept API calls to simulate loading
      await page.route('**/api/queue', route => {
        setTimeout(() => route.continue(), 5000);
      });
      
      await page.goto('/queue');
      await page.waitForSelector('.loading-spinner');
      
      await percySnapshot(page, 'Loading State - Queue');
    });
  });

  test.describe('Theme Variations', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
      await page.fill('[data-testid="username-input"]', testData.admin.username);
      await page.fill('[data-testid="password-input"]', testData.admin.password);
      await page.click('[data-testid="login-button"]');
      await page.waitForSelector('[data-testid="dashboard"]');
    });

    test('Light theme - dashboard', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Ensure light theme is active
      await page.click('[data-testid="light-theme-toggle"]');
      await page.waitForTimeout(500);
      
      await percySnapshot(page, 'Dashboard - Light Theme');
    });

    test('Dark theme - dashboard', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Switch to dark theme
      await page.click('[data-testid="dark-theme-toggle"]');
      await page.waitForTimeout(500);
      
      await percySnapshot(page, 'Dashboard - Dark Theme');
    });

    test('High contrast mode', async ({ page }) => {
      await page.goto('/dashboard');
      
      // Enable high contrast mode
      await page.click('[data-testid="high-contrast-toggle"]');
      await page.waitForTimeout(500);
      
      await percySnapshot(page, 'Dashboard - High Contrast');
    });
  });
});
