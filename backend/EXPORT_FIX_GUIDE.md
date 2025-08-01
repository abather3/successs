# Export Functionality Fix Guide

## ✅ Completed Fixes

### 1. Google Apps Script Configuration
- Fixed the hardcoded spreadsheet ID in the Google Apps Script
- Updated `CONFIG.SPREADSHEET_ID` from `'YOUR_SPREADSHEET_ID_HERE'` to the actual ID `'1EQoJp1fjxMJc3L54JA5hKWHkm-K36vg81YyPv4cCIBE'`

### 2. Backend Improvements
- Enhanced error handling and logging in ExportService
- Added comprehensive error handling in customer routes
- Improved response validation and content-type checking
- Added detailed console logging for debugging

### 3. Frontend Improvements
- Created robust error handling for export functions
- Added content-type checking to distinguish between JSON errors and binary files
- Improved error messages and user feedback
- Created reusable ExportHelper utility class

### 4. Testing
- Created comprehensive test script that validates all export functions
- Backend tests show Excel and PDF exports are working correctly
- Tests confirm: ✅ Excel (7233 bytes), ✅ PDF (6860 bytes), ✅ Bulk Excel (11945 bytes)

## 🔧 Required Actions

### Step 1: Update Google Apps Script
You need to update your Google Apps Script with the fixed configuration:

1. Go to https://script.google.com/
2. Open your "EscaShop Customer Export" project
3. Replace the current code with the updated version from `google-apps-script/escashop-export.js`
4. **Important**: The key change is line 21:
   ```javascript
   SPREADSHEET_ID: '1EQoJp1fjxMJc3L54JA5hKWHkm-K36vg81YyPv4cCIBE'
   ```
5. Save and redeploy the script as a web app

### Step 2: Use the New Export Helper (Frontend)
Replace the existing export functions in `CustomerManagement.tsx` with the new ExportHelper:

```typescript
import { ExportHelper } from '../../utils/exportHelper';

// Replace existing handleExportCustomerFormat function with:
const handleExportCustomerFormat = async (customer: Customer, format: 'excel' | 'pdf' | 'sheets') => {
  let result;
  
  switch (format) {
    case 'excel':
      result = await ExportHelper.exportCustomerToExcel(customer.id);
      break;
    case 'pdf':
      result = await ExportHelper.exportCustomerToPDF(customer.id);
      break;
    case 'sheets':
      result = await ExportHelper.exportCustomerToSheets(customer.id);
      break;
  }
  
  if (result.success) {
    setSuccessMessage(result.message!);
  } else {
    setErrorMessage(result.error!);
  }
  
  handleMenuClose();
};

// Replace existing handleBulkExport function with:
const handleBulkExport = async (format: 'excel' | 'pdf' | 'sheets') => {
  const filters = { searchTerm, statusFilter, dateFilter };
  let result;
  
  switch (format) {
    case 'excel':
      result = await ExportHelper.exportCustomersToExcel(filters);
      break;
    case 'pdf':
      result = await ExportHelper.exportCustomersToPDF(filters);
      break;
    case 'sheets':
      result = await ExportHelper.exportCustomersToSheets(filters);
      break;
  }
  
  if (result.success) {
    setSuccessMessage(result.message!);
  } else {
    setErrorMessage(result.error!);
  }
};
```

## 🧪 Testing the Fix

### Backend Testing
Run the test script to verify backend functionality:
```bash
cd backend
npx ts-node src/scripts/test-export.ts
```

### Frontend Testing
1. Try exporting a single customer to Excel/PDF (should download files)
2. Try exporting to Google Sheets (should show success message after updating the script)
3. Try bulk exports with filters
4. Check browser developer console for detailed error logs

## 🔍 Troubleshooting

### If Excel/PDF exports still fail:
1. Check browser developer console for detailed error messages
2. Check backend logs for `[ExportService]` and `[CustomersRoute]` messages
3. Verify customer data exists by running the test script

### If Google Sheets export fails:
1. Verify the Google Apps Script is updated with the correct spreadsheet ID
2. Ensure the script is deployed as a web app with "Anyone" access
3. Check that the GOOGLE_SHEETS_URL in .env matches your web app URL
4. Test the Google Apps Script directly by calling the web app URL

### Common Issues:
- **"Customer not found"**: The customer ID doesn't exist in the database
- **Authentication errors**: Token might be expired or invalid
- **"Invalid response format"**: Backend is returning JSON instead of binary data
- **"Network error"**: Check if backend server is running on correct port

## 📊 Export Format Details

### Excel Export
- Format: `.xlsx`
- Contains: Customer details, prescription, payment info, priority flags
- Headers: Styled with blue background
- Auto-resized columns

### PDF Export
- Format: `.pdf`
- Layout: Professional document with sections
- Contains: All customer information in readable format
- Multi-page support for long content

### Google Sheets Export
- Target: Configured Google Spreadsheet
- Creates headers if missing
- Appends customer data as new rows
- Includes export timestamp

## 🎯 Expected Results

After implementing these fixes:
- ✅ Excel exports should download properly formatted .xlsx files
- ✅ PDF exports should download properly formatted .pdf files  
- ✅ Google Sheets exports should show success message and append data to spreadsheet
- ✅ Error messages should be clear and helpful
- ✅ All exports should work for both single customers and bulk exports with filters

The backend tests confirm that the core export functionality is working correctly. Once you update the Google Apps Script and implement the frontend changes, all export features should work seamlessly.
