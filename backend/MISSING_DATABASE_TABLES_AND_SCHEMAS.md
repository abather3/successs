# Missing Database Tables and Schemas

The following database tables and schemas were identified:

## Customers Table
- **Name**: `customers`
- **Columns**: 
  - id
  - or_number
  - name
  - contact_number
  - email
  - age
  - address
  - occupation
  - distribution_info
  - sales_agent_id
  - doctor_assigned
  - prescription
  - grade_type
  - lens_type
  - frame_code
  - payment_info
  - remarks
  - priority_flags
  - queue_status
  - token_number
  - priority_score
  - estimated_time

## Transactions Table
- **Name**: `transactions`
- **Columns**:
  - id
  - customer_id
  - or_number
  - amount
  - payment_mode
  - sales_agent_id
  - cashier_id
  - transaction_date
  - paid_amount
  - balance_amount
  - payment_status

## Payment Settlements Table
...
