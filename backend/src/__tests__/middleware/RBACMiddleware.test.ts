import { requireRole } from '../../middleware/auth';
import { UserRole } from '../../types';
import { Request, Response, NextFunction } from 'express';

describe('RBAC Middleware Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction = jest.fn();

  beforeEach(() => {
    mockRequest = {
      user: {
        id: 1,
        email: 'test@user.com',
        full_name: 'Test User',
        role: UserRole.CASHIER,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      }
    };
    mockResponse = {};
  });

  it('should allow access with correct role', async () => {
    requireRole([UserRole.CASHIER])(mockRequest as Request, mockResponse as Response, nextFunction);
    expect(nextFunction).toBeCalled();
  });

  it('should deny access with incorrect role', async () => {
    requireRole([UserRole.ADMIN])(mockRequest as Request, mockResponse as Response, nextFunction);
    expect(nextFunction).not.toBeCalled();
  });
});
