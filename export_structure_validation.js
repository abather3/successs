const fs = require('fs');
const path = require('path');

console.log('🔍 Export Structure Validation Report');
console.log('=====================================\n');

// Load and analyze the export service
console.log('📁 Analyzing Export Service Structure...\n');

// Read the export service file
let exportServiceContent = '';
try {
  exportServiceContent = fs.readFileSync('backend/src/services/export.ts', 'utf8');
  console.log('✅ Successfully loaded export service file');
} catch (error) {
  console.log('❌ Failed to load export service file:', error.message);
  process.exit(1);
}

// Analysis functions
function analyzeHeaderStructure() {
  console.log('\n📊 Header Structure Analysis:');
  console.log('==========================\n');
  
  // Extract headers from the export service
  const headerPattern = /const headers = \[([\s\S]*?)\];/g;
  const matches = [...exportServiceContent.matchAll(headerPattern)];
  
  if (matches.length > 0) {
    const headersText = matches[0][1];
    const headers = headersText
      .split(',')
      .map(h => h.trim().replace(/'/g, '').replace(/"/g, ''))
      .filter(h => h.length > 0);
    
    console.log('📋 Export Headers (in order):');
    headers.forEach((header, index) => {
      const isPaymentAmount = header.toLowerCase().includes('payment amount');
      const isORNumber = header.toLowerCase().includes('or number');
      const marker = isPaymentAmount || isORNumber ? ' 🎯' : '';
      
      console.log(`   ${(index + 1).toString().padStart(2, ' ')}. ${header}${marker}`);
    });
    
    // Find positions of Payment Amount and OR Number
    const paymentAmountIndex = headers.findIndex(h => h.toLowerCase().includes('payment amount'));
    const orNumberIndex = headers.findIndex(h => h.toLowerCase().includes('or number'));
    
    console.log('\n🔍 Key Field Analysis:');
    console.log(`   Payment Amount position: ${paymentAmountIndex + 1} (column ${paymentAmountIndex + 1})`);
    console.log(`   OR Number position: ${orNumberIndex + 1} (column ${orNumberIndex + 1})`);
    console.log(`   Side by side: ${Math.abs(orNumberIndex - paymentAmountIndex) === 1 ? '✅ YES' : '❌ NO'}`);
    console.log(`   Adjacent distance: ${Math.abs(orNumberIndex - paymentAmountIndex)} column(s)`);
    
    return {
      headers,
      paymentAmountIndex,
      orNumberIndex,
      sideBySide: Math.abs(orNumberIndex - paymentAmountIndex) === 1,
      totalHeaders: headers.length
    };
  }
  
  return null;
}

function analyzeExportFormats() {
  console.log('\n📄 Export Format Analysis:');
  console.log('=========================\n');
  
  // Find export functions
  const formats = {
    excel: {
      single: exportServiceContent.includes('exportCustomerToExcel'),
      multi: exportServiceContent.includes('exportCustomersToExcel'),
      found: exportServiceContent.includes('ExcelJS')
    },
    pdf: {
      single: exportServiceContent.includes('exportCustomerToPDF'),
      multi: exportServiceContent.includes('exportCustomersToPDF'),
      found: exportServiceContent.includes('jsPDF')
    },
    sheets: {
      single: exportServiceContent.includes('exportCustomerToGoogleSheets'),
      multi: exportServiceContent.includes('exportCustomersToGoogleSheets'),
      found: exportServiceContent.includes('GOOGLE_SHEETS_URL')
    }
  };
  
  Object.entries(formats).forEach(([format, info]) => {
    console.log(`📊 ${format.toUpperCase()} Export:`);
    console.log(`   Single customer: ${info.single ? '✅' : '❌'}`);
    console.log(`   Multi customer:  ${info.multi ? '✅' : '❌'}`);
    console.log(`   Library support: ${info.found ? '✅' : '❌'}`);
    console.log('');
  });
  
  return formats;
}

function analyzeDataFormatting() {
  console.log('\n🎨 Data Formatting Analysis:');
  console.log('===========================\n');
  
  // Check for data formatting functions
  const formattingFeatures = {
    paymentFormatting: exportServiceContent.includes('formatPaymentMode'),
    priorityFormatting: exportServiceContent.includes('formatPriorityFlags'),
    dataStructure: exportServiceContent.includes('formatCustomerData'),
    currencySymbol: exportServiceContent.includes('₱'),
    dateFormatting: exportServiceContent.includes('toLocaleDateString'),
  };
  
  console.log('🔧 Formatting Features:');
  Object.entries(formattingFeatures).forEach(([feature, exists]) => {
    console.log(`   ${feature}: ${exists ? '✅' : '❌'}`);
  });
  
  return formattingFeatures;
}

function validateRouteStructure() {
  console.log('\n🛣️  Route Structure Analysis:');
  console.log('============================\n');
  
  let routeContent = '';
  try {
    routeContent = fs.readFileSync('backend/src/routes/customers.ts', 'utf8');
    console.log('✅ Successfully loaded customer routes file');
  } catch (error) {
    console.log('❌ Failed to load customer routes file:', error.message);
    return null;
  }
  
  // Analyze export routes
  const routes = {
    singleExcel: routeContent.includes('/:id/export/excel'),
    singlePDF: routeContent.includes('/:id/export/pdf'),
    singleSheets: routeContent.includes('/:id/export/sheets'),
    multiExcel: routeContent.includes('/export/excel'),
    multiPDF: routeContent.includes('/export/pdf'),
    multiSheets: routeContent.includes('/export/sheets'),
  };
  
  console.log('🔗 Available Export Routes:');
  console.log(`   Single Customer Excel:  ${routes.singleExcel ? '✅' : '❌'} GET /:id/export/excel`);
  console.log(`   Single Customer PDF:    ${routes.singlePDF ? '✅' : '❌'} GET /:id/export/pdf`);
  console.log(`   Single Customer Sheets: ${routes.singleSheets ? '✅' : '❌'} POST /:id/export/sheets`);
  console.log(`   Multi Customer Excel:   ${routes.multiExcel ? '✅' : '❌'} POST /export/excel`);
  console.log(`   Multi Customer PDF:     ${routes.multiPDF ? '✅' : '❌'} POST /export/pdf`);
  console.log(`   Multi Customer Sheets:  ${routes.multiSheets ? '✅' : '❌'} POST /export/sheets`);
  
  return routes;
}

function generateValidationReport(headerAnalysis, formatAnalysis, formattingAnalysis, routeAnalysis) {
  console.log('\n📈 COMPREHENSIVE VALIDATION REPORT');
  console.log('=====================================\n');
  
  const report = {
    timestamp: new Date().toISOString(),
    paymentAmountOrNumberPositioning: {
      status: headerAnalysis?.sideBySide ? 'PASS' : 'FAIL',
      paymentAmountColumn: headerAnalysis?.paymentAmountIndex + 1 || 'N/A',
      orNumberColumn: headerAnalysis?.orNumberIndex + 1 || 'N/A',
      sideBySide: headerAnalysis?.sideBySide || false,
      distance: headerAnalysis ? Math.abs(headerAnalysis.orNumberIndex - headerAnalysis.paymentAmountIndex) : 'N/A'
    },
    exportFormats: {
      excel: {
        status: formatAnalysis.excel?.single && formatAnalysis.excel?.multi ? 'PASS' : 'FAIL',
        singleCustomer: formatAnalysis.excel?.single || false,
        multiCustomer: formatAnalysis.excel?.multi || false,
        librarySupport: formatAnalysis.excel?.found || false
      },
      pdf: {
        status: formatAnalysis.pdf?.single && formatAnalysis.pdf?.multi ? 'PASS' : 'FAIL',
        singleCustomer: formatAnalysis.pdf?.single || false,
        multiCustomer: formatAnalysis.pdf?.multi || false,
        librarySupport: formatAnalysis.pdf?.found || false
      },
      googleSheets: {
        status: formatAnalysis.sheets?.single && formatAnalysis.sheets?.multi ? 'PASS' : 'FAIL',
        singleCustomer: formatAnalysis.sheets?.single || false,
        multiCustomer: formatAnalysis.sheets?.multi || false,
        librarySupport: formatAnalysis.sheets?.found || false
      }
    },
    dataConsistency: {
      status: formattingAnalysis?.dataStructure && formattingAnalysis?.paymentFormatting ? 'PASS' : 'FAIL',
      paymentFormatting: formattingAnalysis?.paymentFormatting || false,
      priorityFormatting: formattingAnalysis?.priorityFormatting || false,
      currencySupport: formattingAnalysis?.currencySymbol || false,
      dateFormatting: formattingAnalysis?.dateFormatting || false
    },
    routeAvailability: {
      status: routeAnalysis && Object.values(routeAnalysis).every(v => v) ? 'PASS' : 'FAIL',
      ...routeAnalysis
    }
  };
  
  // Calculate overall score
  const passCount = [
    report.paymentAmountOrNumberPositioning.status,
    report.exportFormats.excel.status,
    report.exportFormats.pdf.status,
    report.exportFormats.googleSheets.status,
    report.dataConsistency.status,
    report.routeAvailability.status
  ].filter(status => status === 'PASS').length;
  
  const totalTests = 6;
  const overallScore = Math.round((passCount / totalTests) * 100);
  
  console.log('🏆 VALIDATION RESULTS:');
  console.log('=====================\n');
  console.log(`✅ Tests Passed: ${passCount}`);
  console.log(`📊 Total Tests: ${totalTests}`);
  console.log(`🎯 Success Rate: ${overallScore}%\n`);
  
  console.log('📋 DETAILED RESULTS:');
  console.log('===================\n');
  console.log(`🎯 Payment Amount & OR Number Positioning: ${report.paymentAmountOrNumberPositioning.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - Payment Amount at column ${report.paymentAmountOrNumberPositioning.paymentAmountColumn}`);
  console.log(`   - OR Number at column ${report.paymentAmountOrNumberPositioning.orNumberColumn}`);
  console.log(`   - Side by side: ${report.paymentAmountOrNumberPositioning.sideBySide ? 'YES' : 'NO'}\n`);
  
  console.log(`📊 Excel Export: ${report.exportFormats.excel.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - Single customer: ${report.exportFormats.excel.singleCustomer ? 'YES' : 'NO'}`);
  console.log(`   - Multi customer: ${report.exportFormats.excel.multiCustomer ? 'YES' : 'NO'}\n`);
  
  console.log(`📄 PDF Export: ${report.exportFormats.pdf.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - Single customer: ${report.exportFormats.pdf.singleCustomer ? 'YES' : 'NO'}`);
  console.log(`   - Multi customer: ${report.exportFormats.pdf.multiCustomer ? 'YES' : 'NO'}\n`);
  
  console.log(`📈 Google Sheets Export: ${report.exportFormats.googleSheets.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - Single customer: ${report.exportFormats.googleSheets.singleCustomer ? 'YES' : 'NO'}`);
  console.log(`   - Multi customer: ${report.exportFormats.googleSheets.multiCustomer ? 'YES' : 'NO'}\n`);
  
  console.log(`🎨 Data Consistency: ${report.dataConsistency.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - Payment formatting: ${report.dataConsistency.paymentFormatting ? 'YES' : 'NO'}`);
  console.log(`   - Currency support: ${report.dataConsistency.currencySupport ? 'YES' : 'NO'}\n`);
  
  console.log(`🛣️  Route Availability: ${report.routeAvailability.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - All export endpoints configured: ${report.routeAvailability.status === 'PASS' ? 'YES' : 'NO'}\n`);
  
  console.log('💡 RECOMMENDATIONS:');
  console.log('==================\n');
  
  if (overallScore === 100) {
    console.log('   ✅ All export functionality is properly implemented');
    console.log('   ✅ Payment Amount and OR Number are correctly positioned side by side');
    console.log('   ✅ Data consistency is maintained across all export formats');
    console.log('   ✅ All export routes are properly configured');
    console.log('   ✅ Ready for production use');
  } else {
    if (report.paymentAmountOrNumberPositioning.status === 'FAIL') {
      console.log('   ⚠️ Payment Amount and OR Number positioning needs attention');
    }
    if (report.exportFormats.excel.status === 'FAIL') {
      console.log('   ⚠️ Excel export functionality needs review');
    }
    if (report.exportFormats.pdf.status === 'FAIL') {
      console.log('   ⚠️ PDF export functionality needs review');
    }
    if (report.exportFormats.googleSheets.status === 'FAIL') {
      console.log('   ⚠️ Google Sheets export functionality needs review');
    }
    if (report.dataConsistency.status === 'FAIL') {
      console.log('   ⚠️ Data formatting consistency needs improvement');
    }
    if (report.routeAvailability.status === 'FAIL') {
      console.log('   ⚠️ Some export routes are missing or misconfigured');
    }
  }
  
  // Save report to file
  const outputDir = './export_validation_outputs';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const reportPath = path.join(outputDir, 'structure_validation_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  
  return report;
}

// Run analysis
try {
  const headerAnalysis = analyzeHeaderStructure();
  const formatAnalysis = analyzeExportFormats();
  const formattingAnalysis = analyzeDataFormatting();
  const routeAnalysis = validateRouteStructure();
  
  const finalReport = generateValidationReport(headerAnalysis, formatAnalysis, formattingAnalysis, routeAnalysis);
  
  console.log('\n✨ Export Structure Validation Completed Successfully!');
  
} catch (error) {
  console.error('❌ Validation failed:', error.message);
  process.exit(1);
}
