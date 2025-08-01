"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.getSecureConfig = getSecureConfig;
const secretsManager_1 = require("../services/secretsManager");
// Initialize secrets manager
secretsManager_1.secretsManager.initialize().catch(console.error);
// Non-sensitive configuration (safe to keep in environment variables)
exports.config = {
    PORT: process.env.PORT || 5000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    // JWT Token Settings (non-sensitive)
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30m', // Short-lived for security
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    // Token Security
    TOKEN_ROTATION_ENABLED: process.env.TOKEN_ROTATION_ENABLED !== 'false',
    REFRESH_TOKEN_COOKIE_NAME: 'refresh_token',
    ACCESS_TOKEN_BUFFER_TIME: 5 * 60 * 1000, // 5 minutes before expiry
    // CORS
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    // SMS Service (non-sensitive)
    SMS_API_URL: process.env.SMS_API_URL || '',
    SMS_FROM: process.env.SMS_FROM || 'EscaShop',
    SMS_PROVIDER: process.env.SMS_PROVIDER || 'twilio',
    SMS_API_KEY: process.env.SMS_API_KEY || '',
    // Email Service (non-sensitive)
    EMAIL_SERVICE_ENABLED: process.env.EMAIL_SERVICE_ENABLED === 'true',
    EMAIL_SERVICE: process.env.EMAIL_SERVICE || 'gmail',
    EMAIL_USER: process.env.EMAIL_USER || 'jefor16@gmail.com',
    EMAIL_FROM: process.env.EMAIL_FROM || 'jefor16@gmail.com',
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || '',
    // Google Sheets Integration (non-sensitive)
    GOOGLE_SHEETS_SPREADSHEET_ID: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '1EQoJp1fjxMJc3L54JA5hKWHkm-K36vg81YyPv4cCIBE',
    GOOGLE_SHEETS_URL: process.env.GOOGLE_SHEETS_URL || '',
    // File Upload
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB
    UPLOAD_PATH: process.env.UPLOAD_PATH || './uploads',
    // Session
    SESSION_TIMEOUT: parseInt(process.env.SESSION_TIMEOUT || '600000'), // 10 minutes in ms
    // Pagination
    DEFAULT_PAGE_SIZE: parseInt(process.env.DEFAULT_PAGE_SIZE || '20'),
    MAX_PAGE_SIZE: parseInt(process.env.MAX_PAGE_SIZE || '100'),
    // Queue Management
    AVERAGE_SERVICE_TIME: parseInt(process.env.AVERAGE_SERVICE_TIME || '15'), // minutes
    PRIORITY_BOOST: parseInt(process.env.PRIORITY_BOOST || '1000'), // priority score boost
    // Rate Limiting
    RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    // Security
    PASSWORD_MIN_LENGTH: parseInt(process.env.PASSWORD_MIN_LENGTH || '8'),
    // JWT Secrets (for backward compatibility)
    JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production',
    // Backup
    BACKUP_RETENTION_DAYS: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    LOG_FILE: process.env.LOG_FILE || './logs/app.log',
    // Twilio Configuration (non-sensitive)
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',
    // Clicksend Configuration (non-sensitive)
    CLICKSEND_USERNAME: process.env.CLICKSEND_USERNAME || '',
    // Vonage Configuration (non-sensitive)
    VONAGE_API_KEY: process.env.VONAGE_API_KEY || '',
    // Feature Flags
    ENABLE_UNIQUE_SETTLEMENT_INDEX: process.env.ENABLE_UNIQUE_SETTLEMENT_INDEX !== 'false',
    ENABLE_SETTLEMENT_TRACING: process.env.ENABLE_SETTLEMENT_TRACING !== 'false',
    ENABLE_SETTLEMENT_MONITORING: process.env.ENABLE_SETTLEMENT_MONITORING !== 'false'
};
// Async function to get sensitive configuration from vault
async function getSecureConfig() {
    return {
        // Database (sensitive)
        DATABASE_URL: await secretsManager_1.secretsManager.getSecret('DATABASE_URL') || 'postgresql://localhost:5432/escashop',
        // JWT Secrets (sensitive)
        JWT_SECRET: await secretsManager_1.secretsManager.getSecret('JWT_SECRET') || 'your-super-secret-jwt-key-change-in-production',
        JWT_REFRESH_SECRET: await secretsManager_1.secretsManager.getSecret('JWT_REFRESH_SECRET') || 'your-super-secret-refresh-key-change-in-production',
        // API Keys (sensitive)
        SMS_API_KEY: await secretsManager_1.secretsManager.getSecret('SMS_API_KEY') || '',
        TWILIO_AUTH_TOKEN: await secretsManager_1.secretsManager.getSecret('TWILIO_AUTH_TOKEN') || '',
        CLICKSEND_API_KEY: await secretsManager_1.secretsManager.getSecret('CLICKSEND_API_KEY') || '',
        VONAGE_API_SECRET: await secretsManager_1.secretsManager.getSecret('VONAGE_API_SECRET') || '',
        // Email Password (sensitive)
        EMAIL_PASSWORD: await secretsManager_1.secretsManager.getSecret('EMAIL_PASSWORD') || '',
        // Google Sheets API Key (sensitive)
        GOOGLE_SHEETS_API_KEY: await secretsManager_1.secretsManager.getSecret('GOOGLE_SHEETS_API_KEY') || ''
    };
}
//# sourceMappingURL=config.js.map