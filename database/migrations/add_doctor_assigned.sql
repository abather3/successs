-- Add doctor_assigned field to customers table
ALTER TABLE customers ADD COLUMN doctor_assigned VARCHAR(255);
