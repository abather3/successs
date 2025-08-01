"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Must be imported before any other modules for proper instrumentation
// Development: Commenting out optional monitoring imports
// import * as Sentry from '@sentry/node';
// import tracer from 'dd-trace';
require("dotenv/config");
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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const config_1 = require("./config/config");
const rateLimiter_1 = require("./middleware/rateLimiter");
const database_1 = require("./config/database");
const auth_1 = __importDefault(require("./routes/auth"));
const users_1 = __importDefault(require("./routes/users"));
const customers_1 = __importDefault(require("./routes/customers"));
const queue_1 = __importDefault(require("./routes/queue"));
const transactions_1 = __importDefault(require("./routes/transactions"));
const admin_1 = __importDefault(require("./routes/admin"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const sms_1 = __importDefault(require("./routes/sms"));
const settings_1 = __importDefault(require("./routes/settings"));
const customerNotifications_1 = __importDefault(require("./routes/customerNotifications")); // ISOLATED: Separate from queue
const scheduler_1 = __importDefault(require("./routes/scheduler"));
const auth_2 = require("./middleware/auth");
const websocket_1 = require("./services/websocket");
const errorHandler_1 = require("./middleware/errorHandler");
const DailyQueueScheduler_1 = require("./services/DailyQueueScheduler");
const monitoring_1 = require("./services/monitoring");
const enhancedRollback_1 = require("./services/enhancedRollback");
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
// Parse comma-separated FRONTEND_URL and define allowed origins
const frontendUrls = (config_1.config.FRONTEND_URL || 'http://localhost:3000').split(',').map(url => url.trim());
const allowedOrigins = [
    ...frontendUrls,
    'http://localhost',
    'http://localhost:80',
    'http://127.0.0.1:3000',
    'http://127.0.0.1'
];
const io = new socket_io_1.Server(server, {
    cors: {
        origin: (origin, callback) => {
            // Allow requests with no origin (mobile apps, etc.)
            if (!origin)
                return callback(null, true);
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
}
else {
    // Option 2: For production - specify your proxy/load balancer IP
    // app.set('trust proxy', ['127.0.0.1', '::1', 'your-load-balancer-ip']);
    // Option 3: For cloud platforms (Heroku, Railway, etc.)
    app.set('trust proxy', 1); // Trust first proxy
}
// Middleware
app.use(monitoring_1.monitoringService.createAPIMonitoringMiddleware());
app.use(rateLimiter_1.generalLimiter);
// CORS configuration that handles nginx proxy correctly
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin)
            return callback(null, true);
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
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
// Monitoring dashboard endpoint
app.get('/api/monitoring/dashboard', async (req, res) => {
    try {
        const healthStatus = await monitoring_1.monitoringService.getHealthStatus();
        res.json(healthStatus);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get monitoring status' });
    }
});
// Rollback system status endpoint
app.get('/api/monitoring/rollback/status', (req, res) => {
    try {
        const status = enhancedRollback_1.enhancedRollbackSystem.getStatus();
        res.json(status);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to get rollback status' });
    }
});
// Manual rollback trigger endpoint (admin only)
app.post('/api/monitoring/rollback/trigger', auth_2.authenticateToken, async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason) {
            return res.status(400).json({ error: 'Rollback reason is required' });
        }
        await enhancedRollback_1.enhancedRollbackSystem.manualRollback(reason);
        res.json({ message: 'Manual rollback initiated', reason });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
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
app.use('/api/auth/login', rateLimiter_1.sensitiveLimiter);
app.use('/api/auth/password-reset', rateLimiter_1.sensitiveLimiter);
app.use('/api/auth/request-password-reset', rateLimiter_1.sensitiveLimiter);
app.use('/api/auth/reset-password', rateLimiter_1.burstLimiter);
app.use('/api/transactions/checkout', rateLimiter_1.sensitiveLimiter);
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/users', auth_2.authenticateToken, users_1.default);
app.use('/api/customers', auth_2.authenticateToken, customers_1.default);
app.use('/api/queue', auth_2.authenticateToken, queue_1.default);
app.use('/api/transactions', auth_2.authenticateToken, transactions_1.default);
app.use('/api/admin', auth_2.authenticateToken, admin_1.default);
app.use('/api/analytics', auth_2.authenticateToken, analytics_1.default);
app.use('/api/sms', auth_2.authenticateToken, sms_1.default);
app.use('/api/settings', auth_2.authenticateToken, settings_1.default);
app.use('/api/customer-notifications', auth_2.authenticateToken, customerNotifications_1.default); // ISOLATED: Separate from queue/SMS
app.use('/api/scheduler', auth_2.authenticateToken, scheduler_1.default);
// Global error handler middleware - must be added after all routes
app.use(errorHandler_1.errorHandler);
// WebSocket setup
(0, websocket_1.setupWebSocketHandlers)(io);
// Make io available globally
app.set('io', io);
// Import and set WebSocket service
const { WebSocketService } = require('./services/websocket');
WebSocketService.setIO(io);
const PORT = config_1.config.PORT || 5000;
// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    // Stop the scheduler gracefully
    try {
        DailyQueueScheduler_1.DailyQueueScheduler.stop();
        console.log('Daily Queue Scheduler stopped');
    }
    catch (error) {
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
        DailyQueueScheduler_1.DailyQueueScheduler.stop();
        console.log('Daily Queue Scheduler stopped');
    }
    catch (error) {
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
        await (0, database_1.connectDatabase)();
        console.log('Database connected successfully');
        // Initialize database tables
        await (0, database_1.initializeDatabase)();
        // Initialize Daily Queue Scheduler
        try {
            DailyQueueScheduler_1.DailyQueueScheduler.initialize();
            console.log('✅ Daily Queue Scheduler initialized successfully');
        }
        catch (error) {
            console.error('❌ Failed to initialize Daily Queue Scheduler:', error);
            // Continue without scheduler rather than crashing the server
        }
        // Start alert checking interval
        setInterval(() => {
            monitoring_1.monitoringService.checkAlertThresholds();
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
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${PORT} is already in use. Please kill the existing process or use a different port.`);
                console.error('You can kill the process using: taskkill /PID <PID> /F (on Windows) or kill -9 <PID> (on Linux/Mac)');
                process.exit(1);
            }
            else {
                console.error('Server error:', error);
                process.exit(1);
            }
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
exports.default = app;
//# sourceMappingURL=index.js.map