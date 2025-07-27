import { useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { 
  QueueStatus,
  QueueStatusChangedPayload,
  QueueUpdatePayload,
  validateQueueStatusPayload,
  validateQueueUpdatePayload,
  QueueAction,
  Customer
} from '../types/queue';

interface UseWebSocketQueueOptions {
  socket: Socket | null;
  onStatusChanged?: (data: QueueStatusChangedPayload) => void;
  onQueueUpdate?: (data: QueueUpdatePayload) => void;
  onError?: (error: string) => void;
  dispatch?: React.Dispatch<QueueAction>;
  enableLogging?: boolean;
}

interface UseWebSocketQueueReturn {
  isSubscribed: boolean;
  lastEvent: string | null;
  eventCount: number;
  subscribe: () => void;
  unsubscribe: () => void;
  emitCustomerCall: (customerId: number, counterName: string) => void;
  emitCounterStatus: (counterId: number, isActive: boolean) => void;
}

export const useWebSocketQueue = ({
  socket,
  onStatusChanged,
  onQueueUpdate,
  onError,
  dispatch,
  enableLogging = false
}: UseWebSocketQueueOptions): UseWebSocketQueueReturn => {
  const isSubscribedRef = useRef(false);
  const lastEventRef = useRef<string | null>(null);
  const eventCountRef = useRef(0);
  const handlersAttachedRef = useRef(false);

  const log = useCallback((message: string, data?: any) => {
    if (enableLogging) {
      console.log(`[useWebSocketQueue] ${message}`, data);
    }
  }, [enableLogging]);

  // Enhanced queue status change handler with runtime type validation
  const handleQueueStatusChanged = useCallback((data: unknown) => {
    log('Received queue:status_changed event', data);
    
    if (!validateQueueStatusPayload(data)) {
      const errorMsg = 'Invalid queue status change payload received';
      log(errorMsg, data);
      onError?.(errorMsg);
      return;
    }

    eventCountRef.current += 1;
    lastEventRef.current = 'queue:status_changed';

    // Dispatch to reducer if available
    if (dispatch) {
      dispatch({
        type: 'UPDATE_CUSTOMER_STATUS',
        payload: {
          customerId: data.id,
          newStatus: data.newStatus,
          previousStatus: data.previousStatus
        }
      });

      // Update last event time
      dispatch({
        type: 'SET_LAST_UPDATE',
        payload: new Date().toISOString()
      });
    }

    // Call custom handler
    onStatusChanged?.(data);

    log(`Status changed - Customer ${data.id}: ${data.previousStatus} → ${data.newStatus}`);
    
    // Special handling for processing status
    if (data.newStatus === QueueStatus.PROCESSING) {
      log('Customer moved to processing status', {
        customerId: data.id,
        suppressSound: data.suppressSound
      });
    }
  }, [dispatch, onStatusChanged, onError, log]);

  // Enhanced queue update handler with processing count validation
  const handleQueueUpdate = useCallback((data: unknown) => {
    log('Received queue:update event', data);
    
    if (!validateQueueUpdatePayload(data)) {
      const errorMsg = 'Invalid queue update payload received';
      log(errorMsg, data);
      onError?.(errorMsg);
      return;
    }

    eventCountRef.current += 1;
    lastEventRef.current = 'queue:update';

    // Update processing count from the enhanced payload
    if (dispatch && typeof data.processingCount === 'number') {
      dispatch({
        type: 'SET_PROCESSING_COUNT',
        payload: data.processingCount
      });

      log(`Processing count updated: ${data.processingCount}`);
    }

    // Handle specific update types
    if (dispatch) {
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
            log(`Customer called: ${data.customer.name} (${data.customer.id})`);
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
            log(`Customer completed: ${data.customer.name} (${data.customer.id})`);
          }
          break;

        case 'customer_cancelled':
          if (data.customer) {
            dispatch({
              type: 'UPDATE_CUSTOMER_STATUS',
              payload: {
                customerId: data.customer.id,
                newStatus: QueueStatus.CANCELLED,
                previousStatus: data.previousStatus
              }
            });
            log(`Customer cancelled: ${data.customer.name} (${data.customer.id})`);
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
            log(`Status changed: ${data.customer.name} (${data.customer.id}) → ${data.newStatus}`);
            
            // Special processing status handling
            if (data.newStatus === QueueStatus.PROCESSING) {
              log('Processing status transition detected', {
                suppressSound: data.suppressSound,
                processingCount: data.processingCount
              });
            }
          }
          break;

        case 'queue_reordered':
          if (data.queue) {
            dispatch({
              type: 'UPDATE_QUEUE_POSITIONS',
              payload: data.queue
            });
            log(`Queue reordered: ${data.queue.length} items`);
          }
          break;

        case 'queue_reset':
          dispatch({ type: 'RESET_QUEUE' });
          log('Queue reset performed', data.result);
          break;

        case 'priority_updated':
          if (data.customer) {
            // Refresh queue after priority update
            log(`Priority updated for customer: ${data.customer.name} (${data.customer.id})`);
          }
          break;

        default:
          log(`Unknown queue update type: ${data.type}`);
      }

      // Update last event time
      dispatch({
        type: 'SET_LAST_UPDATE',
        payload: new Date().toISOString()
      });
    }

    // Call custom handler
    onQueueUpdate?.(data);
  }, [dispatch, onQueueUpdate, onError, log]);

  // Authentication error handler
  const handleAuthError = useCallback((error: { code: string; message: string }) => {
    const errorMsg = `WebSocket authentication error: ${error.code} - ${error.message}`;
    log(errorMsg);
    onError?.(errorMsg);
  }, [onError, log]);

  // Subscribe to queue events
  const subscribe = useCallback(() => {
    if (!socket || isSubscribedRef.current) {
      log('Cannot subscribe - socket not available or already subscribed');
      return;
    }

    try {
      // Subscribe to queue updates
      socket.emit('subscribe:queue');
      
      isSubscribedRef.current = true;
      log('Subscribed to queue updates');
    } catch (error) {
      log('Error subscribing to queue updates:', error);
      onError?.('Failed to subscribe to queue updates');
    }
  }, [socket, onError, log]);

  // Unsubscribe from queue events
  const unsubscribe = useCallback(() => {
    if (!socket || !isSubscribedRef.current) {
      return;
    }

    try {
      // Note: Socket.IO doesn't have a built-in unsubscribe for emitted events
      // The subscription is managed by leaving the room on the server side
      isSubscribedRef.current = false;
      log('Unsubscribed from queue updates');
    } catch (error) {
      log('Error unsubscribing from queue updates:', error);
    }
  }, [socket, log]);

  // Emit customer call event
  const emitCustomerCall = useCallback((customerId: number, counterName: string) => {
    if (!socket) {
      log('Cannot emit customer call - socket not available');
      return;
    }

    socket.emit('customer:call', { customerId, counterName });
    log(`Emitted customer call: ${customerId} to ${counterName}`);
  }, [socket, log]);

  // Emit counter status update
  const emitCounterStatus = useCallback((counterId: number, isActive: boolean) => {
    if (!socket) {
      log('Cannot emit counter status - socket not available');
      return;
    }

    socket.emit('counter:status', { counterId, isActive });
    log(`Emitted counter status: ${counterId} - ${isActive ? 'active' : 'inactive'}`);
  }, [socket, log]);

  // Attach/detach event handlers
  useEffect(() => {
    if (!socket) {
      return;
    }

    if (!handlersAttachedRef.current) {
      // Attach event handlers
      socket.on('queue:status_changed', handleQueueStatusChanged);
      socket.on('queue:update', handleQueueUpdate);
      socket.on('auth:error', handleAuthError);
      
      handlersAttachedRef.current = true;
      log('Event handlers attached');

      // Auto-subscribe when handlers are attached
      subscribe();
    }

    return () => {
      if (handlersAttachedRef.current) {
        // Detach event handlers
        socket.off('queue:status_changed', handleQueueStatusChanged);
        socket.off('queue:update', handleQueueUpdate);
        socket.off('auth:error', handleAuthError);
        
        handlersAttachedRef.current = false;
        isSubscribedRef.current = false;
        log('Event handlers detached');
      }
    };
  }, [socket, handleQueueStatusChanged, handleQueueUpdate, handleAuthError, subscribe, log]);

  return {
    isSubscribed: isSubscribedRef.current,
    lastEvent: lastEventRef.current,
    eventCount: eventCountRef.current,
    subscribe,
    unsubscribe,
    emitCustomerCall,
    emitCounterStatus
  };
};

export default useWebSocketQueue;
