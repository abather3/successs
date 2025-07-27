# API Contract Changes - Version 1.1

## Summary

This document outlines the API contract changes implemented for version 1.1 of the EscaShop Queue Management System API, specifically addressing the enhanced support for the "processing" status and related queue workflow improvements.

## Changes Implemented

### 1. PATCH `/api/queue/:id/status` Endpoint

**New Endpoint Added:**
- **Method:** PATCH
- **Path:** `/api/queue/:id/status`
- **Purpose:** Update queue status with enhanced workflow support
- **Body:** `{ status: 'processing' }` (and other valid statuses)

**Features:**
- Primary support for setting customers to 'processing' status
- Accepts all valid queue status transitions
- Enhanced error messages with forward compatibility notes
- Proper status transition validation

**Example Usage:**
```bash
# Set customer to processing status
curl -X PATCH http://localhost:5000/api/queue/123/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "processing"}'
```

### 2. GET `/api/queue?status=processing` Filter Support

**Enhanced Endpoint:**
- **Method:** GET  
- **Path:** `/api/queue`
- **New Feature:** Added `status` query parameter for filtering

**Filter Examples:**
```bash
# Get all customers in processing status
GET /api/queue?status=processing

# Get all waiting customers  
GET /api/queue?status=waiting

# Get all customers (no filter)
GET /api/queue
```

**Implementation Details:**
- Uses parameterized queries for security
- Supports all valid queue statuses
- Backward compatible (no filter = all customers)

### 3. OpenAPI Schema Updates (v1.1)

**Version Information:**
- API version bumped to `1.1`
- Added comprehensive documentation for new features
- Included forward compatibility guidance

**Schema Enhancements:**
- `QueueStatus` enum explicitly includes `"processing"`
- Added deprecation notes for forward compatibility
- Enhanced endpoint documentation with examples
- Added status transition flow documentation

**Forward Compatibility Note:**
```yaml
description: |
  Clients should gracefully handle and ignore any unknown status values 
  that may be added in future API versions.
```

### 4. Deprecation Note Implementation

**Added to all status-related responses:**
```json
{
  "error": "Invalid status...",
  "note": "Clients should ignore unknown future statuses for forward compatibility"
}
```

**Legacy Endpoint Deprecation:**
- Marked `POST /api/queue/change-status` as deprecated
- Recommends using `PATCH /api/queue/:id/status` instead
- Maintains backward compatibility

## Technical Implementation Details

### Status Transition Validation

Enhanced validation matrix implemented in `QueueService.isValidStatusTransition()`:

```
waiting → [serving, cancelled]
serving → [processing, completed, cancelled]  
processing → [completed, cancelled]
completed → [] (terminal)
cancelled → [] (terminal)
```

### Database Query Optimizations

**QueueService.getQueue() Enhancements:**
- Added parameterized status filtering
- Maintains security with prepared statements
- Backward compatible default behavior

### Error Handling Improvements

**Enhanced Error Responses:**
- Detailed status transition error messages
- Forward compatibility guidance in error responses
- Consistent error format across all endpoints

## Backward Compatibility

### Maintained Compatibility
✅ All existing endpoints continue to work  
✅ No breaking changes to existing request/response formats  
✅ Legacy `POST /api/queue/change-status` still functional  
✅ Default behavior of `GET /api/queue` unchanged  

### Soft Deprecations
⚠️ `POST /api/queue/change-status` marked deprecated in OpenAPI  
⚠️ Forward compatibility notes added for unknown statuses  

## Forward Compatibility Strategy

### Client Implementation Guidance

**Status Handling:**
```javascript
// Recommended client-side status handling
function handleQueueStatus(status) {
  const knownStatuses = ['waiting', 'serving', 'processing', 'completed', 'cancelled'];
  
  if (knownStatuses.includes(status)) {
    return processKnownStatus(status);
  } else {
    // Gracefully handle unknown future statuses
    console.warn(`Unknown queue status: ${status}`);
    return handleUnknownStatus(status);
  }
}
```

**API Error Handling:**
```javascript
// Handle API responses with forward compatibility
fetch('/api/queue/123/status', {
  method: 'PATCH',
  body: JSON.stringify({ status: 'processing' })
})
.then(response => response.json())
.then(data => {
  if (data.note) {
    console.info('API Note:', data.note); // Forward compatibility guidance
  }
  return data;
});
```

## Testing and Validation

### Test Scenarios Covered

1. **PATCH Endpoint Tests:**
   - ✅ Valid status transitions
   - ✅ Invalid status transitions  
   - ✅ Non-existent customer IDs
   - ✅ Authentication requirements

2. **GET Filtering Tests:**
   - ✅ Status filter functionality
   - ✅ Invalid status filter handling
   - ✅ No filter (default behavior)
   - ✅ Empty result sets

3. **OpenAPI Compliance:**
   - ✅ Schema validation
   - ✅ Response format compliance
   - ✅ Documentation accuracy

### Example Test Commands

```bash
# Test PATCH endpoint
curl -X PATCH http://localhost:5000/api/queue/1/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "processing"}'

# Test GET filtering  
curl -X GET "http://localhost:5000/api/queue?status=processing" \
  -H "Authorization: Bearer <token>"

# Test invalid transition
curl -X PATCH http://localhost:5000/api/queue/1/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}' # Should fail if customer is in 'waiting' status
```

## Migration Guide

### For API Consumers

**Immediate Actions Required:**
- None (all changes are backward compatible)

**Recommended Upgrades:**
1. Switch to using `PATCH /api/queue/:id/status` for status updates
2. Implement forward compatibility status handling
3. Update to use status filtering where beneficial

**Timeline:**
- **Now:** New v1.1 features available
- **6 months:** Legacy `POST /api/queue/change-status` will show deprecation warnings
- **12 months:** Legacy endpoint may be removed (with advance notice)

### For Frontend Applications

**Status Display Updates:**
```javascript
// Add processing status to UI components
const statusColors = {
  waiting: '#fbbf24',
  serving: '#3b82f6', 
  processing: '#f59e0b', // New in v1.1
  completed: '#10b981',
  cancelled: '#ef4444'
};
```

## Security Considerations

### Enhancements Made
- ✅ Parameterized queries prevent SQL injection
- ✅ Maintained authentication requirements
- ✅ Input validation for all new parameters
- ✅ Error messages don't expose sensitive information

### No Security Regression
- All existing security measures maintained
- No new attack vectors introduced
- Authentication and authorization unchanged

## Monitoring and Observability

### New Metrics Available
- `patch_queue_status` activity logging
- Status filter usage analytics
- Processing status transition tracking
- Forward compatibility warning counts

### Log Examples
```
Queue route accessed with status filter: processing
Queue data fetched: 5 items with status filter: processing
Status updated via PATCH: customer_id=123, status=processing
```

## Conclusion

The v1.1 API contract changes successfully implement all requested enhancements while maintaining full backward compatibility. The implementation includes:

- ✅ PATCH endpoint for status updates accepting `{ status: 'processing' }`
- ✅ GET endpoint status filtering support (`?status=processing`)  
- ✅ Version 1.1 response schema with "processing" in OpenAPI enum
- ✅ Deprecation notes about ignoring unknown future statuses
- ✅ Forward compatibility design for future enhancements

All changes are production-ready and include comprehensive documentation, testing, and monitoring capabilities.
