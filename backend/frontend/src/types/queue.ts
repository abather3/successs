// Queue Management Types for Frontend
export enum QueueStatus {
  WAITING = 'waiting',
  SERVING = 'serving',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export interface PriorityFlags {
  senior_citizen: boolean;
  pregnant: boolean;
  pwd: boolean;
}

export interface Customer {
  id: number;
  or_number: string;
  name: string;
  contact_number: string;
  email?: string;
  age: number;
  address: string;
  occupation?: string;
  sales_agent_id: number;
  sales_agent_name?: string;
  doctor_assigned?: string;
  queue_status: QueueStatus;
  token_number: number;
  priority_flags: PriorityFlags;
  created_at: string;
  updated_at: string;
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

// WebSocket Event Payloads
export interface QueueStatusChangedPayload {
  id: number;
  newStatus: QueueStatus;
  timestamp: string;
  previousStatus?: QueueStatus;
  suppressSound?: boolean;
  customer?: {
    id: number;
    name: string;
    or_number: string;
    token_number: number;
  };
}

export interface QueueUpdatePayload {
  type: 'customer_called' | 'customer_completed' | 'customer_cancelled' | 'status_changed' | 'priority_updated' | 'queue_reordered' | 'queue_reset';
  customer?: Customer;
  queue?: QueueItem[];
  counterId?: number;
  previousStatus?: QueueStatus;
  newStatus?: QueueStatus;
  timestamp: string;
  processingCount: number; // New field for real-time processing count
  suppressSound?: boolean;
  reason?: string;
  priorityBoost?: number;
  adminId?: number;
  result?: {
    cancelled: number;
    completed: number;
    message: string;
  };
}

// Queue Context State
export interface QueueState {
  queue: QueueItem[];
  counters: Counter[];
  processingCount: number;
  statistics: QueueStatistics;
  isLoading: boolean;
  error: string | null;
  lastUpdate: string | null;
}

export interface QueueStatistics {
  totalWaiting: number;
  averageWaitTime: number;
  longestWaitTime: number;
  priorityCustomers: number;
  totalProcessing: number; // New field
}

// Queue Actions
export type QueueAction = 
  | { type: 'SET_QUEUE'; payload: QueueItem[] }
  | { type: 'SET_COUNTERS'; payload: Counter[] }
  | { type: 'SET_PROCESSING_COUNT'; payload: number }
  | { type: 'SET_STATISTICS'; payload: QueueStatistics }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_CUSTOMER_STATUS'; payload: { customerId: number; newStatus: QueueStatus; previousStatus?: QueueStatus } }
  | { type: 'ADD_QUEUE_ITEM'; payload: QueueItem }
  | { type: 'REMOVE_QUEUE_ITEM'; payload: number }
  | { type: 'UPDATE_QUEUE_POSITIONS'; payload: QueueItem[] }
  | { type: 'RESET_QUEUE' }
  | { type: 'SET_LAST_UPDATE'; payload: string };

// Runtime Type Guards
export function isValidQueueStatus(status: string): status is QueueStatus {
  return Object.values(QueueStatus).includes(status as QueueStatus);
}

export function validateQueueStatusPayload(data: any): data is QueueStatusChangedPayload {
  return (
    typeof data === 'object' &&
    typeof data.id === 'number' &&
    typeof data.newStatus === 'string' &&
    isValidQueueStatus(data.newStatus) &&
    typeof data.timestamp === 'string'
  );
}

export function validateQueueUpdatePayload(data: any): data is QueueUpdatePayload {
  return (
    typeof data === 'object' &&
    typeof data.type === 'string' &&
    typeof data.timestamp === 'string' &&
    typeof data.processingCount === 'number'
  );
}

// Queue Management Actions Interface
export interface QueueActions {
  callNext: (counterId: number) => Promise<Customer | null>;
  callSpecificCustomer: (customerId: number, counterId: number) => Promise<Customer | null>;
  completeService: (customerId: number, counterId: number) => Promise<Customer>;
  cancelService: (customerId: number, reason?: string) => Promise<Customer>;
  changeStatus: (customerId: number, newStatus: QueueStatus) => Promise<Customer>;
  reorderQueue: (customerIds: number[]) => Promise<QueueItem[]>;
  resetQueue: (reason?: string) => Promise<{ cancelled: number; completed: number; message: string }>;
  getPosition: (customerId: number) => Promise<number | null>;
  getEstimatedWaitTime: (customerId: number) => Promise<number>;
  refreshQueue: () => Promise<void>;
  refreshStatistics: () => Promise<void>;
}

// WebSocket Connection State
export interface WebSocketState {
  socket: any; // Socket.IO client instance
  isConnected: boolean;
  connectionError: string | null;
  lastPingTime: string | null;
  subscriptions: string[];
}

// Combined Queue Context Type
export interface QueueContextType {
  state: QueueState;
  actions: QueueActions;
  websocket: WebSocketState;
  dispatch: React.Dispatch<QueueAction>;
}
