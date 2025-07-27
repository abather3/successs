import { Request, Response } from 'express';
import { AuthRequest, UserRole } from '../../types';

// Mock the entire middleware/errorHandler module
jest.mock('../../middleware/errorHandler', () => ({
  AuthErrors: {
    TOKEN_MISSING: new Error('TOKEN_MISSING'),
    INSUFFICIENT_PERMISSIONS: new Error('INSUFFICIENT_PERMISSIONS')
  },
  throwAuthError: (error: any) => {
    throw error;
  },
  asyncErrorHandler: (fn: any) => fn
}));

// Import after mocking
import { 
  requireProcessingView, 
  requireServeToProcessing, 
  requireForcedTransitions 
} from '../../middleware/auth';

describe('RBAC Queue Middleware Tests', () => {
  let req: Partial<AuthRequest>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('requireProcessingView', () => {
    const middleware = requireProcessingView;

    it('should allow Admin to view processing items', async () => {
      req.user = { id: 1, role: UserRole.ADMIN, email: 'admin@test.com' } as any;

      await middleware(req as AuthRequest, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow Sales to view processing items', async () => {
      req.user = { id: 2, role: UserRole.SALES, email: 'sales@test.com' } as any;

      await middleware(req as AuthRequest, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow Cashier to view processing items', async () => {
      req.user = { id: 3, role: UserRole.CASHIER, email: 'cashier@test.com' } as any;

      await middleware(req as AuthRequest, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow Super Admin to view processing items', async () => {
      req.user = { id: 4, role: UserRole.SUPER_ADMIN, email: 'super@test.com' } as any;

      await middleware(req as AuthRequest, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject unauthorized roles', async () => {
      req.user = { id: 5, role: 'unknown_role' as any, email: 'unknown@test.com' } as any;

      await expect(middleware(req as AuthRequest, res as Response, next))
        .rejects.toThrow();

      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireServeToProcessing', () => {
    const middleware = requireServeToProcessing;

    it('should allow Admin for Serve → Processing transitions', async () => {
      req.user = { id: 1, role: UserRole.ADMIN, email: 'admin@test.com' } as any;

      await middleware(req as AuthRequest, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow Cashier for Serve → Processing transitions', async () => {
      req.user = { id: 3, role: UserRole.CASHIER, email: 'cashier@test.com' } as any;

      await middleware(req as AuthRequest, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow Super Admin for Serve → Processing transitions', async () => {
      req.user = { id: 4, role: UserRole.SUPER_ADMIN, email: 'super@test.com' } as any;

      await middleware(req as AuthRequest, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject Sales role for Serve → Processing transitions', async () => {
      req.user = { id: 2, role: UserRole.SALES, email: 'sales@test.com' } as any;

      await expect(middleware(req as AuthRequest, res as Response, next))
        .rejects.toThrow();

      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireForcedTransitions', () => {
    const middleware = requireForcedTransitions;

    it('should allow Admin for forced status transitions', async () => {
      req.user = { id: 1, role: UserRole.ADMIN, email: 'admin@test.com' } as any;

      await middleware(req as AuthRequest, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow Super Admin for forced status transitions', async () => {
      req.user = { id: 4, role: UserRole.SUPER_ADMIN, email: 'super@test.com' } as any;

      await middleware(req as AuthRequest, res as Response, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject Sales role for forced transitions', async () => {
      req.user = { id: 2, role: UserRole.SALES, email: 'sales@test.com' } as any;

      await expect(middleware(req as AuthRequest, res as Response, next))
        .rejects.toThrow();

      expect(next).not.toHaveBeenCalled();
    });

    it('should reject Cashier role for forced transitions', async () => {
      req.user = { id: 3, role: UserRole.CASHIER, email: 'cashier@test.com' } as any;

      await expect(middleware(req as AuthRequest, res as Response, next))
        .rejects.toThrow();

      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Missing user scenarios', () => {
    it('should reject requests without user for all middlewares', async () => {
      req.user = undefined;

      await expect(requireProcessingView(req as AuthRequest, res as Response, next))
        .rejects.toThrow();
        
      await expect(requireServeToProcessing(req as AuthRequest, res as Response, next))
        .rejects.toThrow();
        
      await expect(requireForcedTransitions(req as AuthRequest, res as Response, next))
        .rejects.toThrow();

      expect(next).not.toHaveBeenCalled();
    });
  });
});
