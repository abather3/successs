"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationService = exports.validateSchema = exports.validate = exports.handleValidationErrors = void 0;
const { validationResult, checkSchema } = require('express-validator');
/**
 * Centralized validation middleware that handles validation errors
 * and provides consistent error responses
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map((error) => ({
            field: error.path || error.param,
            message: error.msg || error.message,
            value: error.value,
            location: error.location
        }));
        res.status(400).json({
            error: 'Validation failed',
            details: formattedErrors
        });
        return;
    }
    next();
};
exports.handleValidationErrors = handleValidationErrors;
/**
 * Creates a validation middleware that runs validation chains and handles errors
 */
const validate = (validations) => {
    return async (req, res, next) => {
        // Run all validations in parallel
        await Promise.all(validations.map(validation => validation.run(req)));
        // Check for validation errors
        (0, exports.handleValidationErrors)(req, res, next);
    };
};
exports.validate = validate;
/**
 * Creates a validation middleware using schema-based validation
 */
const validateSchema = (schema) => {
    return async (req, res, next) => {
        // Run schema validation
        const validationChain = checkSchema(schema);
        await Promise.all(validationChain.map((validation) => validation.run(req)));
        // Check for validation errors
        (0, exports.handleValidationErrors)(req, res, next);
    };
};
exports.validateSchema = validateSchema;
/**
 * Sanitizes and validates request data before processing
 * This ensures all incoming data is properly cleaned and validated
 */
class ValidationService {
    /**
     * Validates email format
     */
    static isValidEmail(email) {
        return this.PATTERNS.EMAIL.test(email);
    }
    /**
     * Validates phone number format
     */
    static isValidPhone(phone) {
        return this.PATTERNS.PHONE.test(phone);
    }
    /**
     * Validates OR number format
     */
    static isValidORNumber(orNumber) {
        return this.PATTERNS.OR_NUMBER.test(orNumber);
    }
    /**
     * Validates strong password requirements
     */
    static isValidStrongPassword(password) {
        return this.PATTERNS.STRONG_PASSWORD.test(password);
    }
    /**
     * Sanitizes string input by trimming and removing dangerous characters
     */
    static sanitizeString(input) {
        if (!input)
            return '';
        return input.trim().replace(/[<>]/g, '');
    }
    /**
     * Validates and sanitizes integer input
     */
    static sanitizeInteger(input) {
        const num = parseInt(input, 10);
        return isNaN(num) ? null : num;
    }
    /**
     * Validates and sanitizes float input
     */
    static sanitizeFloat(input) {
        const num = parseFloat(input);
        return isNaN(num) ? null : num;
    }
    /**
     * Validates enum values
     */
    static isValidEnum(value, enumObject) {
        return Object.values(enumObject).includes(value);
    }
}
exports.ValidationService = ValidationService;
/**
 * Common validation patterns
 */
ValidationService.PATTERNS = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE: /^(\+\d{1,3}[- ]?)?\d{10,11}$/,
    OR_NUMBER: /^[A-Z0-9]{6,12}$/,
    STRONG_PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
};
//# sourceMappingURL=validation.js.map