import { Request, Response, NextFunction } from 'express';
type ValidationChain = any;
type Schema = any;
/**
 * Centralized validation middleware that handles validation errors
 * and provides consistent error responses
 */
export declare const handleValidationErrors: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Creates a validation middleware that runs validation chains and handles errors
 */
export declare const validate: (validations: ValidationChain[]) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Creates a validation middleware using schema-based validation
 */
export declare const validateSchema: (schema: Schema) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Sanitizes and validates request data before processing
 * This ensures all incoming data is properly cleaned and validated
 */
export declare class ValidationService {
    /**
     * Common validation patterns
     */
    static readonly PATTERNS: {
        EMAIL: RegExp;
        PHONE: RegExp;
        OR_NUMBER: RegExp;
        STRONG_PASSWORD: RegExp;
    };
    /**
     * Validates email format
     */
    static isValidEmail(email: string): boolean;
    /**
     * Validates phone number format
     */
    static isValidPhone(phone: string): boolean;
    /**
     * Validates OR number format
     */
    static isValidORNumber(orNumber: string): boolean;
    /**
     * Validates strong password requirements
     */
    static isValidStrongPassword(password: string): boolean;
    /**
     * Sanitizes string input by trimming and removing dangerous characters
     */
    static sanitizeString(input: string): string;
    /**
     * Validates and sanitizes integer input
     */
    static sanitizeInteger(input: any): number | null;
    /**
     * Validates and sanitizes float input
     */
    static sanitizeFloat(input: any): number | null;
    /**
     * Validates enum values
     */
    static isValidEnum<T>(value: any, enumObject: Record<string, T>): boolean;
}
export {};
//# sourceMappingURL=validation.d.ts.map