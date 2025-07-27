# Queue Management Lifecycle - Complete Process Map

## Overview
This document maps the complete queue management lifecycle from staff initiating "Call Next" through processes P1‒P7, database updates (DS1–DS4), counter assignment, and all customer/staff notifications (Display, Audio, WebSocket, SMS). It includes both normal flow and no-show handling scenarios.

## System Architecture

### Data Stores
- **DS1 (Queue Database)**: Customer status, queue positions, timestamps
- **DS2 (Service Counter DB)**: Counter assignments, active status, current customer mappings  
- **DS3 (Customer Database)**: Customer details, phone numbers, priority flags
- **DS4 (Activity Log)**: Queue events, analytics data, audit trail

### External Systems
- **Display System**: Visual queue information monitors
- **Audio System**: Text-to-speech announcements  
- **WebSocket Clients**: Real-time web interface updates
- **SMS Provider**: Vonage API for customer notifications
- **Staff Interface**: Teller terminals and management dashboard

---

## Normal Flow: Complete Service Lifecycle

### Phase 1: Initiation (Staff → P1)
**Trigger**: Staff clicks "Call Next" button
- **API Call**: `POST /api/queue/call-next`
- **Payload**: `{counterId: number}`
- **Authentication**: Required (Cashier/Admin role)

**Process P1: Get Current Queue Status**
```sql
-- Query waiting customers with priority calculation
SELECT c.*, u.full_name as sales_agent_name,
       ROW_NUMBER() OVER (ORDER BY 
         CASE 
           WHEN c.manual_position IS NOT NULL THEN c.manual_position
           ELSE
             CASE 
               WHEN c.priority_flags::json->>'senior_citizen' = 'true' THEN 1000
               WHEN c.priority_flags::json->>'pwd' = 'true' THEN 900
               WHEN c.priority_flags::json->>'pregnant' = 'true' THEN 800
               ELSE 0
             END * 100000 + EXTRACT(EPOCH FROM c.created_at)
         END ASC
       ) as position
FROM customers c
LEFT JOIN users u ON c.sales_agent_id = u.id
WHERE c.queue_status = 'waiting'
ORDER BY position;
```

**Decision Point**:
- ✅ **Customers Available**: Continue to P2
- ❌ **No Customers**: Return "No customers in queue" to staff

### Phase 2: Selection (P1 → P2 → P3/P4)
**Process P2: Select Next Customer**
- **Priority Algorithm**: Senior (+1000), PWD (+900), Pregnant (+800)
- **Secondary Sort**: FIFO by creation timestamp
- **Customer Details**: Fetch name, phone, service history from DS3

**Parallel Processing**:
- **P3**: Update Queue Position (DS1 + DS4 updates)
- **P4**: Assign to Counter (DS2 update)

### Phase 3: Database Updates (P3/P4 → DS1/DS2/DS4)
**P3 Database Operations**:
```sql
-- Update customer status to serving
UPDATE customers 
SET queue_status = 'serving', updated_at = CURRENT_TIMESTAMP
WHERE id = $customerId;

-- Record analytics event
INSERT INTO queue_events (customer_id, event_type, counter_id, queue_position, 
                         wait_time_minutes, is_priority, created_at)
VALUES ($customerId, 'called', $counterId, $position, $waitTime, $isPriority, NOW());
```

**P4 Database Operations**:
```sql
-- Assign customer to counter
UPDATE counters 
SET current_customer_id = $customerId, updated_at = CURRENT_TIMESTAMP
WHERE id = $counterId;
```

### Phase 4: Multi-Channel Notifications (P3/P4 → P5)
**Process P5: Notify Customer**
All notifications are triggered simultaneously:

#### 4.1 Audio Announcement
```javascript
// Text-to-Speech generation
const message = `Customer ${customerName}, Token number ${tokenNumber}, 
                 please proceed to Counter ${counterName}`;
// Broadcast through audio system
audioSystem.announce(message);
```

#### 4.2 Display Update  
```javascript
// Visual display update
displaySystem.updateNowServing({
  tokenNumber: customer.token_number,
  counterName: counter.name,
  timestamp: new Date()
});
```

#### 4.3 SMS Notification
```javascript
// SMS via Vonage API
const smsTemplate = await getSMSTemplate('ready_to_serve');
const message = smsTemplate.template
  .replace('{{customer_name}}', customerName)
  .replace('{{counter_name}}', counterName)
  .replace('{{token_number}}', tokenNumber);

await vonageAPI.sendSMS({
  to: customer.phone_number,
  from: 'EscaShop',
  text: message
});
```

#### 4.4 WebSocket Broadcast
```javascript
// Real-time update to all connected clients
webSocketService.emitQueueUpdate({
  type: 'customer_called',
  customer: customerData,
  counterId: counterId,
  timestamp: new Date()
});
```

#### 4.5 Staff Confirmation
```json
// Success response to requesting staff
{
  "customer": { 
    "id": 123,
    "name": "John Doe",
    "token_number": 45,
    "queue_status": "serving"
  },
  "counter": {
    "id": 2,
    "name": "Counter B"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Phase 5: Customer Response
**Customer Actions**:
- **Arrival Confirmation**: Physical presence at counter
- **Service Request Details**: Specific requirements or clarifications

### Phase 6: Service Completion (Staff → P6)
**Trigger**: Staff clicks "Service Complete"
- **API Call**: `POST /api/queue/complete`
- **Payload**: `{customerId: number, counterId: number}`

**Process P6: Update Service Status**
```sql
-- Mark service complete
UPDATE customers 
SET queue_status = 'completed', updated_at = CURRENT_TIMESTAMP
WHERE id = $customerId;

-- Free up counter
UPDATE counters 
SET current_customer_id = NULL, updated_at = CURRENT_TIMESTAMP
WHERE id = $counterId;

-- Record completion analytics
INSERT INTO queue_events (customer_id, event_type, counter_id, 
                         service_time_minutes, is_priority)
VALUES ($customerId, 'served', $counterId, $serviceTime, $isPriority);
```

**WebSocket Update**:
```javascript
webSocketService.emitQueueUpdate({
  type: 'customer_completed',
  customer: customerData,
  counterId: counterId,
  serviceTime: serviceTimeMinutes,
  timestamp: new Date()
});
```

---

## No-Show Handling Flow

### Trigger: Customer No-Show (Staff → P7)
**Initiation**: Staff reports customer no-show
- **API Call**: `POST /api/queue/cancel`
- **Payload**: `{customerId: number, reason: string}`

**Process P7: Handle No-Show**
```sql
-- Update customer status to cancelled
UPDATE customers 
SET queue_status = 'cancelled', 
    remarks = COALESCE(remarks || ' | ', '') || 'Cancelled: ' || $reason,
    updated_at = CURRENT_TIMESTAMP
WHERE id = $customerId;

-- Free up counter immediately  
UPDATE counters 
SET current_customer_id = NULL, updated_at = CURRENT_TIMESTAMP
WHERE id = $counterId;

-- Log no-show event
INSERT INTO queue_events (customer_id, event_type, is_priority, reason)
VALUES ($customerId, 'cancelled', $isPriority, 'no_show: ' || $reason);
```

### No-Show Options
1. **Re-queue**: Option to call customer again later
2. **Manual Contact**: Staff can attempt phone call
3. **Reschedule**: Book appointment for later time
4. **Cancel Permanently**: Remove from queue entirely

**Re-queue Logic** (P7 → P1):
- Customer status reset to 'waiting'
- Maintains original priority flags
- New timestamp for queue position
- Analytics event logged as 're-queued'

---

## Analytics & Monitoring (DS4 → Analytics)

### Real-Time Metrics Tracked
```javascript
const queueMetrics = {
  // Wait time analytics
  averageWaitTime: calculateAverageWait(),
  longestWaitTime: findLongestWait(),
  
  // Service performance  
  averageServiceTime: calculateServiceTime(),
  counterUtilization: getCounterStats(),
  
  // Customer flow
  customersServed: getTodayServed(),
  noShowRate: calculateNoShowRate(),
  
  // Priority handling
  priorityCustomersServed: getPriorityStats(),
  
  // Peak analysis
  peakHours: identifyPeakTimes(),
  queueLengthTrends: getQueueTrends()
};
```

### Event Types Logged
- `joined`: Customer enters queue
- `called`: Customer called to counter  
- `served`: Service completed successfully
- `cancelled`: Customer cancelled/no-show
- `re-queued`: Customer re-added to queue

---

## Error Handling & Fallbacks

### SMS Delivery Failures
```javascript
try {
  await smsService.send(phoneNumber, message);
} catch (error) {
  // Log failure for retry
  await logNotificationFailure(customerId, 'sms', error);
  
  // Fallback options
  await showManualNotificationPrompt(staff, customer);
  await scheduleRetryAttempt(customerId, 'sms', maxRetries: 3);
}
```

### Audio System Failures  
- Fallback to manual announcement prompt
- Visual notification to staff for verbal announcement
- Alternative alert mechanisms (screen flash, popup)

### WebSocket Connection Issues
- Graceful degradation with polling fallback
- Local state management for offline scenarios  
- Automatic reconnection with state sync

### Counter Assignment Conflicts
```sql
-- Atomic counter assignment with conflict detection
BEGIN;
SELECT id FROM counters 
WHERE id = $counterId AND current_customer_id IS NULL
FOR UPDATE;

-- If counter available, assign; otherwise error
UPDATE counters 
SET current_customer_id = $customerId
WHERE id = $counterId AND current_customer_id IS NULL;

COMMIT;
```

---

## Performance Optimizations

### Database Indexing
```sql
-- Priority queue performance
CREATE INDEX idx_customers_queue_priority 
ON customers (queue_status, priority_flags, created_at) 
WHERE queue_status IN ('waiting', 'serving');

-- Analytics queries
CREATE INDEX idx_queue_events_analytics 
ON queue_events (created_at, event_type, counter_id);

-- Counter status lookups
CREATE INDEX idx_counters_active 
ON counters (is_active, current_customer_id);
```

### Caching Strategy
- **Redis Cache**: Active queue state, counter assignments
- **Memory Cache**: SMS templates, priority rules
- **CDN**: Audio files, display assets

### Real-Time Optimization
- **WebSocket Rooms**: Selective updates by user role
- **Debounced Updates**: Prevent spam from rapid changes
- **Compression**: Minimize payload sizes

---

## Security Considerations

### Authentication & Authorization
- **Staff Actions**: Require valid JWT with appropriate role
- **Customer Data**: Sanitize all phone numbers and personal info
- **API Endpoints**: Rate limiting and input validation

### Data Privacy
- **SMS Content**: No sensitive data in message templates
- **Logs**: Anonymize customer information in analytics
- **Retention**: Automatic cleanup of old queue events

### Audit Trail
- **All Actions**: Complete audit log with user, timestamp, action
- **Data Changes**: Before/after state for critical updates
- **Integration Logs**: External API calls and responses

---

## Monitoring & Alerting

### Key Performance Indicators
- Queue processing time < 30 seconds average
- SMS delivery rate > 95%
- Audio system uptime > 99%
- WebSocket connection success > 98%
- No-show rate < 10%

### Alert Thresholds
- **Critical**: Queue system down, SMS service unavailable
- **Warning**: High wait times (>45 min), counter conflicts
- **Info**: Performance degradation, unusual patterns

### Health Checks
```javascript
const healthCheck = {
  database: await checkDatabaseConnection(),
  smsProvider: await checkSMSService(),
  audioSystem: await checkAudioConnection(), 
  webSockets: await checkWebSocketHealth(),
  queues: await validateQueueIntegrity()
};
```

This comprehensive lifecycle mapping ensures reliable queue management with robust error handling, performance monitoring, and customer satisfaction optimization.
