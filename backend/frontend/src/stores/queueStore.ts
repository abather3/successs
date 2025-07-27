// Queue store using Zustand
import create from 'zustand';
import { devtools } from 'zustand/middleware';
import { QueueState, QueueContextType, QueueStatus, QueueAction } from '../types/queue';

const initialState: QueueState = {
  queue: [],
  counters: [],
  processingCount: 0,
  statistics: {
    totalWaiting: 0,
    averageWaitTime: 0,
    longestWaitTime: 0,
    priorityCustomers: 0,
    totalProcessing: 0
  },
  isLoading: false,
  error: null,
  lastUpdate: null
};

const useQueueStore = create<QueueContextType>(
  devtools((set, get) => ({
    state: initialState,
    actions: {
      callNext: async (counterId) => {
        // Implementation for calling next customer
      },
      callSpecificCustomer: async (customerId, counterId) => {
        // Implementation for calling specific customer
      },
      completeService: async (customerId, counterId) => {
        // Implementation for completing service
      },
      cancelService: async (customerId, reason) => {
        // Implementation for cancelling service
      },
      changeStatus: async (customerId, newStatus) => {
        // Implementation for changing status
      },
      reorderQueue: async (customerIds) => {
        // Implementation for reordering queue
        return [];
      },
      resetQueue: async (reason) => {
        // Implementation for resetting queue
        return { cancelled: 0, completed: 0, message: '' };
      },
      getPosition: async (customerId) => {
        // Implementation for getting position
        return null;
      },
      getEstimatedWaitTime: async (customerId) => {
        // Implementation for estimating wait time
        return 0;
      },
      refreshQueue: async () => {
        // Implementation to refresh queue
      },
      refreshStatistics: async () => {
        // Implementation to refresh statistics
      }
    },
    websocket: {
      socket: null,
      isConnected: false,
      connectionError: null,
      lastPingTime: null,
      subscriptions: []
    },
    dispatch: (action: QueueAction) => {
      // Reducer handling
      const nextState = get().state;
      switch (action.type) {
        case 'SET_QUEUE':
          nextState.queue = action.payload;
          break;
        case 'SET_COUNTERS':
          nextState.counters = action.payload;
          break;
        case 'SET_PROCESSING_COUNT':
          nextState.processingCount = action.payload;
          break;
        case 'SET_STATISTICS':
          nextState.statistics = action.payload;
          break;
        case 'SET_LOADING':
          nextState.isLoading = action.payload;
          break;
        case 'SET_ERROR':
          nextState.error = action.payload;
          break;
        case 'UPDATE_CUSTOMER_STATUS':
          const customerIndex = nextState.queue.findIndex(c => c.customer_id === action.payload.customerId);
          if (customerIndex !== -1) {
            nextState.queue[customerIndex].customer.queue_status = action.payload.newStatus;
          }
          break;
        case 'ADD_QUEUE_ITEM':
          nextState.queue.push(action.payload);
          break;
        case 'REMOVE_QUEUE_ITEM':
          nextState.queue = nextState.queue.filter(c => c.customer_id !== action.payload);
          break;
        case 'UPDATE_QUEUE_POSITIONS':
          nextState.queue = [...action.payload];
          break;
        case 'RESET_QUEUE':
          nextState.queue = [];
          break;
        case 'SET_LAST_UPDATE':
          nextState.lastUpdate = action.payload;
          break;
        default:
          break;
      }
      set({ state: nextState });
    }
  }))
);

export default useQueueStore;

