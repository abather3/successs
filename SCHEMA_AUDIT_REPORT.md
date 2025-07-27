# Schema Audit Report - EscaShop Database

**Date:** 2025-07-21  
**Audit Scope:** Production schema vs. repository models, field references, column type verification  
**Database:** PostgreSQL (escashop)  

---

## 1. Production Schema Analysis

### Current Tables in Production:
- `activity_logs` ✅
- `applied_migrations` ✅
- `cashier_notifications` ✅
- `counters` ✅
- `customer_notification_actions` ✅
- `customer_notifications` ✅
- `customers` ✅
- `daily_queue_summary` ✅
- `daily_reports` ✅
- `dropdown_options` ✅
- `grade_types` ✅
- `lens_types` ✅
- `notification_logs` ✅
- `payment_settlements` ✅
- `queue` ✅
- `queue_analytics` ✅
- `queue_events` ✅
- `sms_notifications` ✅
- `sms_templates` ✅
- `system_settings` ✅
- `transactions` ✅
- `users` ✅

### Missing Tables:
- `activities` ❌ (referenced in TypeScript types but not in production)

---

## 2. Field Reference Analysis

### `served_at` Field References:

**Found in:**
1. **`src/services/DailyQueueResetService.ts`** (Lines 116, 198, 203, 210)
   - Used in queue analytics calculations
   - References: `served_at - created_at` for wait time calculations
   - Context: Daily reset service for queue archival

2. **`src/database/migrations/create_daily_queue_history_tables.sql`** (Line 43)
   - Column definition in `customer_history` table
   - Type: `TIMESTAMPTZ`

**Database Reality:**
- ❌ **NOT FOUND in production `customers` table**
- ❌ **NOT FOUND in any production table**
- ⚠️ **MIGRATION REQUIRED:** Add `served_at` column to appropriate table(s)

### `ip_address` Field References:

**Found in:**
1. **`src/routes/auth.ts`** (Lines 64, 217, 325)
   - Activity logging for authentication events
   
2. **`src/services/activity.ts`** (Lines 9, 12, 15, 20)
   - Core activity logging service interface
   - Parameter type: `string?` (optional)

3. **`src/routes/settings.ts`** (Lines 79, 118, 144, 203)
   - Activity logging for settings changes

4. **`src/routes/scheduler.ts`** (Lines 42, 65, 92, 125)
   - Activity logging for scheduler operations

5. **`src/middleware/auth.ts`** (Line 111)
   - Authentication middleware logging

6. **Multiple other service files** - consistent usage pattern for activity logging

**Database Reality:**
- ✅ **FOUND in production `activity_logs` table**
- **Type:** `inet` (PostgreSQL network address type)
- **Nullable:** YES
- **Default:** None

---

## 3. Column Type Verification

### `customers` Table:
```sql
-- Production Schema
id: integer NOT NULL DEFAULT nextval('customers_id_seq'::regclass)
or_number: character varying(100) NOT NULL 
name: character varying(255) NOT NULL 
contact_number: character varying(50) NOT NULL 
email: character varying(255) NULL 
age: integer NOT NULL 
address: text NOT NULL 
occupation: character varying(255) NULL 
distribution_info: character varying(50) NOT NULL 
sales_agent_id: integer NULL 
prescription: jsonb NULL 
grade_type: character varying(100) NOT NULL 
lens_type: character varying(100) NOT NULL 
frame_code: character varying(100) NULL 
payment_info: jsonb NOT NULL 
remarks: text NULL 
priority_flags: jsonb NOT NULL 
queue_status: character varying(50) NOT NULL DEFAULT 'waiting'::character varying
token_number: integer NOT NULL 
priority_score: integer NULL DEFAULT 0
created_at: timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP
updated_at: timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP
doctor_assigned: character varying(255) NULL 
manual_position: integer NULL 
estimated_time: jsonb NULL
```

**Missing Columns (referenced in code):**
- ❌ `served_at: TIMESTAMPTZ` - Required for queue analytics

### `activity_logs` Table:
```sql
-- Production Schema
id: integer NOT NULL DEFAULT nextval('activity_logs_id_seq'::regclass)
user_id: integer NULL 
action: character varying(255) NOT NULL 
details: jsonb NULL 
ip_address: inet NULL 
user_agent: text NULL 
created_at: timestamp without time zone NULL DEFAULT CURRENT_TIMESTAMP
```

**Type Discrepancies:**
- ⚠️ **Migration SQL:** `VARCHAR(45)` vs **Production:** `inet`
  - Production uses PostgreSQL's native `inet` type (better for IP addresses)
  - Migration SQL uses `VARCHAR(45)` (sufficient for IPv6, but less semantic)

---

## 4. Repository vs Production Discrepancies

### Schema Differences:

1. **complete-migration.sql vs Production:**
   - Migration defines `ip_address` as `VARCHAR(45)`
   - Production has `ip_address` as `inet`
   - **Recommendation:** Update migration to use `inet` type

2. **Missing Tables:**
   - `activities` table referenced in TypeScript types but not in production
   - May be intended for future use or deprecated

3. **Missing Columns:**
   - `served_at` column referenced in DailyQueueResetService but missing from production

### TypeScript Type Definitions:
- `ActivityLog` interface matches production schema ✅
- Missing interface for `activities` table (if needed)

---

## 5. Migration Requirements

### Immediate Actions Required:

1. **Add `served_at` column to customers table:**
   ```sql
   ALTER TABLE customers 
   ADD COLUMN served_at TIMESTAMP WITH TIME ZONE;
   
   CREATE INDEX idx_customers_served_at ON customers(served_at);
   ```

2. **Create missing tables if needed:**
   ```sql
   -- If activities table is required
   CREATE TABLE IF NOT EXISTS activities (
       id SERIAL PRIMARY KEY,
       -- Define columns based on requirements
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

3. **Update migration files:**
   - Change `ip_address VARCHAR(45)` to `ip_address INET` in migration files
   - Ensure consistency between migration SQL and production schema

### Data Integrity Considerations:

1. **Existing Data:**
   - `served_at` will be NULL for existing customers
   - May need backfill strategy for historical data

2. **Application Code:**
   - DailyQueueResetService expects `served_at` to exist
   - Will fail until column is added

3. **Index Performance:**
   - Add appropriate indexes for new columns
   - Consider query patterns in analytics services

---

## 6. Recommendations

### High Priority:
1. ✅ Add `served_at` column to `customers` table
2. ✅ Update application code to populate `served_at` when serving customers
3. ✅ Create migration script for the above changes

### Medium Priority:
1. Standardize `ip_address` type across migration files (`inet` vs `VARCHAR`)
2. Review necessity of `activities` table - remove references if deprecated
3. Add missing indexes for performance optimization

### Low Priority:
1. Consider data retention policies for activity logs
2. Review column sizes (e.g., VARCHAR lengths) for optimization
3. Add database constraints where business rules apply

---

## 7. Next Steps

1. **Create Migration Script:** Add `served_at` column and necessary indexes
2. **Update Application Code:** Ensure `served_at` is populated during customer service flow
3. **Test Migration:** Verify impact on existing analytics and queue operations
4. **Update Documentation:** Reflect schema changes in API documentation

---

**Audit Completed:** 2025-07-21T16:09:42Z  
**Status:** Migration required for `served_at` column  
**Risk Level:** Medium (affects queue analytics functionality)
