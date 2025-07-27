import { Request, Response, NextFunction } from 'express';
const { validationResult, checkSchema } = require('express-validator');
type ValidationChain = any;
type Schema = any;

/**
 * Centralized validation middleware that handles validation errors
 * and provides consistent error responses
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error: any) => ({
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

/**
 * Creates a validation middleware that runs validation chains and handles errors
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations in parallel
    await Promise.all(validations.map(validation => validation.run(req)));
    
    // Check for validation errors
    handleValidationErrors(req, res, next);
  };
};

/**
 * Creates a validation middleware using schema-based validation
 */
export const validateSchema = (schema: Schema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run schema validation
    const validationChain = checkSchema(schema);
    await Promise.all(validationChain.map((validation: any) => validation.run(req)));
    
    // Check for validation errors
    handleValidationErrors(req, res, next);
  };
};

/**
 * Sanitizes and validates request data before processing
 * This ensures all incoming data is properly cleaned and validated
 */
export class ValidationService {
  /**
   * Common validation patterns
   */
  static readonly PATTERNS = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE: /^(\+\d{1,3}[- ]?)?\d{10,11}$/,
    OR_NUMBER: /^[A-Z0-9]{6,12}$/,
    STRONG_PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
  };

  /**
   * Validates email format
   */
  static isValidEmail(email: string): boolean {
    return this.PATTERNS.EMAIL.test(email);
  }

  /**
   * Validates phone number format
   */
  static isValidPhone(phone: string): boolean {
    return this.PATTERNS.PHONE.test(phone);
  }

  /**
   * Validates OR number format
   */
  static isValidORNumber(orNumber: string): boolean {
    return this.PATTERNS.OR_NUMBER.test(orNumber);
  }

  /**
   * Validates strong password requirements
   */
  static isValidStrongPassword(password: string): boolean {
    return this.PATTERNS.STRONG_PASSWORD.test(password);
  }

  /**
   * Sanitizes string input by trimming and removing dangerous characters
   */
  static sanitizeString(input: string): string {
    if (!input) return '';
    return input.trim().replace(/[<>]/g, '');
  }

  /**
   * Validates and sanitizes integer input
   */
  static sanitizeInteger(input: any): number | null {
    const num = parseInt(input, 10);
    return isNaN(num) ? null : num;
  }

  /**
   * Validates and sanitizes float input
   */
  static sanitizeFloat(input: any): number | null {
    const num = parseFloat(input);
    return isNaN(num) ? null : num;
  }

  /**
   * Validates enum values
   */
  static isValidEnum<T>(value: any, enumObject: Record<string, T>): boolean {
    return Object.values(enumObject).includes(value);
  }
}
