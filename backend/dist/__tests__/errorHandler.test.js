"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const errorHandler_1 = require("../middleware/errorHandler");
// Mock Express Response
const mockResponse = () => {
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    };
    return res;
};
// Mock Express Request
const mockRequest = () => {
    return {};
};
// Mock Next Function
const mockNext = jest.fn();
describe('AuthError Class', () => {
    test('should create AuthError with correct properties', () => {
        const error = new errorHandler_1.AuthError('TEST_CODE', 'Internal message', 'User message', 401);
        expect(error.name).toBe('AuthError');
        expect(error.code).toBe('TEST_CODE');
        expect(error.message).toBe('Internal message');
        expect(error.userMessage).toBe('User message');
        expect(error.statusCode).toBe(401);
    });
    test('should use default status code of 401', () => {
        const error = new errorHandler_1.AuthError('TEST_CODE', 'Internal message', 'User message');
        expect(error.statusCode).toBe(401);
    });
});
describe('AuthErrors Constants', () => {
    test('should have TOKEN_EXPIRED error with correct structure', () => {
        const error = errorHandler_1.AuthErrors.TOKEN_EXPIRED;
        expect(error.code).toBe('TOKEN_EXPIRED');
        expect(error.userMessage).toBe('Your session has expired');
        expect(error.statusCode).toBe(401);
    });
    test('should have TOKEN_MISSING error with correct structure', () => {
        const error = errorHandler_1.AuthErrors.TOKEN_MISSING;
        expect(error.code).toBe('TOKEN_MISSING');
        expect(error.userMessage).toBe('Authentication token is required');
        expect(error.statusCode).toBe(401);
    });
    test('should have INSUFFICIENT_PERMISSIONS error with correct structure', () => {
        const error = errorHandler_1.AuthErrors.INSUFFICIENT_PERMISSIONS;
        expect(error.code).toBe('INSUFFICIENT_PERMISSIONS');
        expect(error.userMessage).toBe('You do not have permission to access this resource');
        expect(error.statusCode).toBe(403);
    });
});
describe('createAuthError', () => {
    test('should create a new AuthError instance', () => {
        const newError = (0, errorHandler_1.createAuthError)(errorHandler_1.AuthErrors.TOKEN_EXPIRED);
        expect(newError).toBeInstanceOf(errorHandler_1.AuthError);
        expect(newError.code).toBe('TOKEN_EXPIRED');
        expect(newError.userMessage).toBe('Your session has expired');
    });
});
describe('getJwtErrorType', () => {
    test('should return TOKEN_EXPIRED for jwt.TokenExpiredError', () => {
        const jwtError = new jsonwebtoken_1.default.TokenExpiredError('jwt expired', new Date());
        const authError = (0, errorHandler_1.getJwtErrorType)(jwtError);
        expect(authError).toBe(errorHandler_1.AuthErrors.TOKEN_EXPIRED);
    });
    test('should return TOKEN_INVALID for jwt.JsonWebTokenError', () => {
        const jwtError = new jsonwebtoken_1.default.JsonWebTokenError('invalid signature');
        const authError = (0, errorHandler_1.getJwtErrorType)(jwtError);
        expect(authError).toBe(errorHandler_1.AuthErrors.TOKEN_MALFORMED);
    });
    test('should return TOKEN_INVALID for jwt.NotBeforeError', () => {
        const jwtError = new jsonwebtoken_1.default.NotBeforeError('jwt not active', new Date());
        const authError = (0, errorHandler_1.getJwtErrorType)(jwtError);
        expect(authError).toBe(errorHandler_1.AuthErrors.TOKEN_INVALID);
    });
    test('should return TOKEN_INVALID for other errors', () => {
        const genericError = new Error('generic error');
        const authError = (0, errorHandler_1.getJwtErrorType)(genericError);
        expect(authError).toBe(errorHandler_1.AuthErrors.TOKEN_INVALID);
    });
});
describe('throwAuthError', () => {
    test('should throw AuthError', () => {
        expect(() => {
            (0, errorHandler_1.throwAuthError)(errorHandler_1.AuthErrors.TOKEN_EXPIRED);
        }).toThrow(errorHandler_1.AuthError);
    });
    test('should throw error with correct code', () => {
        try {
            (0, errorHandler_1.throwAuthError)(errorHandler_1.AuthErrors.TOKEN_EXPIRED);
        }
        catch (error) {
            expect(error instanceof errorHandler_1.AuthError).toBe(true);
            expect(error.code).toBe('TOKEN_EXPIRED');
        }
    });
});
describe('errorHandler', () => {
    let req;
    let res;
    let next;
    beforeEach(() => {
        req = mockRequest();
        res = mockResponse();
        next = mockNext;
        jest.clearAllMocks();
    });
    test('should handle AuthError and return correct JSON response', () => {
        const authError = new errorHandler_1.AuthError('TOKEN_EXPIRED', 'Token expired', 'Your session has expired', 401);
        (0, errorHandler_1.errorHandler)(authError, req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            error: {
                code: 'TOKEN_EXPIRED',
                message: 'Your session has expired'
            }
        });
    });
    test('should handle JWT TokenExpiredError', () => {
        const jwtError = new jsonwebtoken_1.default.TokenExpiredError('jwt expired', new Date());
        (0, errorHandler_1.errorHandler)(jwtError, req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            error: {
                code: 'TOKEN_EXPIRED',
                message: 'Your session has expired'
            }
        });
    });
    test('should handle JWT JsonWebTokenError', () => {
        const jwtError = new jsonwebtoken_1.default.JsonWebTokenError('invalid signature');
        (0, errorHandler_1.errorHandler)(jwtError, req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            error: {
                code: 'TOKEN_MALFORMED',
                message: 'Invalid token format'
            }
        });
    });
    test('should handle generic errors', () => {
        const genericError = new Error('Something went wrong');
        (0, errorHandler_1.errorHandler)(genericError, req, res, next);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: {
                code: 'INTERNAL_ERROR',
                message: 'An internal server error occurred'
            }
        });
    });
});
describe('asyncErrorHandler', () => {
    test('should catch and pass errors to next', async () => {
        const req = mockRequest();
        const res = mockResponse();
        const next = mockNext;
        const errorThrowingFunction = (0, errorHandler_1.asyncErrorHandler)(async (req, res, next) => {
            throw new Error('Test error');
        });
        await errorThrowingFunction(req, res, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
    test('should not call next() on success', async () => {
        const req = mockRequest();
        const res = mockResponse();
        const next = jest.fn();
        const successFunction = (0, errorHandler_1.asyncErrorHandler)(async (req, res, next) => {
            // Success case - no error thrown
            // Don't call next() - that's the middleware's responsibility
        });
        await successFunction(req, res, next);
        expect(next).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=errorHandler.test.js.map