# PDF Export IDM Interception Fix

## Issue Description
When exporting customers to PDF (both single and bulk), the Internet Download Manager (IDM) was intercepting the downloads instead of allowing the browser to handle them directly like Excel exports do.

## Root Cause Analysis
The issue was due to missing and inconsistent HTTP response headers between Excel and PDF exports:

### Excel Export Headers (Working correctly):
```typescript
res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
res.setHeader('Content-Disposition', 'attachment; filename=customer-123.xlsx');
res.setHeader('Content-Length', buffer.length.toString()); // ✅ Present
```

### PDF Export Headers (Before fix):
```typescript
res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', 'attachment; filename=customer-123.pdf');
// ❌ Missing Content-Length header
```

**The missing `Content-Length` header was causing download managers like IDM to intercept PDF downloads because they couldn't determine the file size properly.**

## Solution Applied

### 1. Added Missing Content-Length Header
Fixed both single and bulk PDF export routes by adding the `Content-Length` header:

**Single Customer PDF Export** (`/:id/export/pdf`):
```typescript
res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', `attachment; filename=customer-${id}.pdf`);
res.setHeader('Content-Length', buffer.length.toString()); // ✅ Added
```

**Bulk Customer PDF Export** (`/export/pdf`):
```typescript
res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', 'attachment; filename=customers.pdf');
res.setHeader('Content-Length', buffer.length.toString()); // ✅ Added
```

### 2. Added Cache Control Headers
To further prevent download manager interception and improve browser compatibility:

```typescript
res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
res.setHeader('Pragma', 'no-cache');
res.setHeader('Expires', '0');
```

These headers tell the browser and any intermediate download managers that the file should not be cached and should be handled immediately.

## Files Modified

1. **`backend/src/routes/customers.ts`**:
   - Line ~424: Single customer PDF export headers
   - Line ~349: Bulk customer PDF export headers

## Expected Result

After applying these fixes, PDF exports should now behave the same as Excel exports:

- ✅ **Browser Download**: PDFs will download directly through the browser
- ✅ **No IDM Interception**: Download managers should no longer interfere
- ✅ **Consistent Behavior**: Both single and bulk PDF exports work the same way
- ✅ **Proper Headers**: All required HTTP headers are now present and correct

## Testing Instructions

1. **Single Customer PDF Export**:
   - Go to Customer Management
   - Click the actions menu (⋮) on any customer
   - Select "Export to PDF"
   - File should download directly in browser (not IDM)

2. **Bulk Customer PDF Export**:
   - Go to Customer Management
   - Click "Export" button at the top
   - Select "Export to PDF"
   - File should download directly in browser (not IDM)

3. **Verify Headers** (Optional):
   - Open browser Developer Tools → Network tab
   - Perform PDF export
   - Check the response headers include:
     - `Content-Type: application/pdf`
     - `Content-Disposition: attachment; filename=...`
     - `Content-Length: [size]`
     - `Cache-Control: no-cache, no-store, must-revalidate`

## Troubleshooting

If PDFs are still being intercepted by IDM:

1. **Clear Browser Cache**: Clear browser cache and cookies
2. **Check IDM Settings**: Temporarily disable IDM to test
3. **Use Incognito Mode**: Test in private/incognito browser window
4. **Check Network Tab**: Verify the headers are being sent correctly
5. **Backend Logs**: Check Docker logs for any export errors

## Technical Notes

- The fix maintains backward compatibility
- No changes needed on the frontend
- Excel exports continue to work unchanged
- Google Sheets exports are unaffected
- The solution follows HTTP standards for file downloads

## Success Indicators

✅ PDF downloads happen in browser  
✅ No IDM popup/interception  
✅ Files save to browser's default download location  
✅ Download behavior matches Excel exports  
✅ Both single and bulk exports work consistently  

The fix ensures that PDF exports behave identically to Excel exports, providing a consistent user experience across all export formats.

---

## Additional Fix: Google Sheets Export Timeout Issue

During testing, it was discovered that Google Sheets exports were failing with "Request timeout" errors.

### Google Sheets Issue
- **Problem**: Axios requests to Google Apps Script were timing out
- **Symptoms**: "Request timeout" and "Fetch failed loading" errors in console
- **Root Cause**: Default axios timeout was too short for Google Apps Script processing

### Google Sheets Solution
Added explicit timeout configuration to both single and bulk Google Sheets export requests:

**Single Customer Export**:
```typescript
const response = await axios.post(GOOGLE_SHEETS_URL, {
    action: 'single',
    customer: customer
}, {
    timeout: 30000, // 30 seconds timeout
    headers: {
        'Content-Type': 'application/json'
    }
});
```

**Bulk Customer Export**:
```typescript
const response = await axios.post(GOOGLE_SHEETS_URL, {
    action: 'bulk',
    customers: customers
}, {
    timeout: 60000, // 60 seconds timeout for bulk operations
    headers: {
        'Content-Type': 'application/json'
    }
});
```

This provides sufficient time for Google Apps Script to process the requests and prevents timeout errors.
