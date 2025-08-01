#!/usr/bin/env node

/**
 * Diagnostic Script: Transaction Management Amount Column Issue
 * 
 * This script tests the complete data flow from backend to frontend
 * to identify why the "Amount" column might not display correctly.
 */

const fetch = require('node-fetch');

// Configuration
const API_BASE_URL = 'http://localhost:5000/api';
const TEST_CREDENTIALS = {
  email: 'admin@example.com',
  password: 'admin123'
};

class TransactionAmountDiagnostic {
  constructor() {
    this.authToken = null;
    this.testResults = [];
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, message, data };
    console.log(`[${timestamp}] ${message}`);
    if (data) {
      console.log('Data:', JSON.stringify(data, null, 2));
    }
    this.testResults.push(logEntry);
  }

  async authenticate() {
    try {
      this.log('🔐 Attempting authentication...');
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(TEST_CREDENTIALS)
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }

      const authData = await response.json();
      this.authToken = authData.token || authData.accessToken;
      
      if (!this.authToken) {
        throw new Error('No token received from authentication');
      }

      this.log('✅ Authentication successful', { tokenLength: this.authToken.length });
      return true;
      
    } catch (error) {
      this.log('❌ Authentication failed', { error: error.message });
      return false;
    }
  }

  async testTransactionListAPI() {
    try {
      this.log('📊 Testing Transaction List API...');
      
      const response = await fetch(`${API_BASE_URL}/transactions?page=1&limit=5`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      this.log('✅ Transaction List API response received', {
        transactionCount: data.transactions?.length || 0,
        hasAmountField: data.transactions?.[0]?.amount !== undefined,
        sampleTransaction: data.transactions?.[0] || 'No transactions found'
      });

      // Analyze transaction structure
      if (data.transactions && data.transactions.length > 0) {
        const firstTransaction = data.transactions[0];
        const requiredFields = ['id', 'amount', 'paid_amount', 'balance_amount', 'payment_status', 'customer_name'];
        const missingFields = requiredFields.filter(field => firstTransaction[field] === undefined);
        
        this.log('🔍 Transaction field analysis', {
          allFields: Object.keys(firstTransaction),
          requiredFields,
          missingFields,
          amountValue: firstTransaction.amount,
          amountType: typeof firstTransaction.amount
        });

        if (missingFields.length > 0) {
          this.log('⚠️ Missing required fields detected', { missingFields });
        } else {
          this.log('✅ All required fields present');
        }
      }

      return data;
      
    } catch (error) {
      this.log('❌ Transaction List API test failed', { error: error.message });
      return null;
    }
  }

  async testSingleTransactionAPI(transactionId) {
    try {
      this.log(`🔍 Testing Single Transaction API for ID: ${transactionId}...`);
      
      const response = await fetch(`${API_BASE_URL}/transactions/${transactionId}`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const transaction = await response.json();
      
      this.log('✅ Single Transaction API response received', {
        transactionId: transaction.id,
        amount: transaction.amount,
        amountType: typeof transaction.amount,
        hasAllPaymentFields: !!(transaction.paid_amount !== undefined && 
                                transaction.balance_amount !== undefined && 
                                transaction.payment_status)
      });

      return transaction;
      
    } catch (error) {
      this.log('❌ Single Transaction API test failed', { error: error.message });
      return null;
    }
  }

  async testFrontendAPICallSimulation() {
    try {
      this.log('🌐 Simulating frontend API call...');
      
      // Simulate the exact call made by EnhancedTransactionManagement component
      const filters = {
        page: 1,
        limit: 10
      };

      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const response = await fetch(`${API_BASE_URL}/transactions?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Frontend simulation failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      this.log('✅ Frontend API call simulation successful', {
        url: `${API_BASE_URL}/transactions?${queryParams.toString()}`,
        responseStructure: {
          hasTransactions: !!data.transactions,
          hasPagination: !!data.pagination,
          transactionCount: data.transactions?.length || 0
        }
      });

      // Test the exact rendering logic from the frontend
      if (data.transactions && data.transactions.length > 0) {
        const transaction = data.transactions[0];
        const renderedAmount = this.simulateFrontendAmountRendering(transaction);
        
        this.log('🎨 Frontend rendering simulation', {
          originalAmount: transaction.amount,
          renderedAmount,
          renderingSuccessful: renderedAmount !== '₱NaN' && renderedAmount !== '₱0.00'
        });
      }

      return data;
      
    } catch (error) {
      this.log('❌ Frontend API call simulation failed', { error: error.message });
      return null;
    }
  }

  simulateFrontendAmountRendering(transaction) {
    // Simulate the formatCurrency function from EnhancedTransactionManagement
    const amount = transaction.amount;
    
    if (isNaN(amount) || amount === null || amount === undefined) return '₱0.00';
    if (amount === 0) return '₱0.00';
    
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  async testDatabaseConnectivity() {
    try {
      this.log('🗄️ Testing database connectivity...');
      
      // Test if we can get any transactions at all
      const response = await fetch(`${API_BASE_URL}/transactions?limit=1`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      this.log('✅ Database connectivity test', {
        canFetchTransactions: response.ok,
        hasData: !!(data.transactions && data.transactions.length > 0),
        totalCount: data.pagination?.total || 0
      });

      return response.ok;
      
    } catch (error) {
      this.log('❌ Database connectivity test failed', { error: error.message });
      return false;
    }
  }

  async runComprehensiveDiagnostic() {
    console.log('\n🔬 Starting Transaction Management Amount Column Diagnostic...\n');
    
    // Step 1: Authentication
    const authSuccess = await this.authenticate();
    if (!authSuccess) {
      console.log('\n❌ Diagnostic failed: Unable to authenticate\n');
      return this.generateReport();
    }

    // Step 2: Database connectivity
    await this.testDatabaseConnectivity();

    // Step 3: Transaction List API
    const transactionListData = await this.testTransactionListAPI();
    
    // Step 4: Single transaction test (if we have transactions)
    if (transactionListData?.transactions?.[0]?.id) {
      await this.testSingleTransactionAPI(transactionListData.transactions[0].id);
    }

    // Step 5: Frontend simulation
    await this.testFrontendAPICallSimulation();

    // Step 6: Generate comprehensive report
    return this.generateReport();
  }

  generateReport() {
    console.log('\n📋 DIAGNOSTIC REPORT\n');
    console.log('=' .repeat(50));
    
    // Summary
    const authSuccess = this.testResults.some(r => r.message.includes('Authentication successful'));
    const apiSuccess = this.testResults.some(r => r.message.includes('Transaction List API response received'));
    const hasAmountField = this.testResults.some(r => r.data?.hasAmountField === true);
    const missingFieldsDetected = this.testResults.some(r => r.data?.missingFields?.length > 0);
    
    console.log('SUMMARY:');
    console.log(`✅ Authentication: ${authSuccess ? 'SUCCESS' : 'FAILED'}`);
    console.log(`✅ API Accessibility: ${apiSuccess ? 'SUCCESS' : 'FAILED'}`);
    console.log(`✅ Amount Field Present: ${hasAmountField ? 'YES' : 'NO'}`);
    console.log(`⚠️ Missing Fields: ${missingFieldsDetected ? 'YES' : 'NO'}`);
    
    console.log('\nDETAILED FINDINGS:');
    this.testResults.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.message}`);
      if (result.data) {
        console.log(`   Details: ${JSON.stringify(result.data, null, 2)}`);
      }
    });

    console.log('\nRECOMMENDATIONS:');
    
    if (!authSuccess) {
      console.log('- Fix authentication system');
      console.log('- Verify backend server is running on port 5000');
      console.log('- Check database connection');
    }
    
    if (!apiSuccess) {
      console.log('- Verify transaction API endpoints are working');
      console.log('- Check if transactions exist in database');
      console.log('- Review API route configuration');
    }
    
    if (!hasAmountField) {
      console.log('- CRITICAL: Amount field is missing from API response');
      console.log('- Check TransactionService.list() method');
      console.log('- Verify database schema has amount column');
      console.log('- Review includePaymentDetails flag usage');
    }
    
    if (missingFieldsDetected) {
      console.log('- Review TransactionService query to include all required fields');
      console.log('- Check database JOINs for customer_name, sales_agent_name');
      console.log('- Verify payment_status, paid_amount, balance_amount calculations');
    }

    console.log('\n' + '=' .repeat(50));
    console.log('Diagnostic completed at:', new Date().toISOString());
    
    return this.testResults;
  }
}

// Run the diagnostic
async function main() {
  const diagnostic = new TransactionAmountDiagnostic();
  await diagnostic.runComprehensiveDiagnostic();
}

// Handle script execution
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Diagnostic script failed:', error);
    process.exit(1);
  });
}

module.exports = TransactionAmountDiagnostic;
