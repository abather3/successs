import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  QueueState, 
  QueueAction, 
  QueueContextType, 
  QueueStatus,
  QueueStatusChangedPayload,
  QueueUpdatePayload,
  validateQueueStatusPayload,
  validateQueueUpdatePayload,
  Customer,
  QueueItem
} from '../types/queue';

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

// Queue Reducer
function queueReducer(state: QueueState, action: QueueAction): QueueState {
  switch (action.type) {
    case 'SET_QUEUE':
      return { ...state, queue: action.payload, lastUpdate: new Date().toISOString() };
    
    case 'SET_COUNTERS':
      return { ...state, counters: action.payload };
    
    case 'SET_PROCESSING_COUNT':
      return { 
        ...state, 
        processingCount: action.payload,
        statistics: { ...state.statistics, totalProcessing: action.payload }
      };
    
    case 'SET_STATISTICS':
      return { ...state, statistics: action.payload };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    
    case 'UPDATE_CUSTOMER_STATUS':
      return {
        ...state,
        queue: state.queue.map(item => 
          item.customer_id === action.payload.customerId
            ? { 
                ...item, 
                customer: { 
                  ...item.customer, 
                  queue_status: action.payload.newStatus 
                } 
              }
            : item
        ),
        lastUpdate: new Date().toISOString()
      };
    
    case 'ADD_QUEUE_ITEM':
      return { 
        ...state, 
        queue: [...state.queue, action.payload],
        lastUpdate: new Date().toISOString()
      };
    
    case 'REMOVE_QUEUE_ITEM':
      return { 
        ...state, 
        queue: state.queue.filter(item => item.customer_id !== action.payload),
        lastUpdate: new Date().toISOString()
      };
    
    case 'UPDATE_QUEUE_POSITIONS':
      return { 
        ...state, 
        queue: action.payload,
        lastUpdate: new Date().toISOString()
      };
    
    case 'RESET_QUEUE':
      return { 
        ...state, 
        queue: [],
        processingCount: 0,
        lastUpdate: new Date().toISOString()
      };
    
    case 'SET_LAST_UPDATE':
      return { ...state, lastUpdate: action.payload };
    
    default:
      return state;
  }
}

const QueueContext = createContext<QueueContextType | undefined>(undefined);

interface QueueProviderProps {
  children: ReactNode;
  apiBaseUrl?: string;
  authToken?: string;
}

export const QueueProvider: React.FC<QueueProviderProps> = ({ 
  children, 
  apiBaseUrl = 'http://localhost:3000',
  authToken 
}) => {
  const [state, dispatch] = useReducer(queueReducer, initialState);
  const [socket, setSocket] = React.useState<Socket | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const [connectionError, setConnectionError] = React.useState<string | null>(null);

  // WebSocket connection setup
  const initializeSocket = useCallback(() => {
    if (!authToken) {
      setConnectionError('Authentication token required');
      return;
    }

    try {
      const newSocket = io(apiBaseUrl, {
        auth: { token: authToken },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      // Connection handlers
      newSocket.on('connect', () => {
        console.log('[QUEUE_CONTEXT] Connected to WebSocket');
        setIsConnected(true);
        setConnectionError(null);
        
        // Subscribe to queue updates
        newSocket.emit('subscribe:queue');
      });

      newSocket.on('disconnect', (reason) => {
        console.log('[QUEUE_CONTEXT] Disconnected:', reason);
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('[QUEUE_CONTEXT] Connection error:', error);
        setConnectionError(`Connection failed: ${error.message}`);
        setIsConnected(false);
      });

      // Enhanced queue status change handler
      newSocket.on('queue:status_changed', (data: unknown) => {
        console.log('[QUEUE_CONTEXT] Status changed:', data);
        
        if (validateQueueStatusPayload(data)) {
          dispatch({
            type: 'UPDATE_CUSTOMER_STATUS',
            payload: {
              customerId: data.id,
              newStatus: data.newStatus,
              previousStatus: data.previousStatus
            }
          });
        } else {
          console.warn('[QUEUE_CONTEXT] Invalid status change payload:', data);
        }
      });

      // Enhanced queue update handler with processing count
      newSocket.on('queue:update', (data: unknown) => {
        console.log('[QUEUE_CONTEXT] Queue update:', data);
        
        if (validateQueueUpdatePayload(data)) {
          // Update processing count from the payload
          dispatch({
            type: 'SET_PROCESSING_COUNT',
            payload: data.processingCount
          });

          // Handle different update types
          switch (data.type) {
            case 'customer_called':
              if (data.customer) {
                dispatch({
                  type: 'UPDATE_CUSTOMER_STATUS',
                  payload: {
                    customerId: data.customer.id,
                    newStatus: QueueStatus.SERVING,
                    previousStatus: QueueStatus.WAITING
                  }
                });
              }
              break;
            
            case 'customer_completed':
              if (data.customer) {
                dispatch({
                  type: 'UPDATE_CUSTOMER_STATUS',
                  payload: {
                    customerId: data.customer.id,
                    newStatus: QueueStatus.COMPLETED,
                    previousStatus: data.previousStatus
                  }
                });
              }
              break;
            
            case 'status_changed':
              if (data.customer && data.newStatus) {
                dispatch({
                  type: 'UPDATE_CUSTOMER_STATUS',
                  payload: {
                    customerId: data.customer.id,
                    newStatus: data.newStatus,
                    previousStatus: data.previousStatus
                  }
                });
              }
              break;
            
            case 'queue_reordered':
              if (data.queue) {
                dispatch({
                  type: 'UPDATE_QUEUE_POSITIONS',
                  payload: data.queue
                });
              }
              break;
            
            case 'queue_reset':
              dispatch({ type: 'RESET_QUEUE' });
              break;
          }
        } else {
          console.warn('[QUEUE_CONTEXT] Invalid queue update payload:', data);
        }
      });

      // Error handlers
      newSocket.on('auth:error', ({ code, message }) => {
        console.error('[QUEUE_CONTEXT] Auth error:', code, message);
        setConnectionError(`Authentication failed: ${message}`);
      });

      setSocket(newSocket);
    } catch (error) {
      console.error('[QUEUE_CONTEXT] Socket initialization error:', error);
      setConnectionError('Failed to initialize WebSocket connection');
    }
  }, [apiBaseUrl, authToken]);

  // Initialize socket on mount
  useEffect(() => {
    initializeSocket();

    return () => {
      if (socket) {
        console.log('[QUEUE_CONTEXT] Cleaning up WebSocket connection');
        socket.disconnect();
      }
    };
  }, [initializeSocket]);

  // API actions
  const actions = {
    callNext: async (counterId: number): Promise<Customer | null> => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/queue/call-next`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ counterId })
        });
        
        if (!response.ok) throw new Error('Failed to call next customer');
        return await response.json();
      } catch (error) {
        console.error('Error calling next customer:', error);
        dispatch({ type: 'SET_ERROR', payload: error.message });
        return null;
      }
    },

    callSpecificCustomer: async (customerId: number, counterId: number): Promise<Customer | null> => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/queue/call-specific`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ customerId, counterId })
        });
        
        if (!response.ok) throw new Error('Failed to call specific customer');
        return await response.json();
      } catch (error) {
        console.error('Error calling specific customer:', error);
        dispatch({ type: 'SET_ERROR', payload: error.message });
        return null;
      }
    },

    completeService: async (customerId: number, counterId: number): Promise<Customer> => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/queue/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ customerId, counterId })
        });
        
        if (!response.ok) throw new Error('Failed to complete service');
        return await response.json();
      } catch (error) {
        console.error('Error completing service:', error);
        dispatch({ type: 'SET_ERROR', payload: error.message });
        throw error;
      }
    },

    cancelService: async (customerId: number, reason?: string): Promise<Customer> => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/queue/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ customerId, reason })
        });
        
        if (!response.ok) throw new Error('Failed to cancel service');
        return await response.json();
      } catch (error) {
        console.error('Error cancelling service:', error);
        dispatch({ type: 'SET_ERROR', payload: error.message });
        throw error;
      }
    },

    changeStatus: async (customerId: number, newStatus: QueueStatus): Promise<Customer> => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/queue/change-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ customerId, newStatus })
        });
        
        if (!response.ok) throw new Error('Failed to change status');
        return await response.json();
      } catch (error) {
        console.error('Error changing status:', error);
        dispatch({ type: 'SET_ERROR', payload: error.message });
        throw error;
      }
    },

    reorderQueue: async (customerIds: number[]): Promise<QueueItem[]> => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/queue/reorder`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ customerIds })
        });
        
        if (!response.ok) throw new Error('Failed to reorder queue');
        return await response.json();
      } catch (error) {
        console.error('Error reordering queue:', error);
        dispatch({ type: 'SET_ERROR', payload: error.message });
        return [];
      }
    },

    resetQueue: async (reason?: string): Promise<{ cancelled: number; completed: number; message: string }> => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/queue/reset`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ reason })
        });
        
        if (!response.ok) throw new Error('Failed to reset queue');
        return await response.json();
      } catch (error) {
        console.error('Error resetting queue:', error);
        dispatch({ type: 'SET_ERROR', payload: error.message });
        return { cancelled: 0, completed: 0, message: 'Failed to reset queue' };
      }
    },

    getPosition: async (customerId: number): Promise<number | null> => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/queue/position/${customerId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Failed to get position');
        const data = await response.json();
        return data.position;
      } catch (error) {
        console.error('Error getting position:', error);
        return null;
      }
    },

    getEstimatedWaitTime: async (customerId: number): Promise<number> => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/queue/wait-time/${customerId}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Failed to get wait time');
        const data = await response.json();
        return data.estimatedWaitTime;
      } catch (error) {
        console.error('Error getting wait time:', error);
        return 0;
      }
    },

    refreshQueue: async (): Promise<void> => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const response = await fetch(`${apiBaseUrl}/api/queue`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Failed to refresh queue');
        const data = await response.json();
        dispatch({ type: 'SET_QUEUE', payload: data.queue || [] });
      } catch (error) {
        console.error('Error refreshing queue:', error);
        dispatch({ type: 'SET_ERROR', payload: error.message });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },

    refreshStatistics: async (): Promise<void> => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/queue/statistics`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Failed to refresh statistics');
        const data = await response.json();
        dispatch({ type: 'SET_STATISTICS', payload: data });
      } catch (error) {
        console.error('Error refreshing statistics:', error);
        dispatch({ type: 'SET_ERROR', payload: error.message });
      }
    }
  };

  const value: QueueContextType = {
    state,
    actions,
    websocket: {
      socket,
      isConnected,
      connectionError,
      lastPingTime: null,
      subscriptions: ['queue:updates']
    },
    dispatch
  };

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
};

// Custom hook to use the queue context
export const useQueue = (): QueueContextType => {
  const context = useContext(QueueContext);
  if (context === undefined) {
    throw new Error('useQueue must be used within a QueueProvider');
  }
  return context;
};

export default QueueContext;
