# Role-Based Access Control (RBAC) Permissions Matrix

## Overview

This document provides a comprehensive analysis of the role-based permissions and access controls implemented in the EsyCashop application. The system supports three user roles with distinct permission levels:

- **ADMIN**: Full system access with administrative privileges
- **SALES**: Limited access focused on customer management and sales operations
- **CASHIER**: Access to transaction processing and queue management

## User Roles Definition

```typescript
enum UserRole {
  ADMIN = 'admin',
  SALES = 'sales',
  CASHIER = 'cashier'
}
```

## Authentication Middleware

### Core Authentication Functions

| Middleware Function | Description | Implementation |
|---|---|---|
| `authenticateToken` | Validates JWT token and loads user context | Required for all protected endpoints |
| `requireRole([roles])` | Generic role-based access control | Accepts array of allowed roles |
| `requireAdmin` | Admin-only access | Uses `requireRole([UserRole.ADMIN])` |
| `requireSalesOrAdmin` | Sales agent or admin access | Uses `requireRole([UserRole.SALES, UserRole.ADMIN])` |
| `requireCashierOrAdmin` | Cashier or admin access | Uses `requireRole([UserRole.CASHIER, UserRole.ADMIN])` |

### Additional Access Controls

| Middleware | Purpose | Applies To |
|---|---|---|
| `requireCustomerOwnership` | Ensures sales agents can only access their own customers | Customer-specific operations |
| `logActivity(action)` | Logs user actions for audit trail | All protected operations |

## Permissions Matrix by Endpoint

### Authentication Routes (`/api/auth`)

| Endpoint | Method | Admin | Sales | Cashier | Middleware | Notes |
|---|---|---|---|---|---|---|
| `/login` | POST | ✅ | ✅ | ✅ | None | Public endpoint |
| `/refresh` | POST | ✅ | ✅ | ✅ | None | Public endpoint |
| `/register` | POST | ✅ | ❌ | ❌ | None | Admin creates users via `/users` |
| `/change-password` | POST | ✅ | ✅ | ✅ | None | Self-service password change |
| `/request-password-reset` | POST | ✅ | ✅ | ✅ | None | Public endpoint |
| `/reset-password` | POST | ✅ | ✅ | ✅ | None | Public endpoint |
| `/verify-reset-token` | POST | ✅ | ✅ | ✅ | None | Public endpoint |
| `/logout` | POST | ✅ | ✅ | ✅ | None | Public endpoint |
| `/verify` | GET | ✅ | ✅ | ✅ | None | Token verification |

### User Management (`/api/users`)

| Endpoint | Method | Admin | Sales | Cashier | Middleware | Notes |
|---|---|---|---|---|---|---|
| `/` | POST | ✅ | ❌ | ❌ | `authenticateToken`, `requireAdmin`, `logActivity` | Create new user |
| `/` | GET | ✅ | ❌ | ❌ | `authenticateToken`, `requireAdmin`, `logActivity` | List all users |
| `/:id` | GET | ✅ | ❌ | ❌ | `authenticateToken`, `requireAdmin`, `logActivity` | Get user by ID |
| `/:id` | PUT | ✅ | ❌ | ❌ | `authenticateToken`, `requireAdmin`, `logActivity` | Update user |
| `/:id/dependencies` | GET | ✅ | ❌ | ❌ | `authenticateToken`, `requireAdmin`, `logActivity` | Check user dependencies |
| `/:id` | DELETE | ✅ | ❌ | ❌ | `authenticateToken`, `requireAdmin`, `logActivity` | Delete user |
| `/:id/reset-password` | POST | ✅ | ❌ | ❌ | `authenticateToken`, `requireAdmin`, `logActivity` | Admin password reset |

### Customer Management (`/api/customers`)

| Endpoint | Method | Admin | Sales | Cashier | Middleware | Notes |
|---|---|---|---|---|---|---|
| `/` | POST | ✅ | ✅ | ❌ | `authenticateToken`, `requireSalesOrAdmin`, `logActivity` | Create customer |
| `/` | GET | ✅ | ✅* | ✅** | `authenticateToken`, `logActivity` | List customers |
| `/:id` | GET | ✅ | ✅* | ✅ | `authenticateToken`, `requireCustomerOwnership`, `logActivity` | Get customer by ID |
| `/or/:orNumber` | GET | ✅ | ✅ | ✅ | `authenticateToken`, `logActivity` | Get customer by OR number |
| `/:id` | PUT | ✅ | ✅* | ✅ | `authenticateToken`, `requireCustomerOwnership`, `logActivity` | Update customer |
| `/:id/status` | PATCH | ✅ | ✅ | ✅ | `authenticateToken`, `logActivity` | Update customer status |
| `/:id` | DELETE | ✅ | ❌ | ❌ | `authenticateToken`, `requireAdmin`, `logActivity` | Delete customer |
| `/:id/notify` | POST | ✅ | ✅* | ❌ | `authenticateToken`, `requireSalesOrAdmin`, `requireCustomerOwnership`, `logActivity` | Send notifications |

*Sales agents can only access customers they created
**Cashiers can see all customers for transaction processing

### Transaction Management (`/api/transactions`)

| Endpoint | Method | Admin | Sales | Cashier | Middleware | Notes |
|---|---|---|---|---|---|---|
| `/` | POST | ✅ | ❌ | ✅ | `authenticateToken`, `requireCashierOrAdmin`, `logActivity` | Create transaction |
| `/` | GET | ✅ | ✅ | ✅ | `authenticateToken`, `logActivity` | List transactions |
| `/:id` | GET | ✅ | ✅ | ✅ | `authenticateToken`, `logActivity` | Get transaction by ID |
| `/:id` | DELETE | ✅ | ❌ | ❌ | `authenticateToken`, `requireAdmin`, `logActivity` | Delete transaction |
| `/:id/settlements` | POST | ✅ | ❌ | ✅ | `authenticateToken`, `requireCashierOrAdmin`, `logActivity` | Create settlement |
| `/:id/settlements` | GET | ✅ | ✅ | ✅ | `authenticateToken`, `logActivity` | Get settlements |
| `/reports/daily` | GET | ✅ | ✅ | ✅ | `authenticateToken`, `logActivity` | Daily summary |
| `/reports/monthly` | GET | ✅ | ❌ | ❌ | `authenticateToken`, `requireAdmin`, `logActivity` | Monthly report |
| `/reports/weekly` | GET | ✅ | ✅ | ✅ | `authenticateToken`, `logActivity` | Weekly report |
| `/reports/daily` | POST | ✅ | ❌ | ❌ | `authenticateToken`, `requireAdmin`, `logActivity` | Generate daily report |
| `/reports/daily/:date` | GET | ✅ | ✅ | ✅ | `authenticateToken`, `logActivity` | Get saved daily report |
| `/export` | POST | ✅ | ✅ | ✅ | `authenticateToken`, `logActivity` | Export transactions |

### Queue Management (`/api/queue`)

| Endpoint | Method | Admin | Sales | Cashier | Middleware | Notes |
|---|---|---|---|---|---|---|
| `/` | GET | ✅ | ✅ | ✅ | `authenticateToken`, `logActivity` | Get current queue |
| `/call-next` | POST | ✅ | ❌ | ✅ | `authenticateToken`, `requireCashierOrAdmin`, `logActivity` | Call next customer |
| `/call-customer` | POST | ✅ | ❌ | ✅ | `authenticateToken`, `requireCashierOrAdmin`, `logActivity` | Call specific customer |
| `/complete` | POST | ✅ | ❌ | ✅ | `authenticateToken`, `requireCashierOrAdmin`, `logActivity` | Complete service |
| `/cancel` | POST | ✅ | ❌ | ✅ | `authenticateToken`, `requireCashierOrAdmin`, `logActivity` | Cancel service |
| `/position/:customerId` | GET | ✅ | ✅ | ✅ | `authenticateToken`, `logActivity` | Get queue position |
| `/stats` | GET | ✅ | ✅ | ✅ | `authenticateToken`, `logActivity` | Queue statistics |
| `/counters` | GET | ✅ | ✅ | ✅ | `authenticateToken`, `logActivity` | List counters |
| `/counters/display` | GET | ✅ | ✅ | ✅ | `authenticateToken`, `logActivity` | Display counters |
| `/counters` | POST | ✅ | ❌ | ✅ | `authenticateToken`, `requireCashierOrAdmin`, `logActivity` | Create counter |
| `/counters/:id` | PUT | ✅ | ❌ | ✅ | `authenticateToken`, `requireCashierOrAdmin`, `logActivity` | Update counter |
| `/reorder` | PUT | ✅ | ❌ | ✅ | `authenticateToken`, `requireCashierOrAdmin`, `logActivity` | Reorder queue |
| `/reset` | POST | ✅ | ❌ | ❌ | `authenticateToken`, `logActivity` | Reset queue (explicit admin check in route) |

### Administrative Functions (`/api/admin`)

| Endpoint | Method | Admin | Sales | Cashier | Middleware | Notes |
|---|---|---|---|---|---|---|
| `/activity-logs` | GET | ✅ | ❌ | ❌ | `authenticateToken`, `requireAdmin`, `logActivity` | View activity logs |
| `/activity-logs/cleanup` | DELETE | ✅ | ❌ | ❌ | `authenticateToken`, `requireAdmin`, `logActivity` | Clean old logs |
| `/sms-templates` | GET | ✅ | ❌ | ❌ | `authenticateToken`, `requireAdmin`, `logActivity` | List SMS templates |
| `/sms-templates` | POST | ✅ | ❌ | ❌ | `authenticateToken`, `requireAdmin`, `logActivity` | Create SMS template |
| `/sms-templates/:id` | PUT | ✅ | ❌ | ❌ | `authenticateToken`, `requireAdmin`, `logActivity` | Update SMS template |
| `/notification-logs` | GET | ✅ | ❌ | ❌ | `authenticateToken`, `requireAdmin`, `logActivity` | View notification logs |
| `/initialize-templates` | POST | ✅ | ❌ | ❌ | `authenticateToken`, `requireAdmin`, `logActivity` | Initialize templates |
| `/health` | GET | ✅ | ❌ | ❌ | `authenticateToken`, `requireAdmin`, `logActivity` | System health check |
| `/grade-types` | GET/POST/PUT/DELETE | ✅ | ❌ | ❌ | `authenticateToken`, `requireAdmin`, `logActivity` | Grade type management |
| `/lens-types` | GET/POST/PUT/DELETE | ✅ | ❌ | ❌ | `authenticateToken`, `requireAdmin`, `logActivity` | Lens type management |
| `/counters` | GET/POST/PUT/DELETE | ✅ | ❌ | ❌ | `authenticateToken`, `requireAdmin`, `logActivity` | Counter management |

### Analytics (`/api/analytics`)

| Endpoint | Method | Admin | Sales | Cashier | Middleware | Notes |
|---|---|---|---|---|---|---|
| `/dashboard` | GET | ✅ | ❌ | ❌ | `authenticateToken`, `requireRole([UserRole.ADMIN])` | Analytics dashboard |
| `/hourly` | GET | ✅ | ❌ | ❌ | `authenticateToken`, `requireRole([UserRole.ADMIN])` | Hourly analytics |
| `/daily` | GET | ✅ | ❌ | ❌ | `authenticateToken`, `requireRole([UserRole.ADMIN])` | Daily summaries |
| `/update-daily-summary` | POST | ✅ | ❌ | ❌ | `authenticateToken`, `requireRole([UserRole.ADMIN])` | Update daily summary |
| `/export` | GET | ✅ | ❌ | ❌ | `authenticateToken`, `requireRole([UserRole.ADMIN])` | Export analytics |
| `/record-event` | POST | ✅ | ✅ | ✅ | `authenticateToken`, `requireRole([UserRole.ADMIN, UserRole.SALES, UserRole.CASHIER])` | Record queue event |
| `/sms-stats` | GET | ✅ | ❌ | ❌ | `authenticateToken`, `requireRole([UserRole.ADMIN])` | SMS statistics |
| `/sms-templates` | GET/PUT | ✅ | ❌ | ❌ | `authenticateToken`, `requireRole([UserRole.ADMIN])` | SMS template management |
| `/sms-notifications` | GET | ✅ | ❌ | ❌ | `authenticateToken`, `requireRole([UserRole.ADMIN])` | SMS notifications |
| `/queue-activities` | GET | ✅ | ❌ | ❌ | `authenticateToken`, `requireRole([UserRole.ADMIN])` | Queue activities |
| `/sms-notifications/customer/:id` | GET | ✅ | ✅ | ❌ | `authenticateToken`, `requireRole([UserRole.ADMIN, UserRole.SALES])` | Customer notifications |
| `/sms-notifications/retry-failed` | POST | ✅ | ❌ | ❌ | `authenticateToken`, `requireRole([UserRole.ADMIN])` | Retry failed SMS |

### SMS Management (`/api/sms`)

| Endpoint | Method | Admin | Sales | Cashier | Middleware | Notes |
|---|---|---|---|---|---|---|
| `/send` | POST | ✅ | ❌ | ✅ | `authenticateToken`, `requireCashierOrAdmin`, `logActivity` | Send SMS |
| `/stats` | GET | ✅ | ✅ | ✅ | `authenticateToken`, `logActivity` | SMS statistics |
| `/templates` | GET | ✅ | ✅ | ✅ | `authenticateToken`, `logActivity` | SMS templates |

### Settings Management (`/api/settings`)

| Endpoint | Method | Admin | Sales | Cashier | Middleware | Notes |
|---|---|---|---|---|---|---|
| `/` | GET | ✅ | ❌ | ❌ | `requireAdmin` | Get all settings |
| `/category/:category` | GET | ✅ | ❌ | ❌ | `requireAdmin` | Get settings by category |
| `/public` | GET | ✅ | ✅ | ✅ | None | Public settings |
| `/:key` | GET | ✅ | ❌ | ❌ | `requireAdmin` | Get specific setting |
| `/:key` | PUT | ✅ | ❌ | ❌ | `requireAdmin` | Update setting |
| `/` | POST | ✅ | ❌ | ❌ | `requireAdmin` | Create setting |
| `/:key` | DELETE | ✅ | ❌ | ❌ | `requireAdmin` | Delete setting |
| `/session/timeout` | GET/PUT | ✅ | ❌ | ❌ | `requireAdmin` | Session timeout settings |

## Data Access Patterns

### Customer Data Access

| Role | Access Pattern | Implementation |
|---|---|---|
| **Admin** | Full access to all customers | No filtering applied |
| **Sales** | Only customers they created | `requireCustomerOwnership` middleware + `sales_agent_id` filtering |
| **Cashier** | All customers (read-only for transactions) | No ownership restrictions for transaction processing |

### Transaction Access

| Role | Access Pattern | Implementation |
|---|---|---|
| **Admin** | Full access to all transactions | Administrative oversight |
| **Sales** | Can view transactions related to their customers | Filtered by customer ownership |
| **Cashier** | Can create and view transactions for any customer | Transaction processing role |

## Explicit Permission Checks in Logic

### Customer Listing Logic (customers.ts:37-86)

```typescript
// Role-based filtering in customer listing
let effectiveSalesAgentId: number | undefined;

if (req.user!.role === 'sales') {
  // Sales agents can only see their own customers
  effectiveSalesAgentId = req.user!.id;
} else if (req.user!.role === 'cashier') {
  // Cashiers can see all customers or filter by specific sales agent
  effectiveSalesAgentId = salesAgentId ? parseInt(salesAgentId as string, 10) : undefined;
} else if (req.user!.role === 'admin') {
  // Admins can see all customers or filter by specific sales agent
  effectiveSalesAgentId = salesAgentId ? parseInt(salesAgentId as string, 10) : undefined;
}
```

### Queue Reset Logic (queue.ts:437-441)

```typescript
// Explicit admin check for queue reset
if (!req.user || req.user.role !== 'admin') {
  res.status(403).json({ error: 'Only administrators can reset the queue' });
  return;
}
```

### User Creation Restrictions (users.ts:18-21)

```typescript
// Only sales and cashier roles can be created by admins
if (!['sales', 'cashier'].includes(role)) {
  res.status(400).json({ error: 'Role must be either sales or cashier' });
  return;
}
```

## Security Features

### Authentication Requirements

1. **JWT Token Validation**: All protected endpoints require valid JWT tokens
2. **User Status Check**: Only active users can access the system
3. **Role-Based Access**: Endpoints enforce role-based permissions
4. **Activity Logging**: All actions are logged for audit trails

### Data Protection

1. **Customer Ownership**: Sales agents can only access customers they created
2. **Transaction Security**: Only cashiers and admins can process transactions
3. **Administrative Isolation**: Sensitive admin functions are strictly protected
4. **Input Validation**: All endpoints include input validation and sanitization

## Summary

The EsyCashop application implements a comprehensive three-tier role-based access control system:

- **Admins** have full system access with administrative privileges
- **Sales agents** are restricted to customer management for customers they create
- **Cashiers** focus on transaction processing and queue management

The system uses a combination of middleware functions, explicit permission checks, and data filtering to ensure proper access control across all endpoints and features.
