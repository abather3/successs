# Queue Status Backward-Compatibility Matrix

## Current Queue Status Analysis

### 1. Database Schema References

| Component | File | Status Values | Change Required |
|-----------|------|---------------|----------------|
| **customers table** | `database/schema.sql` | `waiting`, `serving`, `completed`, `cancelled` | Add DEFAULT 'waiting' for unknown values |
| **Performance Indexes** | `database/performance-indexes.sql` | Indexed on queue_status | No change needed |

### 2. TypeScript Type Definitions

| Component | File | Status Values | Change Required |
|-----------|------|---------------|----------------|
| **Backend Types** | `backend/src/types/index.ts` | `QueueStatus` enum | Add fallback handling |
| **Frontend Types** | `frontend/src/types/index.ts` | `QueueStatus` enum | Add fallback handling |

### 3. Backend Services & APIs

| Component | File | Status Usage | Change Required |
|-----------|------|--------------|----------------|
| **QueueService** | `backend/src/services/queue.ts` | Status filtering, transitions | Add unknown status handling |
| **Queue Routes** | `backend/src/routes/queue.ts` | API responses, filtering | Add status validation |
| **Customer Service** | `backend/src/services/customer.ts` | Status updates | Add fallback logic |
| **WebSocket Service** | `backend/src/services/websocket.ts` | Real-time updates | Add status validation |

### 4. WebSocket Event Payloads

| Event Type | Payload Fields | Change Required |
|------------|---------------|----------------|
| `queue:update` | `queue_status` field | Validate and fallback |
| `customer_called` | Customer object with status | Add validation |
| `customer_completed` | Customer object with status | Add validation |
| `customer_cancelled` | Customer object with status | Add validation |

### 5. Frontend Components

| Component | File | Status Usage | Change Required |
|-----------|------|--------------|----------------|
| **QueueManagement** | `frontend/src/components/queue/QueueManagement.tsx` | Status filtering, actions | Add unknown status handling |
| **DisplayMonitor** | `frontend/src/components/display/DisplayMonitor.tsx` | Status display, filtering | Add fallback display |
| **StandaloneDisplayMonitor** | `frontend/src/components/display/StandaloneDisplayMonitor.tsx` | Status display | Add fallback display |

### 6. Analytics & Metrics

| Component | File | Status Usage | Change Required |
|-----------|------|--------------|----------------|
| **QueueAnalyticsService** | `backend/src/services/QueueAnalyticsService.ts` | Event tracking by status | Add unknown status logging |
| **Export Service** | `backend/src/services/export.ts` | Status in exports | Add status normalization |

## Backward Compatibility Strategy

### Legacy Fallback Behavior
- **Unknown Status → 'waiting'**: Any unrecognized queue status will be treated as 'waiting'
- **Database Constraints**: Modified to allow graceful degradation
- **API Responses**: Include status validation with fallback
- **WebSocket Events**: Validate status before emission
- **Frontend Display**: Show unknown statuses as 'waiting' with warning indicator

### Implementation Phases

#### Phase 1: Database & Backend Core
1. Update database constraints with fallback logic
2. Add status validation utilities
3. Modify QueueService for unknown status handling
4. Update WebSocket service validation

#### Phase 2: API Layer
1. Add status validation middleware
2. Update queue routes with fallback logic
3. Modify customer service status handling

#### Phase 3: Frontend Components
1. Add unknown status handling in components
2. Update status display logic
3. Add warning indicators for fallback statuses

#### Phase 4: Testing & Validation
1. Test with unknown status values
2. Validate WebSocket events
3. Test frontend fallback behavior
4. Performance impact assessment

## Migration Strategy

### For Existing Data
- Run validation query to identify any non-standard statuses
- Apply fallback logic during data reads
- Log instances of unknown statuses for monitoring

### For New Features
- All new status additions must be backward compatible
- Include migration scripts for status changes
- Maintain deprecated status support for transition period

## Monitoring & Alerting

### Metrics to Track
- Instances of unknown status fallback usage
- WebSocket events with invalid statuses
- Frontend fallback displays

### Alerts
- High volume of unknown status fallbacks
- Database constraint violations
- WebSocket validation failures
