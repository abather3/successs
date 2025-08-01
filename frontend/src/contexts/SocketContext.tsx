import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  subscribeToQueue: () => void;
  unsubscribeFromQueue: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { accessToken, logout } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (accessToken) {
      // Determine socket URL based on environment and API configuration
      let socketUrl: string;
      
      if (process.env.REACT_APP_WS_URL) {
        // Use explicit WebSocket URL if provided
        socketUrl = process.env.REACT_APP_WS_URL;
      } else if (process.env.REACT_APP_API_URL === '/api') {
        // If using nginx proxy (API URL is /api), connect to current host
        socketUrl = `${window.location.protocol}//${window.location.host}`;
      } else {
        // Default to localhost:5000 for direct container access
        socketUrl = 'http://localhost:5000';
      }
      
      const newSocket = io(socketUrl, {
        // Disable auto connect - we'll connect manually after token is available
        autoConnect: false,
        auth: {
          token: accessToken,
        },
        // Configure reconnection with sane values
        reconnectionAttempts: 5,
        reconnectionDelay: 3000,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
        timeout: 20000
      });

      // Handle connection errors with enhanced logging
      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        
        // Distinguish between token expiration and network errors
        if (error.message && (
          error.message.includes('Authentication token required') ||
          error.message.includes('Invalid token') ||
          error.message.includes('TOKEN_EXPIRED') ||
          error.message.includes('TOKEN_INVALID')
        )) {
          console.warn('WebSocket connection failed due to token expiration/invalidity');
          // Token is expired or invalid - trigger logout
          logout();
        } else {
          console.warn('WebSocket connection failed due to network error:', error.message);
        }
      });

      newSocket.on('disconnect', (reason, details) => {
        console.log('Socket disconnected:', reason, details);
        
        // Enhanced disconnect logging
        if (details) {
          console.log('Disconnect details:', details);
        }
      });

      newSocket.on('connect', () => {
        console.log('Socket connected successfully');
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log(`Socket reconnected after ${attemptNumber} attempts`);
      });

      newSocket.on('reconnect_failed', () => {
        console.error('Socket reconnection failed after all attempts');
      });

      // Store reference for cleanup
      socketRef.current = newSocket;
      setSocket(newSocket);

      // Connect after socket is configured
      newSocket.connect();

      // Clean up connection on unmount
      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      };
    } else {
      // Close socket if no token and explicitly disconnect
      if (socketRef.current) {
        console.log('Disconnecting socket due to logout');
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
    }
  }, [accessToken, logout]);

  const subscribeToQueue = () => {
    socket?.emit('subscribe:queue');
  };

  const unsubscribeFromQueue = () => {
    socket?.emit('unsubscribe:queue');
  };

  const value: SocketContextType = {
    socket,
    subscribeToQueue,
    unsubscribeFromQueue,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

