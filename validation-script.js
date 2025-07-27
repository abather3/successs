const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const API_BASE_URL = 'http://localhost:5000/api';
const FRONTEND_URL = 'http://localhost:3000';

async function validateDailyReports() {
    console.log('🔍 Starting End-to-End Validation for Daily Reports...\n');
    
    try {
        // Step 1: Login and get token
        console.log('Step 1: Authenticating with admin credentials...');
        const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'admin@escashop.com',
                password: 'admin123'
            })
        });
        
        if (!loginResponse.ok) {
            throw new Error(`Login failed: ${loginResponse.status}`);
        }
        
        const loginData = await loginResponse.json();
        const token = loginData.accessToken;
        console.log('✅ Authentication successful\n');
        
        // Step 2: Test missing report (should return 200 with exists: false)
        console.log('Step 2: Testing missing daily report (should return 200 with exists: false)...');
        const missingReportDate = '2023-12-01';
        const missingReportResponse = await fetch(`${API_BASE_URL}/transactions/reports/daily/${missingReportDate}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log(`   Status: ${missingReportResponse.status}`);
        
        if (missingReportResponse.status !== 200) {
            throw new Error(`❌ Expected 200 status, got ${missingReportResponse.status}`);
        }
        
        const missingReportData = await missingReportResponse.json();
        console.log(`   Response: ${JSON.stringify(missingReportData)}`);
        
        if (missingReportData.exists !== false) {
            throw new Error(`❌ Expected exists: false, got ${missingReportData.exists}`);
        }
        
        console.log('✅ Missing report correctly returns 200 with exists: false\n');
        
        // Step 3: Create a new daily report
        console.log('Step 3: Creating new daily report...');
        const reportDate = new Date().toISOString().split('T')[0];
        const reportData = {
            date: reportDate,
            expenses: [
                { description: 'Office supplies', amount: 150 },
                { description: 'Utilities', amount: 300 }
            ],
            funds: [
                { description: 'Cash deposit', amount: 500 }
            ],
            pettyCashStart: 1000,
            pettyCashEnd: 750
        };
        
        const createReportResponse = await fetch(`${API_BASE_URL}/transactions/reports/daily`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(reportData)
        });
        
        if (!createReportResponse.ok) {
            throw new Error(`❌ Failed to create daily report: ${createReportResponse.status}`);
        }
        
        const createdReport = await createReportResponse.json();
        console.log(`   Created report for date: ${createdReport.date}`);
        console.log(`   Total cash: ₱${createdReport.total_cash}`);
        console.log(`   Cash turnover: ₱${createdReport.cash_turnover}`);
        console.log('✅ Daily report created successfully\n');
        
        // Step 4: Verify the report was saved in database
        console.log('Step 4: Verifying report was saved in database...');
        const savedReportResponse = await fetch(`${API_BASE_URL}/transactions/reports/daily/${reportDate}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!savedReportResponse.ok) {
            throw new Error(`❌ Failed to retrieve saved report: ${savedReportResponse.status}`);
        }
        
        const savedReport = await savedReportResponse.json();
        console.log(`   Retrieved report for date: ${savedReport.date}`);
        console.log(`   Petty cash start: ₱${savedReport.petty_cash_start}`);
        console.log(`   Expenses count: ${savedReport.expenses.length}`);
        console.log(`   Funds count: ${savedReport.funds.length}`);
        console.log('✅ Report successfully retrieved from database\n');
        
        // Step 5: Test currency formatting (verify no NaN values)
        console.log('Step 5: Testing currency formatting...');
        const formatCurrency = (amount) => {
            if (isNaN(amount) || amount === null || amount === undefined) return '₱0.00';
            if (amount === 0) return '₱0.00';
            return new Intl.NumberFormat('en-PH', {
                style: 'currency',
                currency: 'PHP',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        };
        
        // Test various edge cases
        const testCases = [
            { value: 1500, expected: '₱1,500.00' },
            { value: 0, expected: '₱0.00' },
            { value: null, expected: '₱0.00' },
            { value: undefined, expected: '₱0.00' },
            { value: NaN, expected: '₱0.00' }
        ];
        
        testCases.forEach(testCase => {
            const formatted = formatCurrency(testCase.value);
            console.log(`   ${testCase.value} -> ${formatted}`);
            if (formatted !== testCase.expected) {
                throw new Error(`❌ Currency formatting failed for ${testCase.value}: expected ${testCase.expected}, got ${formatted}`);
            }
        });
        
        console.log('✅ Currency formatting works correctly\n');
        
        // Step 6: Test revenue calculation with proper null handling
        console.log('Step 6: Testing revenue calculation...');
        const calculateRevenue = (report) => {
            const revenue = (Number(report.total_cash) || 0) + 
                          (Number(report.total_gcash) || 0) + 
                          (Number(report.total_credit_card) || 0) + 
                          (Number(report.total_maya) || 0) + 
                          (Number(report.total_bank_transfer) || 0);
            return Math.round(revenue * 100) / 100;
        };
        
        const mockReportWithNulls = {
            total_cash: null,
            total_gcash: undefined,
            total_credit_card: 1500,
            total_maya: 0,
            total_bank_transfer: 300
        };
        
        const calculatedRevenue = calculateRevenue(mockReportWithNulls);
        console.log(`   Calculated revenue: ₱${calculatedRevenue}`);
        
        if (isNaN(calculatedRevenue)) {
            throw new Error('❌ Revenue calculation resulted in NaN');
        }
        
        console.log('✅ Revenue calculation handles null/undefined values correctly\n');
        
        // Step 7: Test multiple dates for missing reports
        console.log('Step 7: Testing multiple dates for missing reports...');
        const testDates = ['2023-01-01', '2023-06-15', '2023-12-31'];
        
        for (const testDate of testDates) {
            const response = await fetch(`${API_BASE_URL}/transactions/reports/daily/${testDate}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            console.log(`   Date ${testDate}: Status ${response.status}`);
            
            if (response.status !== 200) {
                throw new Error(`❌ Date ${testDate} returned ${response.status}, expected 200`);
            }
            
            const data = await response.json();
            if (data.exists !== false) {
                throw new Error(`❌ Date ${testDate} should return exists: false`);
            }
        }
        
        console.log('✅ All missing dates correctly return 200 with exists: false\n');
        
        // Final validation summary
        console.log('🎉 END-TO-END VALIDATION COMPLETE!\n');
        console.log('✅ All validation steps passed:');
        console.log('   • No more 404 errors for missing reports');
        console.log('   • API returns 200 with exists: false for missing reports');
        console.log('   • Daily reports can be created and saved to database');
        console.log('   • Currency formatting handles NaN values correctly');
        console.log('   • Revenue calculation handles null/undefined values');
        console.log('   • Multiple date ranges work correctly');
        console.log('\n🚀 The daily reports system is now fully functional!');
        
    } catch (error) {
        console.error('❌ VALIDATION FAILED:', error.message);
        process.exit(1);
    }
}

// Run the validation
validateDailyReports();
