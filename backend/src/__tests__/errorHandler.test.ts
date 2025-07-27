import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { 
  AuthError, 
  AuthErrors, 
  errorHandler, 
  throwAuthError, 
  createAuthError, 
  getJwtErrorType,
  asyncErrorHandler 
} from '../middleware/errorHandler';

// Mock Express Response
const mockResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
};

// Mock Express Request
const mockRequest = () => {
  return {} as Request;
};

// Mock Next Function
const mockNext = jest.fn() as NextFunction;

describe('AuthError Class', () => {
  test('should create AuthError with correct properties', () => {
    const error = new AuthError('TEST_CODE', 'Internal message', 'User message', 401);
    
    expect(error.name).toBe('AuthError');
    expect(error.code).toBe('TEST_CODE');
    expect(error.message).toBe('Internal message');
    expect(error.userMessage).toBe('User message');
    expect(error.statusCode).toBe(401);
  });

  test('should use default status code of 401', () => {
    const error = new AuthError('TEST_CODE', 'Internal message', 'User message');
    expect(error.statusCode).toBe(401);
  });
});

describe('AuthErrors Constants', () => {
  test('should have TOKEN_EXPIRED error with correct structure', () => {
    const error = AuthErrors.TOKEN_EXPIRED;
    expect(error.code).toBe('TOKEN_EXPIRED');
    expect(error.userMessage).toBe('Your session has expired');
    expect(error.statusCode).toBe(401);
  });

  test('should have TOKEN_MISSING error with correct structure', () => {
    const error = AuthErrors.TOKEN_MISSING;
    expect(error.code).toBe('TOKEN_MISSING');
    expect(error.userMessage).toBe('Authentication token is required');
    expect(error.statusCode).toBe(401);
  });

  test('should have INSUFFICIENT_PERMISSIONS error with correct structure', () => {
    const error = AuthErrors.INSUFFICIENT_PERMISSIONS;
    expect(error.code).toBe('INSUFFICIENT_PERMISSIONS');
    expect(error.userMessage).toBe('You do not have permission to access this resource');
    expect(error.statusCode).toBe(403);
  });
});

describe('createAuthError', () => {
  test('should create a new AuthError instance', () => {
    const newError = createAuthError(AuthErrors.TOKEN_EXPIRED);
    
    expect(newError).toBeInstanceOf(AuthError);
    expect(newError.code).toBe('TOKEN_EXPIRED');
    expect(newError.userMessage).toBe('Your session has expired');
  });
});

describe('getJwtErrorType', () => {
  test('should return TOKEN_EXPIRED for jwt.TokenExpiredError', () => {
    const jwtError = new jwt.TokenExpiredError('jwt expired', new Date());
    const authError = getJwtErrorType(jwtError);
    
    expect(authError).toBe(AuthErrors.TOKEN_EXPIRED);
  });

  test('should return TOKEN_INVALID for jwt.JsonWebTokenError', () => {
    const jwtError = new jwt.JsonWebTokenError('invalid signature');
    const authError = getJwtErrorType(jwtError);
    
    expect(authError).toBe(AuthErrors.TOKEN_MALFORMED);
  });

  test('should return TOKEN_INVALID for jwt.NotBeforeError', () => {
    const jwtError = new jwt.NotBeforeError('jwt not active', new Date());
    const authError = getJwtErrorType(jwtError);
    
    expect(authError).toBe(AuthErrors.TOKEN_INVALID);
  });

  test('should return TOKEN_INVALID for other errors', () => {
    const genericError = new Error('generic error');
    const authError = getJwtErrorType(genericError);
    
    expect(authError).toBe(AuthErrors.TOKEN_INVALID);
  });
});

describe('throwAuthError', () => {
  test('should throw AuthError', () => {
    expect(() => {
      throwAuthError(AuthErrors.TOKEN_EXPIRED);
    }).toThrow(AuthError);
  });

  test('should throw error with correct code', () => {
    try {
      throwAuthError(AuthErrors.TOKEN_EXPIRED);
    } catch (error) {
      expect(error instanceof AuthError).toBe(true);
      expect((error as AuthError).code).toBe('TOKEN_EXPIRED');
    }
  });
});

describe('errorHandler', () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = mockNext;
    jest.clearAllMocks();
  });

  test('should handle AuthError and return correct JSON response', () => {
    const authError = new AuthError('TOKEN_EXPIRED', 'Token expired', 'Your session has expired', 401);
    
    errorHandler(authError, req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Your session has expired'
      }
    });
  });

  test('should handle JWT TokenExpiredError', () => {
    const jwtError = new jwt.TokenExpiredError('jwt expired', new Date());
    
    errorHandler(jwtError, req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Your session has expired'
      }
    });
  });

  test('should handle JWT JsonWebTokenError', () => {
    const jwtError = new jwt.JsonWebTokenError('invalid signature');
    
    errorHandler(jwtError, req, res, next);
    
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
    
    errorHandler(genericError, req, res, next);
    
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
    
    const errorThrowingFunction = asyncErrorHandler(async (req, res, next) => {
      throw new Error('Test error');
    });
    
    await errorThrowingFunction(req, res, next);
    
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  test('should not call next() on success', async () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = jest.fn();
    
    const successFunction = asyncErrorHandler(async (req, res, next) => {
      // Success case - no error thrown
      // Don't call next() - that's the middleware's responsibility
    });
    
    await successFunction(req, res, next);
    
    expect(next).not.toHaveBeenCalled();
  });
});
