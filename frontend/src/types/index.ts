export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export enum UserRole {
  ADMIN = 'admin',
  SALES = 'sales',
  CASHIER = 'cashier'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive'
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
  created_at: string;
  updated_at: string;
  sales_agent_name?: string;
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

// Utility interface for queue status with fallback information
export interface QueueStatusWithFallback {
  status: QueueStatus;
  isFallback: boolean;
  originalValue?: string;
  displayText: string;
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
  current_customer_name?: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: number;
  customer_id: number;
  or_number: string;
  amount: number;
  payment_mode: PaymentMode;
  sales_agent_id: number;
  cashier_id?: number;
  transaction_date: string;
  created_at: string;
  customer_name?: string;
  sales_agent_name?: string;
  cashier_name?: string;
  paid_amount: number;
  balance_amount: number;
  payment_status: PaymentStatus;
}

export interface PaymentSettlement {
  id: number;
  transaction_id: number;
  amount: number;
  payment_mode: PaymentMode;
  paid_at: string;
  cashier_id?: number;
  notes?: string;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface QueueStatistics {
  totalWaiting: number;
  averageWaitTime: number;
  longestWaitTime: number;
  priorityCustomers: number;
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
  exists?: boolean; // API returns this for missing reports
}

export interface Expense {
  description: string;
  amount: number;
}

export interface Fund {
  description: string;
  amount: number;
}

// Customer Registration Notification Types
export interface CustomerRegistrationNotification {
  id: string;
  type: 'customer_registration';
  customer_id: number;
  customer_name: string;
  or_number: string;
  token_number: number;
  payment_amount: number;
  payment_mode?: PaymentMode;
  distribution_method: DistributionType;
  priority_type: 'Senior Citizen' | 'Pregnant' | 'PWD' | 'Standard Customer';
  is_priority: boolean;
  priority_flags: PriorityFlags;
  created_by: number;
  created_by_name: string;
  location_id: number;
  message: string;
  timestamp: string;
  expires_at: string;
  metadata?: {
    estimated_time?: EstimatedTime;
    contact_number?: string;
    age?: number;
  };
  acknowledged_at?: string;
  is_read?: boolean;
  is_dismissed?: boolean;
}

export interface CashierNotificationPreferences {
  sound_enabled: boolean;
  volume: number;
  priority_only: boolean; // Only show priority customer notifications
  location_filter?: number; // Filter by specific location
  auto_dismiss_after_hours: number; // Auto dismiss notifications after X hours
}

export interface NotificationLog {
  id: number;
  customer_id: number;
  message: string;
  status: NotificationStatus;
  sent_at: string;
  delivery_status?: string;
  customer_name?: string;
}

export enum NotificationStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed'
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp: string;
}
