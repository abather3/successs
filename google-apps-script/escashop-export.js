/**
 * EscaShop Optical Queue Management System
 * Google Apps Script for Customer Data Export
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://script.google.com/
 * 2. Create a new project
 * 3. Replace the default code with this script
 * 4. Save the project with a name like "EscaShop Customer Export"
 * 5. Deploy as a web app:
 *    - Click Deploy > New deployment
 *    - Choose type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone (for API access)
 *    - Click Deploy and copy the web app URL
 * 6. Use the web app URL in your EscaShop backend configuration
 */

// Configuration - Update these values as needed
const CONFIG = {
  SPREADSHEET_ID: '1EQoJp1fjxMJc3L54JA5hKWHkm-K36vg81YyPv4cCIBE', // Google Sheets ID from backend config
  SHEET_NAME: 'Customer Data', // Same sheet for both single and bulk exports
  BULK_SHEET_NAME: 'Customer Data', // Use same sheet as single exports
  TIMEZONE: 'Asia/Manila' // Adjust timezone as needed
};

/**
 * Main function to handle HTTP GET requests (for testing)
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      message: 'EscaShop Customer Export API is running',
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Main function to handle HTTP POST requests
 */
function doPost(e) {
  try {
    // Check if postData exists
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'No post data received. Make sure to send POST request with JSON data.'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Parse the request data
    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          error: 'Invalid JSON data: ' + parseError.toString()
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const action = data.action || 'single';
    
    if (action === 'bulk') {
      return handleBulkExport(data.customers || []);
    } else {
      return handleSingleExport(data.customer);
    }
  } catch (error) {
    console.error('Error in doPost:', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle single customer export
 */
function handleSingleExport(customer) {
  try {
    console.log('=== SINGLE EXPORT DEBUG START ===');
    console.log('Raw customer data received:', JSON.stringify(customer, null, 2));
    
    if (!customer) {
      console.error('No customer data provided');
      throw new Error('No customer data provided');
    }

    // Check if SPREADSHEET_ID is configured
    if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
      console.error('SPREADSHEET_ID not configured');
      throw new Error('SPREADSHEET_ID not configured. Please update CONFIG.SPREADSHEET_ID in the script.');
    }

    console.log('Opening spreadsheet:', CONFIG.SPREADSHEET_ID);
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    
    // Use the same sheet name as bulk export to ensure consistency
    const sheetName = CONFIG.SHEET_NAME;
    console.log('Looking for sheet:', sheetName);
    let sheet = spreadsheet.getSheetByName(sheetName);
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      console.log('Creating new sheet:', sheetName);
      sheet = spreadsheet.insertSheet(sheetName);
      addHeaders(sheet);
    }
    
    // Check if sheet has headers, add them if missing
    if (sheet.getLastRow() === 0) {
      console.log('Adding headers to empty sheet');
      addHeaders(sheet);
    }
    
    // Add customer data
    console.log('Formatting customer data...');
    const rowData = formatCustomerData(customer);
    console.log('Formatted row data:', JSON.stringify(rowData, null, 2));
    
    console.log('Appending row to sheet...');
    const lastRowBefore = sheet.getLastRow();
    sheet.appendRow(rowData);
    const lastRowAfter = sheet.getLastRow();
    
    console.log('Rows before append:', lastRowBefore);
    console.log('Rows after append:', lastRowAfter);
    
    // Auto-resize columns
    try {
      sheet.autoResizeColumns(1, rowData.length);
      console.log('Auto-resized columns successfully');
    } catch (resizeError) {
      console.warn('Could not auto-resize columns:', resizeError);
    }
    
    // Force save
    SpreadsheetApp.flush();
    console.log('Spreadsheet flushed');
    
    console.log('=== SINGLE EXPORT COMPLETED SUCCESSFULLY ===');
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: 'Customer data exported successfully',
        spreadsheetUrl: spreadsheet.getUrl(),
        sheetName: sheetName,
        rowsAdded: 1,
        rowsBefore: lastRowBefore,
        rowsAfter: lastRowAfter,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('=== ERROR IN SINGLE EXPORT ===');
    console.error('Error details:', error);
    console.error('Error stack:', error.stack);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString(),
        errorType: error.name,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle bulk customers export
 */
function handleBulkExport(customers) {
  try {
    console.log('Starting bulk export for', customers?.length || 0, 'customers');
    
    if (!customers || customers.length === 0) {
      throw new Error('No customer data provided for bulk export');
    }

    // Check if SPREADSHEET_ID is configured
    if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID_HERE') {
      throw new Error('SPREADSHEET_ID not configured. Please update CONFIG.SPREADSHEET_ID in the script.');
    }

    console.log('Opening spreadsheet:', CONFIG.SPREADSHEET_ID);
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    
    // Use the same sheet name as single export to ensure consistency
    const sheetName = CONFIG.SHEET_NAME;
    console.log('Looking for sheet:', sheetName);
    let sheet = spreadsheet.getSheetByName(sheetName);
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      console.log('Creating new sheet:', sheetName);
      sheet = spreadsheet.insertSheet(sheetName);
      addHeaders(sheet);
    }
    
    // Check if sheet has headers, add them if missing
    if (sheet.getLastRow() === 0) {
      console.log('Adding headers to empty sheet');
      addHeaders(sheet);
    }
    
    // Add a separator row for bulk export
    const separatorRow = ['--- BULK EXPORT ---', new Date().toLocaleString('en-US', {timeZone: CONFIG.TIMEZONE})];
    console.log('Adding separator row');
    sheet.appendRow(separatorRow);
    
    // Add all customer data
    console.log('Formatting and appending customer data');
    const allData = customers.map(customer => formatCustomerData(customer));
    if (allData.length > 0) {
      // Append each row to the sheet (allows duplicates as requested)
      allData.forEach((rowData, index) => {
        console.log(`Appending customer ${index + 1} of ${allData.length}`);
        sheet.appendRow(rowData);
      });
    }
    
    // Auto-resize columns
    sheet.autoResizeColumns(1, allData[0]?.length || 20);
    
    console.log('Bulk export completed successfully');
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: `${customers.length} customers exported successfully`,
        spreadsheetUrl: spreadsheet.getUrl(),
        sheetName: sheetName,
        rowsAdded: customers.length,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.error('Error in handleBulkExport:', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Add headers to the sheet
 */
function addHeaders(sheet) {
  const headers = [
    'Export Date',
    'Customer Name',
    'Contact Number',
    'Email',
    'Age',
    'Address',
    'Occupation',
    'Distribution Method',
    'Sales Agent',
    'Doctor Assigned',
    'OD (Right Eye)',
    'OS (Left Eye)',
    'OU (Both Eyes)',
    'PD (Pupillary Distance)',
    'ADD (Addition)',
    'Grade Type',
    'Lens Type',
    'Frame Code',
    'Payment Method',
    'Payment Amount',
    'OR Number',
    'Priority Flags',
    'Remarks',
    'Queue Status',
    'Token Number',
    'Estimated Time (min)',
    'Registration Date'
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format headers
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('white');
  headerRange.setWrap(true);
}

/**
 * Format customer data for export
 */
function formatCustomerData(customer) {
  try {
    console.log('Formatting customer data:', customer?.name || 'Unknown');
    
    // Handle priority flags safely
    const priorityFlags = [];
    if (customer.priority_flags) {
      if (customer.priority_flags.senior_citizen) priorityFlags.push('Senior Citizen');
      if (customer.priority_flags.pregnant) priorityFlags.push('Pregnant');
      if (customer.priority_flags.pwd) priorityFlags.push('PWD');
    }
    
    // Handle payment info safely
    let paymentMode = '';
    let paymentAmount = '';
    if (customer.payment_info) {
      paymentMode = getPaymentModeLabel(customer.payment_info.mode || '');
      paymentAmount = customer.payment_info.amount ? `₱${customer.payment_info.amount}` : '';
    }
    
    // Handle prescription safely
    let prescriptionOD = '';
    let prescriptionOS = '';
    let prescriptionOU = '';
    let prescriptionPD = '';
    let prescriptionADD = '';
    if (customer.prescription) {
      prescriptionOD = customer.prescription.od || '';
      prescriptionOS = customer.prescription.os || '';
      prescriptionOU = customer.prescription.ou || '';
      prescriptionPD = customer.prescription.pd || '';
      prescriptionADD = customer.prescription.add || '';
    }
    
    // Handle created_at date safely
    let registrationDate = '';
    if (customer.created_at) {
      try {
        registrationDate = new Date(customer.created_at).toLocaleString('en-US', {timeZone: CONFIG.TIMEZONE});
      } catch (dateError) {
        console.warn('Could not parse created_at date:', customer.created_at);
        registrationDate = customer.created_at.toString();
      }
    }
    
    const formattedData = [
      new Date().toLocaleString('en-US', {timeZone: CONFIG.TIMEZONE}), // Export Date
      customer.name || '',
      customer.contact_number || '',
      customer.email || '',
      customer.age || '',
      customer.address || '',
      customer.occupation || '',
      customer.distribution_info || '',
      customer.sales_agent_name || '',
      customer.doctor_assigned || '',
      prescriptionOD,
      prescriptionOS,
      prescriptionOU,
      prescriptionPD,
      prescriptionADD,
      customer.grade_type || '',
      customer.lens_type || '',
      customer.frame_code || '',
      paymentMode,
      paymentAmount,
      customer.or_number || '',
      priorityFlags.join(', '),
      customer.remarks || '',
      customer.queue_status || '',
      customer.token_number || '',
      customer.estimated_time || '',
      registrationDate
    ];
    
    console.log('Formatted data length:', formattedData.length);
    return formattedData;
    
  } catch (error) {
    console.error('Error in formatCustomerData:', error);
    // Return a basic row with error info
    return [
      new Date().toLocaleString('en-US', {timeZone: CONFIG.TIMEZONE}),
      'ERROR',
      'Error formatting customer data',
      error.toString()
    ];
  }
}

/**
 * Helper function to format payment mode labels
 */
function getPaymentModeLabel(mode) {
  const labels = {
    'gcash': 'GCash',
    'maya': 'Maya',
    'bank_transfer': 'Bank Transfer',
    'credit_card': 'Credit Card',
    'cash': 'Cash'
  };
  return labels[mode] || mode;
}

/**
 * Test function - can be used to test the script
 */
function testExport() {
  const sampleCustomer = {
    or_number: 'TEST001',
    name: 'John Doe',
    contact_number: '09123456789',
    email: 'john@example.com',
    age: 30,
    address: 'Sample Address',
    occupation: 'Engineer',
    distribution_info: 'pickup',
    sales_agent_name: 'Agent 1',
    doctor_assigned: 'Dr. Smith',
    prescription: {
      od: '+1.00',
      os: '+1.25',
      ou: '+1.00',
      pd: '62',
      add: '+2.00'
    },
    grade_type: 'Grade A',
    lens_type: 'Progressive',
    frame_code: 'FR001',
    payment_info: {
      mode: 'cash',
      amount: 5000
    },
    priority_flags: {
      senior_citizen: false,
      pregnant: false,
      pwd: false
    },
    remarks: 'Test customer',
    queue_status: 'completed',
    token_number: 1,
    estimated_time: 30,
    created_at: new Date().toISOString()
  };
  
  return handleSingleExport(sampleCustomer);
}

/**
 * Test function specifically for debugging single export
 */
function testSingleExportDebug() {
  console.log('=== TESTING SINGLE EXPORT ===');
  
  // Test with minimal data
  const minimalCustomer = {
    or_number: 'TEST-MINIMAL',
    name: 'Test Customer',
    contact_number: '1234567890',
    email: 'test@example.com',
    age: 25,
    address: 'Test Address',
    occupation: 'Tester',
    distribution_info: 'pickup',
    sales_agent_name: 'Test Agent',
    doctor_assigned: 'Dr. Test',
    prescription: {
      od: '+1.00',
      os: '+1.00',
      ou: '+1.00',
      pd: '60',
      add: '+2.00'
    },
    grade_type: 'Standard',
    lens_type: 'Single Vision',
    frame_code: 'TEST001',
    payment_info: {
      mode: 'cash',
      amount: 1000
    },
    priority_flags: {
      senior_citizen: false,
      pregnant: false,
      pwd: false
    },
    remarks: 'Test export',
    queue_status: 'waiting',
    token_number: 999,
    estimated_time: 15,
    created_at: new Date().toISOString()
  };
  
  console.log('Testing with minimal customer data:', JSON.stringify(minimalCustomer, null, 2));
  
  const result = handleSingleExport(minimalCustomer);
  console.log('Test result:', result);
  
  return result;
}
