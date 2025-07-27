import { Request } from 'express';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
}

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  SALES = 'sales',
  CASHIER = 'cashier'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive'
}

export interface AuthRequest extends Request {
  user?: User;
}

export interface EstimatedTime {
  days: number;
  hours: number;
  minutes: number;
}

export interface Customer {
  id: number;
  or_number: string;
  name: string;
  contact_number: string;
  email: string;
  age: number;
  address: string;
  occupation?: string;
  distribution_info: DistributionType;
  sales_agent_id: number;
  sales_agent_name?: string;
  doctor_assigned?: string;
  prescription: Prescription;
  grade_type: string;
  lens_type: string;
  frame_code?: string;
  estimated_time: EstimatedTime;
  payment_info: PaymentInfo;
  remarks?: string;
  priority_flags: PriorityFlags;
  queue_status: QueueStatus;
  token_number: number;
  created_at: Date;
  updated_at: Date;
}

export enum DistributionType {
  LALAMOVE = 'lalamove',
  LBC = 'lbc',
  PICKUP = 'pickup'
}

export interface Prescription {
  od?: string;
  os?: string;
  ou?: string;
  pd?: string;
  add?: string;
}

export interface PaymentInfo {
  mode: PaymentMode;
  amount: number;
}

export enum PaymentMode {
  GCASH = 'gcash',
  MAYA = 'maya',
  BANK_TRANSFER = 'bank_transfer',
  CREDIT_CARD = 'credit_card',
  CASH = 'cash'
}

export enum PaymentStatus {
  UNPAID = 'unpaid',
  PARTIAL = 'partial',
  PAID = 'paid'
}

export interface PriorityFlags {
  senior_citizen: boolean;
  pregnant: boolean;
  pwd: boolean;
}

export enum QueueStatus {
  WAITING = 'waiting',
  SERVING = 'serving',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

// Utility type for queue status with fallback information
export interface QueueStatusWithFallback {
  status: QueueStatus;
  isFallback: boolean;
  originalValue?: string;
  warningMessage?: string;
}

export interface QueueItem {
  customer_id: number;
  customer: Customer;
  position: number;
  priority_score: number;
  estimated_wait_time: number;
}

export interface Counter {
  id: number;
  name: string;
  is_active: boolean;
  current_customer_id?: number;
  created_at: Date;
  updated_at: Date;
}

export interface Transaction {
  id: number;
  customer_id: number;
  or_number: string;
  amount: number;
  payment_mode: PaymentMode;
  sales_agent_id: number;
  cashier_id?: number;
  transaction_date: Date;
  created_at: Date;
  paid_amount: number;
  balance_amount: number;
  payment_status: PaymentStatus;
}

export interface PaymentSettlement {
  id: number;
  transaction_id: number;
  amount: number;
  payment_mode: PaymentMode;
  paid_at: Date;
  cashier_id?: number;
  cashier_name?: string;
  notes?: string;
  created_at: Date;
}

export interface ActivityLog {
  id: number;
  user_id: number;
  action: string;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface DailyReport {
  date: string;
  total_cash: number;
  total_gcash: number;
  total_maya: number;
  total_credit_card: number;
  total_bank_transfer: number;
  petty_cash_start: number;
  petty_cash_end: number;
  expenses: Expense[];
  funds: Fund[];
  cash_turnover: number;
  transaction_count: number;
}

export interface Expense {
  description: string;
  amount: number;
}

export interface Fund {
  description: string;
  amount: number;
}

export interface SMSTemplate {
  id: number;
  name: string;
  template: string;
  variables: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationLog {
  id: number;
  customer_id: number;
  message: string;
  status: NotificationStatus;
  sent_at: Date;
  delivery_status?: string;
}

export enum NotificationStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed'
}

export interface DropdownOption {
  id: number;
  category: DropdownCategory;
  value: string;
  display_text: string;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
}

export enum DropdownCategory {
  GRADE_TYPE = 'grade_type',
  LENS_TYPE = 'lens_type'
}

// Daily Queue Scheduler Types
export interface SchedulerStatus {
  isScheduled: boolean;
  isRunning: boolean;
  nextReset: string;
  lastReset: Date | null;
  timezone: string;
}

export interface DailyQueueHistory {
  id: number;
  date: Date;
  total_customers: number;
  waiting_customers: number;
  serving_customers: number;
  completed_customers: number;
  cancelled_customers: number;
  carried_forward_customers: number;
  average_wait_time: number;
  peak_queue_length: number;
  operation_start_time: Date;
  operation_end_time: Date;
  created_at: Date;
}

export interface CustomerHistory {
  id: number;
  original_customer_id: number;
  or_number: string;
  name: string;
  contact_number: string;
  email: string;
  queue_status: QueueStatus;
  token_number: number;
  wait_time_minutes: number;
  service_duration_minutes: number;
  carried_forward: boolean;
  archive_date: Date;
  created_at: Date;
}

export interface DailyResetLog {
  id: number;
  reset_date: Date;
  customers_archived: number;
  customers_carried_forward: number;
  queues_reset: number;
  success: boolean;
  error_message: string | null;
  duration_ms: number;
  created_at: Date;
}
