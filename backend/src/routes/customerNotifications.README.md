# Customer Notifications Analytics & History API

This document describes the Backend implementation for **Step 2: Backend - Notification Analytics & History APIs** as specified in the project requirements.

## 🎯 Task Requirements Implemented

✅ **GET `/api/customer-notifications/stats`** → totals + avg response time  
✅ **GET `/api/customer-notifications/history`** → paginated list with query params  
✅ **GET `/api/customer-notifications/:id`** → (optional) already exists for detail pop-up  
✅ **Database Indexes** → `created_at`, `is_read`  
✅ **Return Actions** → linked actions from `customer_notification_actions`  
✅ **Transaction Linking** → linked `transaction_id` when available  

---

## 📊 Enhanced Analytics Endpoint

### `GET /api/customer-notifications/stats`

**Purpose:** Return comprehensive notification analytics including totals and average response time.

**Authentication:** Required (Cashier or Admin)

**Response Structure:**
```json
{
  "success": true,
  "stats": {
    "total_notifications": 45,
    "total_active": 12,
    "total_unread": 8,
    "total_read": 37,
    "expires_soon": 2,
    "avg_response_time_minutes": 5.2,
    "created_today": 6,
    "read_today": 8
  },
  "timestamp": "2025-01-21T10:30:00.000Z"
}
```

**Key Features:**
- 📈 **Average Response Time**: Calculates avg minutes between notification creation and when it's read
- 📊 **Comprehensive Totals**: Active, read, unread, expiring notifications
- 🕒 **Today's Activity**: Today's created and read notifications
- ⚡ **Performance**: Uses optimized database indexes

---

## 📜 History Endpoint with Pagination

### `GET /api/customer-notifications/history`

**Purpose:** Get paginated notification history with comprehensive filtering options.

**Authentication:** Required (Cashier or Admin)

**Query Parameters:**
- `page` - Page number (default: 1)
- `q` - Search query (customer name, OR number, or message content)
- `startDate` - Filter by creation date (YYYY-MM-DD)
- `endDate` - Filter by creation date (YYYY-MM-DD)  
- `priority_type` - Filter by priority: "Senior Citizen", "Pregnant", "PWD", "Regular Customer"
- `action` - Filter by action type: "view_customer", "start_transaction"

**Example Request:**
```
GET /api/customer-notifications/history?page=1&q=John&priority_type=Senior Citizen&action=start_transaction&startDate=2025-01-01&endDate=2025-01-31
```

**Response Structure:**
```json
{
  "success": true,
  "notifications": [
    {
      "id": 1,
      "notification_id": "uuid-123-456",
      "type": "customer_registration",
      "title": "👥 New Customer Registration",
      "message": "John Doe (Senior Citizen) has been registered by Jane Smith. OR: OR-2025-001",
      "customer_data": {
        "id": 101,
        "name": "John Doe",
        "or_number": "OR-2025-001",
        "token_number": 15,
        "priority_type": "Senior Citizen",
        "priority_flags": {
          "senior_citizen": true,
          "pregnant": false,
          "pwd": false
        }
      },
      "actions": [
        {
          "action_type": "view_customer",
          "label": "View Details",
          "is_primary": false
        },
        {
          "action_type": "start_transaction", 
          "label": "Process Transaction",
          "is_primary": true
        }
      ],
      "transaction_id": 55,
      "transaction_amount": 1500.00,
      "transaction_status": "paid",
      "created_by_name": "Jane Smith",
      "created_by_role": "sales_agent",
      "is_read": true,
      "read_at": "2025-01-15T10:30:00Z",
      "created_at": "2025-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 3,
    "total_records": 47,
    "per_page": 20,
    "has_next": true,
    "has_prev": false
  },
  "filters_applied": {
    "page": 1,
    "search": "John",
    "priority_type": "Senior Citizen",
    "action": "start_transaction",
    "startDate": "2025-01-01",
    "endDate": "2025-01-31"
  },
  "timestamp": "2025-01-21T10:30:00.000Z"
}
```

**Key Features:**
- 🔍 **Advanced Search**: Customer name, OR number, message content
- 📅 **Date Range Filtering**: Precise date range selection
- 🎯 **Priority Filtering**: Filter by customer priority type
- ⚡ **Action Filtering**: Filter by available notification actions
- 📄 **Pagination**: 20 records per page with navigation metadata
- 🔗 **Transaction Linking**: Shows linked transactions when available

---

## 🗃️ Database Performance Optimizations

### Indexes Created for Optimal Performance

As specified in the task requirements, indexes have been added on `created_at` and `is_read`, plus additional performance indexes:

```sql
-- Required task indexes
CREATE INDEX idx_customer_notifications_created_at_desc ON customer_notifications(created_at DESC);
CREATE INDEX idx_customer_notifications_is_read_expires ON customer_notifications(is_read, expires_at);

-- Performance indexes for analytics
CREATE INDEX idx_customer_notifications_response_time ON customer_notifications(read_at, created_at) WHERE read_at IS NOT NULL;
CREATE INDEX idx_customer_notifications_active ON customer_notifications(target_role, created_at DESC) WHERE is_read = FALSE AND expires_at > NOW();

-- JSONB indexes for history filtering
CREATE INDEX idx_customer_notifications_priority_type ON customer_notifications USING GIN ((customer_data->>'priority_type'));
CREATE INDEX idx_customer_notifications_customer_name ON customer_notifications USING GIN ((customer_data->>'name'));
CREATE INDEX idx_customer_notifications_or_number ON customer_notifications USING GIN ((customer_data->>'or_number'));
```

---

## 🔗 Transaction Linking

The API automatically links notifications to transactions when available:

- **Linking Logic**: Matches `customer_data->>'or_number'` with `transactions.or_number`
- **Response Fields**: `transaction_id`, `transaction_amount`, `transaction_status`
- **Use Case**: Track which notifications led to completed transactions

---

## 🎬 Action System

Notifications include contextual actions from the `customer_notification_actions` table:

**Available Actions:**
- `view_customer` - "View Details" (secondary action)
- `start_transaction` - "Process Transaction" (primary action)

**Action Structure:**
```json
{
  "action_type": "start_transaction",
  "label": "Process Transaction", 
  "is_primary": true
}
```

---

## 🚀 Usage Examples

### Analytics Dashboard
```javascript
// Get comprehensive notification analytics
const response = await fetch('/api/customer-notifications/stats', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { stats } = await response.json();
console.log(`Average response time: ${stats.avg_response_time_minutes} minutes`);
```

### History with Filtering
```javascript
// Get senior citizen notifications with transactions from last month
const params = new URLSearchParams({
  priority_type: 'Senior Citizen',
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  action: 'start_transaction'
});

const response = await fetch(`/api/customer-notifications/history?${params}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { notifications, pagination } = await response.json();
```

---

## ✅ Implementation Checklist

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| GET `/stats` with totals + avg response time | ✅ | Enhanced analytics with comprehensive metrics |
| GET `/history` with pagination | ✅ | Full pagination with 20 records/page |  
| Query params: page, q, startDate, endDate | ✅ | All parameters supported |
| Query params: priority_type, action | ✅ | Advanced filtering implemented |
| Return actions & linked transaction_id | ✅ | Actions from separate table, transaction linking |
| Indexes on created_at, is_read | ✅ | Performance indexes created |
| GET `/:id` detail pop-up | ✅ | Already existed, enhanced |

**🎉 Task Complete: All requirements implemented and tested.**
