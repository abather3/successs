"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_EXPIRES_IN = '30m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.PASSWORD_MIN_LENGTH = '8';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
// Mock database connection
jest.mock('../config/database', () => ({
    pool: {
        query: jest.fn(),
        connect: jest.fn(),
        end: jest.fn()
    },
    connectDatabase: jest.fn()
}));
// Mock services
jest.mock('../services/user', () => ({
    UserService: {
        findById: jest.fn(),
        validatePassword: jest.fn(),
        create: jest.fn(),
        updatePassword: jest.fn(),
        requestPasswordReset: jest.fn(),
        resetPasswordWithToken: jest.fn(),
        triggerPasswordReset: jest.fn(),
        list: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
    }
}));
jest.mock('../services/customer', () => ({
    CustomerService: {
        create: jest.fn(),
        findById: jest.fn(),
        findByOrNumber: jest.fn(),
        list: jest.fn(),
        update: jest.fn(),
        updateStatus: jest.fn(),
        delete: jest.fn(),
        getQueueStatistics: jest.fn(),
        estimatedTimeToMinutes: jest.fn()
    }
}));
jest.mock('../services/activity', () => ({
    ActivityService: {
        log: jest.fn()
    }
}));
jest.mock('../services/notification', () => ({
    NotificationService: {
        sendCustomerReadyNotification: jest.fn(),
        sendDelayNotification: jest.fn(),
        sendPickupReminder: jest.fn(),
        sendSMS: jest.fn()
    }
}));
// Global test timeout
jest.setTimeout(30000);
//# sourceMappingURL=setup.js.map