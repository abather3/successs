#!/usr/bin/env ts-node
"use strict";
/**
 * Test script for export functionality
 * Run with: npx ts-node src/scripts/test-export.ts
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.testExports = testExports;
const export_1 = require("../services/export");
const customer_1 = require("../services/customer");
async function testExports() {
    console.log('🧪 Starting Export Functionality Tests...\n');
    try {
        // Test 1: List customers to see what's available
        console.log('📋 Test 1: Listing available customers...');
        const customersList = await customer_1.CustomerService.list({}, 5, 0);
        console.log(`Found ${customersList.total} total customers`);
        if (customersList.customers.length === 0) {
            console.log('❌ No customers found. Please add some customers first.');
            return;
        }
        const testCustomer = customersList.customers[0];
        console.log(`Using test customer: ${testCustomer.name} (ID: ${testCustomer.id})`);
        console.log('✅ Test 1 passed\n');
        // Test 2: Excel Export
        console.log('📊 Test 2: Testing Excel export...');
        try {
            const excelBuffer = await export_1.ExportService.exportCustomerToExcel(testCustomer.id);
            console.log(`Excel buffer generated successfully, size: ${excelBuffer.length} bytes`);
            console.log('✅ Test 2 passed\n');
        }
        catch (error) {
            console.error('❌ Test 2 failed:', error);
        }
        // Test 3: PDF Export
        console.log('📄 Test 3: Testing PDF export...');
        try {
            const pdfBuffer = await export_1.ExportService.exportCustomerToPDF(testCustomer.id);
            console.log(`PDF buffer generated successfully, size: ${pdfBuffer.length} bytes`);
            console.log('✅ Test 3 passed\n');
        }
        catch (error) {
            console.error('❌ Test 3 failed:', error);
        }
        // Test 4: Google Sheets Export (only if URL is configured)
        console.log('📈 Test 4: Testing Google Sheets export...');
        try {
            const config = await Promise.resolve().then(() => __importStar(require('../config/config')));
            if (config.config.GOOGLE_SHEETS_URL) {
                console.log('Google Sheets URL is configured, testing export...');
                const sheetsResult = await export_1.ExportService.exportCustomerToGoogleSheets(testCustomer.id);
                console.log('Google Sheets export result:', sheetsResult);
                console.log('✅ Test 4 passed\n');
            }
            else {
                console.log('⚠️  Google Sheets URL not configured, skipping test\n');
            }
        }
        catch (error) {
            console.error('❌ Test 4 failed:', error);
        }
        // Test 5: Bulk Excel Export
        console.log('📊 Test 5: Testing bulk Excel export...');
        try {
            const bulkExcelBuffer = await export_1.ExportService.exportCustomersToExcel();
            console.log(`Bulk Excel buffer generated successfully, size: ${bulkExcelBuffer.length} bytes`);
            console.log('✅ Test 5 passed\n');
        }
        catch (error) {
            console.error('❌ Test 5 failed:', error);
        }
        console.log('🎉 Export functionality tests completed!');
    }
    catch (error) {
        console.error('💥 Fatal error during testing:', error);
    }
}
// Run the test if this script is executed directly
if (require.main === module) {
    testExports().then(() => {
        console.log('Tests finished, exiting...');
        process.exit(0);
    }).catch((error) => {
        console.error('Test runner failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=test-export.js.map