"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.burstLimiter = exports.apiLimiter = exports.sensitiveLimiter = exports.generalLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Custom key generator that handles proxy scenarios securely
const secureKeyGenerator = (req) => {
    // In development, use the connection IP
    if (process.env.NODE_ENV === 'development') {
        return req.socket.remoteAddress || 'unknown';
    }
    // In production, use the first trusted proxy IP or fallback to connection IP
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded && typeof forwarded === 'string') {
        // Take only the first IP from the forwarded chain
        const firstIp = forwarded.split(',')[0].trim();
        return firstIp || req.socket.remoteAddress || 'unknown';
    }
    return req.socket.remoteAddress || 'unknown';
};
// Check if we're in development
const isDevelopment = process.env.NODE_ENV === 'development';
// Development-friendly rate limiting
const DEV_MULTIPLIER = isDevelopment ? 10 : 1;
const DEV_WINDOW = isDevelopment ? 1 * 60 * 1000 : 15 * 60 * 1000; // 1 min in dev, 15 min in prod
// General rate limiter for all endpoints
exports.generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: DEV_WINDOW, // 1 min in dev, 15 min in prod
    max: 100 * DEV_MULTIPLIER, // 1000 in dev, 100 in prod
    message: {
        error: 'Too many requests, please try again later.',
        retryAfter: isDevelopment ? '1 minute' : '15 minutes'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many requests, please try again later.',
            retryAfter: isDevelopment ? 60 : 900 // 1 min in dev, 15 min in prod
        });
    }
});
// Sensitive endpoints limiter (login, password reset, checkout, etc.)
exports.sensitiveLimiter = (0, express_rate_limit_1.default)({
    windowMs: DEV_WINDOW, // 1 min in dev, 15 min in prod
    max: 5 * DEV_MULTIPLIER, // 50 in dev, 5 in prod
    message: {
        error: 'Too many attempts, please try again later.',
        retryAfter: isDevelopment ? '1 minute' : '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many attempts, please try again later.',
            retryAfter: isDevelopment ? 60 : 900 // 1 min in dev, 15 min in prod
        });
    }
});
// API key/token based limiter (for authenticated requests)
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Higher limit for authenticated users
    message: {
        error: 'API rate limit exceeded.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'API rate limit exceeded.',
            retryAfter: 900 // 15 minutes
        });
    }
});
// Burst protection for very sensitive operations
exports.burstLimiter = (0, express_rate_limit_1.default)({
    windowMs: isDevelopment ? 30 * 1000 : 60 * 1000, // 30 sec in dev, 1 min in prod
    max: 3 * DEV_MULTIPLIER, // 30 in dev, 3 in prod
    message: {
        error: 'Too many requests in a short time, please wait.',
        retryAfter: isDevelopment ? '30 seconds' : '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many requests in a short time, please wait.',
            retryAfter: isDevelopment ? 30 : 60 // 30 sec in dev, 1 min in prod
        });
    }
});
exports.default = {
    generalLimiter: exports.generalLimiter,
    sensitiveLimiter: exports.sensitiveLimiter,
    apiLimiter: exports.apiLimiter,
    burstLimiter: exports.burstLimiter
};
//# sourceMappingURL=rateLimiter.js.map