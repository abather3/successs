# Bug Report for Daily Reports

## Fix Details
- Fixed in commit e6ad534

## New SQL Schema
The following SQL script creates the `daily_reports` table to store daily financial summaries:

```sql
-- Migration script to create daily_reports table
CREATE TABLE IF NOT EXISTS daily_reports (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    total_cash DECIMAL(10,2) DEFAULT 0.00,
    total_gcash DECIMAL(10,2) DEFAULT 0.00,
    total_maya DECIMAL(10,2) DEFAULT 0.00,
    total_credit_card DECIMAL(10,2) DEFAULT 0.00,
    total_bank_transfer DECIMAL(10,2) DEFAULT 0.00,
    petty_cash_start DECIMAL(10,2) DEFAULT 0.00,
    petty_cash_end DECIMAL(10,2) DEFAULT 0.00,
    expenses JSONB DEFAULT '[]'::jsonb,
    funds JSONB DEFAULT '[]'::jsonb,
    cash_turnover DECIMAL(10,2) DEFAULT 0.00,
    transaction_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Indexes and triggers are added to enhance performance and automatically update timestamps.

## Tests
The integration tests verify the correct handling of daily report summaries for all payment modes: 
- **Payment Modes**: Cash, Gcash, Maya, Credit Card, Bank Transfer
- **Test Scenarios**: Daily summaries, date parameters, missing payment modes handled gracefully

## Extending for New Payment Modes
To extend for new payment modes:
1. Update `PaymentMode` enum in `src/types/index.ts`.
2. Modify SQL migrations.
3. Implement tests to cover the new payment mode functionality.
