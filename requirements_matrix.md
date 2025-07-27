# EscaShop Optical Queue Management System - Requirements Matrix

## 1. User Roles & Permissions

| Role | Access Level | Key Permissions | Module Access |
|------|-------------|-----------------|---------------|
| **Admin** | Full System Access | • Complete system configuration<br>• User management (create/edit/deactivate)<br>• Financial reports access<br>• Activity log (read-only)<br>• Queue management & manual override<br>• SMS template management<br>• Counter & dropdown management<br>• Export to all formats (Excel, PDF, Google Sheets) | All modules |
| **Sales Employee** | Limited Access | • Customer registration<br>• Prescription management<br>• Own performance data only<br>• Queue management (view only)<br>• Token printing<br>• Customer notifications (SMS)<br>• Export customer data | Dashboard, Customer Management, Queue (view), Display Monitor |
| **Cashier** | Transaction Focus | • Payment processing<br>• Daily financial reports<br>• Transaction logs (read-only)<br>• Counter management<br>• Customer serving/calling<br>• Daily reconciliation | Dashboard, Transactions, Queue (serve customers), Display Monitor |

## 2. Major Modules/Services

### 2.1 Frontend Modules (React/TypeScript)

| Module | Path | Purpose | Key Components |
|--------|------|---------|----------------|
| **Authentication** | `/auth` | User login/logout, password reset | Login, ForgotPassword, ResetPassword |
| **Dashboard** | `/` | Role-based overview, metrics | Dashboard (role-specific views) |
| **Customer Management** | `/customers` | Registration, editing, search | CustomerManagement (form + table) |
| **Queue Management** | `/queue` | Real-time queue display & control | QueueManagement (drag-drop, priorities) |
| **Transaction Management** | `/transactions` | Payment processing, reports | EnhancedTransactionManagement |
| **Admin Panel** | `/admin` | System configuration (Admin only) | AdminPanel, UserManagement, CounterManagement, DropdownManagement |
| **Display Monitor** | `/display` | Customer-facing queue display | DisplayMonitor, StandaloneDisplayMonitor |
| **SMS Management** | Integrated | SMS templates, notifications | EnhancedSMSManagement |
| **Analytics** | `/analytics` | Queue analytics, performance metrics | QueueAnalyticsDashboard |

### 2.2 Backend Services (Node.js/TypeScript)

| Service | File | Purpose | Key Functions |
|---------|------|---------|---------------|
| **Authentication Service** | `routes/auth.ts` | JWT-based auth, password management | login, refresh, register, changePassword |
| **User Service** | `services/user.ts` | User CRUD, role management | create, findById, validatePassword, updateStatus |
| **Customer Service** | `services/customer.ts` | Customer lifecycle management | create, update, list, updateStatus |
| **Queue Service** | `routes/queue.ts` | Real-time queue operations | getQueue, updateQueue, prioritizeCustomer |
| **Transaction Service** | `services/transaction.ts` | Payment processing, reporting | createTransaction, getDailyReport |
| **SMS Service** | `services/EnhancedSMSService.ts` | Multi-provider SMS integration | sendQueueUpdate, sendReadyNotification |
| **WebSocket Service** | `services/websocket.ts` | Real-time updates | queue updates, payment notifications |
| **Export Service** | `services/export.ts` | Data export (Excel, PDF, Google Sheets) | exportToExcel, exportToPDF, exportToSheets |
| **Activity Service** | `services/activity.ts` | Audit logging | log, getActivityLogs |
| **Analytics Service** | `services/QueueAnalyticsService.ts` | Queue metrics, reporting | getDailyStats, getHourlyMetrics |

## 3. Database Tables & Key Fields

### 3.1 User Management Tables

| Table | Key Fields | Purpose |
|-------|------------|---------|
| **users** | `id`, `email`, `full_name`, `password_hash`, `role`, `status`, `reset_token`, `reset_token_expiry` | User authentication & authorization |

### 3.2 Customer & Queue Tables

| Table | Key Fields | Purpose |
|-------|------------|---------|
| **customers** | `id`, `or_number`, `name`, `contact_number`, `email`, `age`, `address`, `sales_agent_id`, `prescription` (JSONB), `grade_type`, `lens_type`, `frame_code`, `estimated_time`, `payment_info` (JSONB), `priority_flags` (JSONB), `queue_status`, `token_number`, `priority_score` | Customer registration & queue management |
| **counters** | `id`, `name`, `display_order`, `is_active`, `current_customer_id` | Service counter configuration |
| **queue_events** | `id`, `customer_id`, `event_type`, `counter_id`, `queue_position`, `wait_time_minutes`, `service_time_minutes`, `is_priority` | Queue event tracking |
| **queue_analytics** | `id`, `date`, `hour`, `total_customers`, `priority_customers`, `avg_wait_time_minutes`, `peak_queue_length` | Hourly queue metrics |
| **daily_queue_summary** | `id`, `date`, `total_customers`, `avg_wait_time_minutes`, `peak_hour`, `customers_served` | Daily queue aggregations |

### 3.3 Configuration Tables

| Table | Key Fields | Purpose |
|-------|------------|---------|
| **grade_types** | `id`, `name`, `description` | Prescription grade options |
| **lens_types** | `id`, `name`, `description` | Lens type options |
| **dropdown_options** | `id`, `category`, `value`, `display_text`, `is_active`, `sort_order` | Dynamic dropdown management |

### 3.4 Transaction & Reporting Tables

| Table | Key Fields | Purpose |
|-------|------------|---------|
| **transactions** | `id`, `customer_id`, `or_number`, `amount`, `payment_mode`, `sales_agent_id`, `cashier_id`, `transaction_date` | Payment processing |
| **daily_reports** | `id`, `date`, `total_cash`, `total_gcash`, `total_maya`, `total_credit_card`, `total_bank_transfer`, `petty_cash_start`, `petty_cash_end`, `expenses` (JSONB), `cash_turnover` | Daily financial reporting |

### 3.5 Communication & Audit Tables

| Table | Key Fields | Purpose |
|-------|------------|---------|
| **sms_templates** | `id`, `name`, `template`, `variables` (JSONB), `is_active` | SMS message templates |
| **sms_notifications** | `id`, `customer_id`, `phone_number`, `message`, `notification_type`, `status`, `queue_position`, `estimated_wait_minutes`, `sent_at`, `delivered_at` | SMS tracking & analytics |
| **notification_logs** | `id`, `customer_id`, `message`, `status`, `delivery_status`, `sent_at` | Legacy SMS logging |
| **activity_logs** | `id`, `user_id`, `action`, `details` (JSONB), `ip_address`, `user_agent` | System audit trail (immutable) |

## 4. External Integrations

### 4.1 SMS Integration

| Provider | Configuration | Purpose | Implementation |
|----------|---------------|---------|----------------|
| **Twilio** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | SMS notifications (US/Global) | `EnhancedSMSService.sendTwilioSMS()` |
| **Clicksend** | `CLICKSEND_USERNAME`, `CLICKSEND_API_KEY` | SMS notifications (Philippines-friendly) | `EnhancedSMSService.sendClicksendSMS()` |
| **Vonage** | `VONAGE_API_KEY`, `VONAGE_API_SECRET` | SMS notifications (formerly Nexmo) | `EnhancedSMSService.sendVonageSMS()` |
| **Generic API** | `SMS_API_URL`, `SMS_API_KEY` | Custom SMS provider integration | `EnhancedSMSService.sendGenericSMS()` |

**SMS Features:**
- Queue position updates
- Ready-to-serve notifications
- Delay notifications
- Pickup reminders
- Delivery notifications
- Bulk messaging
- Delivery status tracking

### 4.2 Google Sheets Integration

| Component | File | Purpose | Configuration |
|-----------|------|---------|---------------|
| **Google Apps Script** | `google-apps-script/escashop-export.js` | Server-side export handler | `SPREADSHEET_ID`, `SHEET_NAME`, `TIMEZONE` |
| **Export Service** | `services/export.ts` | Client-side export trigger | Google Apps Script Web App URL |

**Export Capabilities:**
- Single customer export
- Bulk customer export
- Real-time data synchronization
- Formatted spreadsheet output

### 4.3 WebSocket Integration

| Feature | Implementation | Purpose |
|---------|---------------|---------|
| **Real-time Queue Updates** | `setupWebSocketHandlers()` in `websocket.ts` | Live queue status, customer calls, position changes |
| **Payment Notifications** | `WebSocketService.emitPaymentStatusUpdate()` | Transaction completion alerts |
| **Authentication** | JWT-based socket authentication | Secure WebSocket connections |
| **Role-based Channels** | Room-based messaging (`role:admin`, `user:123`) | Targeted notifications |

**WebSocket Events:**
- `queue:update` - Queue status changes
- `customer:called` - Customer called to counter
- `customer:served` - Customer served
- `transaction:update` - Payment updates
- `auth:error` - Authentication errors
- `auth:expire_soon` - Token expiration warnings

### 4.4 Authentication & Security

| Component | Technology | Purpose |
|-----------|------------|---------|
| **JWT Authentication** | JSON Web Tokens | Stateless authentication with refresh tokens |
| **Password Security** | bcrypt hashing | Secure password storage |
| **Rate Limiting** | Express rate limiter | API protection (general, sensitive, burst limits) |
| **CORS Configuration** | Express CORS | Cross-origin request security |
| **Input Validation** | Express-validator | SQL injection & XSS prevention |

### 4.5 File Export Integrations

| Format | Implementation | Use Case |
|--------|---------------|----------|
| **Excel (.xlsx)** | ExcelJS library | Local file downloads, offline reporting |
| **PDF** | PDF generation library | Formatted reports, receipts |
| **Google Sheets** | Apps Script API | Real-time data sharing, collaborative access |

## 5. System Architecture Summary

### 5.1 Technology Stack
- **Frontend**: React 18 + TypeScript + Tailwind CSS + Material-UI
- **Backend**: Node.js + Express.js + TypeScript
- **Database**: PostgreSQL with JSONB fields for flexible data
- **Real-time**: Socket.IO for WebSocket communication
- **Authentication**: JWT with refresh token rotation

### 5.2 Key Design Patterns
- **Role-based Access Control (RBAC)**: Hierarchical permissions (Admin > Sales > Cashier)
- **Real-time Updates**: WebSocket-driven UI updates for queue and payments
- **Multi-tenant SMS**: Provider-agnostic SMS service with failover
- **Audit Trail**: Immutable activity logging for compliance
- **Responsive Design**: Mobile-friendly interface for all roles

### 5.3 External Dependencies
- **SMS Providers**: Twilio, Clicksend, Vonage, Generic APIs
- **Google Services**: Apps Script, Sheets API
- **Database**: PostgreSQL 12+
- **Node.js**: Version 18+
- **Browser**: Modern browsers with WebSocket support

---

*This requirements matrix serves as a comprehensive reference for understanding the EscaShop system architecture, data models, and external integrations. It will be used to inform subsequent system documentation and architectural diagrams.*
