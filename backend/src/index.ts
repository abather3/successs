// Must be imported before any other modules for proper instrumentation
// Development: Commenting out optional monitoring imports
// import * as Sentry from '@sentry/node';
// import tracer from 'dd-trace';
import 'dotenv/config';

// Initialize monitoring before anything else
// Development: Commenting out Sentry initialization
// Sentry.init({
//   dsn: process.env.SENTRY_DSN || '', // Set via environment variable
//   tracesSampleRate: 1.0, // Capture 100% of transactions
//   environment: process.env.NODE_ENV || 'development',
// });

// Initialize Datadog Tracer
// Development: Commenting out Datadog tracer
// tracer.init({
//   service: 'escashop-backend',
//   env: process.env.NODE_ENV || 'development',
// });

// Configure Express tracing
// tracer.use('express', {
//   service: 'escashop-express',
// });

// Configure PostgreSQL tracing
// tracer.use('pg', {
//   service: 'escashop-postgres',
// });

// Note: Socket.IO tracing is handled automatically by DataDog

// Now import other modules
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config/config';
import { generalLimiter, sensitiveLimiter, burstLimiter } from './middleware/rateLimiter';
import { connectDatabase, initializeDatabase } from './config/database';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import customerRoutes from './routes/customers';
import queueRoutes from './routes/queue';
import transactionRoutes from './routes/transactions';
import adminRoutes from './routes/admin';
import analyticsRoutes from './routes/analytics';
import smsRoutes from './routes/sms';
import settingsRoutes from './routes/settings';
import customerNotificationRoutes from './routes/customerNotifications'; // ISOLATED: Separate from queue
import schedulerRoutes from './routes/scheduler';
import { authenticateToken } from './middleware/auth';
import { setupWebSocketHandlers } from './services/websocket';
import { errorHandler } from './middleware/errorHandler';
import { DailyQueueScheduler } from './services/DailyQueueScheduler';
import { monitoringService } from './services/monitoring';
import { enhancedRollbackSystem } from './services/enhancedRollback';

const app: express.Application = express();
const server = createServer(app);

// Parse comma-separated FRONTEND_URL and define allowed origins
const frontendUrls = (config.FRONTEND_URL || 'http://localhost:3000').split(',').map(url => url.trim());
const allowedOrigins = [
  ...frontendUrls,
  'http://localhost',
  'http://localhost:80',
  'http://127.0.0.1:3000',
  'http://127.0.0.1'
];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, etc.)
      if (!origin) return callback(null, true);
      
      // Use same allowed origins as Express CORS
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      console.log(`🚫 Socket.IO CORS blocked origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'), false);
    },
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Trust proxy configuration for rate limiter
// Option 1: For development/localhost only
if (process.env.NODE_ENV === 'development') {
  app.set('trust proxy', 'loopback');
} else {
  // Option 2: For production - specify your proxy/load balancer IP
  // app.set('trust proxy', ['127.0.0.1', '::1', 'your-load-balancer-ip']);
  // Option 3: For cloud platforms (Heroku, Railway, etc.)
  app.set('trust proxy', 1); // Trust first proxy
}

// Middleware
app.use(monitoringService.createAPIMonitoringMiddleware());
app.use(generalLimiter);

// CORS configuration that handles nginx proxy correctly
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Log unauthorized origin for debugging
    console.log(`🚫 CORS blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept'],
  optionsSuccessStatus: 200
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Monitoring dashboard endpoint
app.get('/api/monitoring/dashboard', async (req, res) => {
  try {
    const healthStatus = await monitoringService.getHealthStatus();
    res.json(healthStatus);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get monitoring status' });
  }
});

// Rollback system status endpoint
app.get('/api/monitoring/rollback/status', (req, res) => {
  try {
    const status = enhancedRollbackSystem.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get rollback status' });
  }
});

// Manual rollback trigger endpoint (admin only)
app.post('/api/monitoring/rollback/trigger', authenticateToken, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: 'Rollback reason is required' });
    }
    
    await enhancedRollbackSystem.manualRollback(reason);
    res.json({ message: 'Manual rollback initiated', reason });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Add general API logging middleware before routes
app.use('/api', (req, res, next) => {
  console.log(`API Request: ${req.method} ${req.originalUrl}`);
  console.log(`API Path: ${req.path}`);
  console.log(`API Auth Header: ${req.headers.authorization ? 'Present' : 'Missing'}`);
  next();
});

// Sensitive routes with stricter limits
app.use('/api/auth/login', sensitiveLimiter);
app.use('/api/auth/password-reset', sensitiveLimiter);
app.use('/api/auth/request-password-reset', sensitiveLimiter);
app.use('/api/auth/reset-password', burstLimiter);
app.use('/api/transactions/checkout', sensitiveLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/customers', authenticateToken, customerRoutes);
app.use('/api/queue', authenticateToken, queueRoutes);
app.use('/api/transactions', authenticateToken, transactionRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);
app.use('/api/sms', authenticateToken, smsRoutes);
app.use('/api/settings', authenticateToken, settingsRoutes);
app.use('/api/customer-notifications', authenticateToken, customerNotificationRoutes); // ISOLATED: Separate from queue/SMS
app.use('/api/scheduler', authenticateToken, schedulerRoutes);

// Global error handler middleware - must be added after all routes
app.use(errorHandler);

// WebSocket setup
setupWebSocketHandlers(io);

// Make io available globally
app.set('io', io);

// Import and set WebSocket service
const { WebSocketService } = require('./services/websocket');
WebSocketService.setIO(io);

const PORT = config.PORT || 5000;

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  // Stop the scheduler gracefully
  try {
    DailyQueueScheduler.stop();
    console.log('Daily Queue Scheduler stopped');
  } catch (error) {
    console.error('Error stopping scheduler:', error);
  }
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  
  // Stop the scheduler gracefully
  try {
    DailyQueueScheduler.stop();
    console.log('Daily Queue Scheduler stopped');
  } catch (error) {
    console.error('Error stopping scheduler:', error);
  }
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  server.close(() => {
    process.exit(1);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  server.close(() => {
    process.exit(1);
  });
});

async function startServer() {
  try {
    await connectDatabase();
    console.log('Database connected successfully');
    
    // Initialize database tables
    await initializeDatabase();
    
    // Initialize Daily Queue Scheduler
    try {
      DailyQueueScheduler.initialize();
      console.log('✅ Daily Queue Scheduler initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Daily Queue Scheduler:', error);
      // Continue without scheduler rather than crashing the server
    }
    
    // Start alert checking interval
    setInterval(() => {
      monitoringService.checkAlertThresholds();
    }, 60000); // Check every minute
    
    // Start rollback trigger checking
    // DISABLED: Temporarily disabled due to development environment issues
    // setInterval(() => {
    //   enhancedRollbackSystem.checkRollbackTriggers();
    // }, 30000); // Check every 30 seconds
    
    // Check if port is available before starting
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('📊 Monitoring and alerting system active');
    });
    
    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please kill the existing process or use a different port.`);
        console.error('You can kill the process using: taskkill /PID <PID> /F (on Windows) or kill -9 <PID> (on Linux/Mac)');
        process.exit(1);
      } else {
        console.error('Server error:', error);
        process.exit(1);
      }
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
