"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("../../types");
// Mock the entire middleware/errorHandler module
jest.mock('../../middleware/errorHandler', () => ({
    AuthErrors: {
        TOKEN_MISSING: new Error('TOKEN_MISSING'),
        INSUFFICIENT_PERMISSIONS: new Error('INSUFFICIENT_PERMISSIONS')
    },
    throwAuthError: (error) => {
        throw error;
    },
    asyncErrorHandler: (fn) => fn
}));
// Import after mocking
const auth_1 = require("../../middleware/auth");
describe('RBAC Queue Middleware Tests', () => {
    let req;
    let res;
    let next;
    beforeEach(() => {
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        next = jest.fn();
    });
    describe('requireProcessingView', () => {
        const middleware = auth_1.requireProcessingView;
        it('should allow Admin to view processing items', async () => {
            req.user = { id: 1, role: types_1.UserRole.ADMIN, email: 'admin@test.com' };
            await middleware(req, res, next);
            expect(next).toHaveBeenCalledWith();
            expect(res.status).not.toHaveBeenCalled();
        });
        it('should allow Sales to view processing items', async () => {
            req.user = { id: 2, role: types_1.UserRole.SALES, email: 'sales@test.com' };
            await middleware(req, res, next);
            expect(next).toHaveBeenCalledWith();
            expect(res.status).not.toHaveBeenCalled();
        });
        it('should allow Cashier to view processing items', async () => {
            req.user = { id: 3, role: types_1.UserRole.CASHIER, email: 'cashier@test.com' };
            await middleware(req, res, next);
            expect(next).toHaveBeenCalledWith();
            expect(res.status).not.toHaveBeenCalled();
        });
        it('should allow Super Admin to view processing items', async () => {
            req.user = { id: 4, role: types_1.UserRole.SUPER_ADMIN, email: 'super@test.com' };
            await middleware(req, res, next);
            expect(next).toHaveBeenCalledWith();
            expect(res.status).not.toHaveBeenCalled();
        });
        it('should reject unauthorized roles', async () => {
            req.user = { id: 5, role: 'unknown_role', email: 'unknown@test.com' };
            await expect(middleware(req, res, next))
                .rejects.toThrow();
            expect(next).not.toHaveBeenCalled();
        });
    });
    describe('requireServeToProcessing', () => {
        const middleware = auth_1.requireServeToProcessing;
        it('should allow Admin for Serve → Processing transitions', async () => {
            req.user = { id: 1, role: types_1.UserRole.ADMIN, email: 'admin@test.com' };
            await middleware(req, res, next);
            expect(next).toHaveBeenCalledWith();
            expect(res.status).not.toHaveBeenCalled();
        });
        it('should allow Cashier for Serve → Processing transitions', async () => {
            req.user = { id: 3, role: types_1.UserRole.CASHIER, email: 'cashier@test.com' };
            await middleware(req, res, next);
            expect(next).toHaveBeenCalledWith();
            expect(res.status).not.toHaveBeenCalled();
        });
        it('should allow Super Admin for Serve → Processing transitions', async () => {
            req.user = { id: 4, role: types_1.UserRole.SUPER_ADMIN, email: 'super@test.com' };
            await middleware(req, res, next);
            expect(next).toHaveBeenCalledWith();
            expect(res.status).not.toHaveBeenCalled();
        });
        it('should reject Sales role for Serve → Processing transitions', async () => {
            req.user = { id: 2, role: types_1.UserRole.SALES, email: 'sales@test.com' };
            await expect(middleware(req, res, next))
                .rejects.toThrow();
            expect(next).not.toHaveBeenCalled();
        });
    });
    describe('requireForcedTransitions', () => {
        const middleware = auth_1.requireForcedTransitions;
        it('should allow Admin for forced status transitions', async () => {
            req.user = { id: 1, role: types_1.UserRole.ADMIN, email: 'admin@test.com' };
            await middleware(req, res, next);
            expect(next).toHaveBeenCalledWith();
            expect(res.status).not.toHaveBeenCalled();
        });
        it('should allow Super Admin for forced status transitions', async () => {
            req.user = { id: 4, role: types_1.UserRole.SUPER_ADMIN, email: 'super@test.com' };
            await middleware(req, res, next);
            expect(next).toHaveBeenCalledWith();
            expect(res.status).not.toHaveBeenCalled();
        });
        it('should reject Sales role for forced transitions', async () => {
            req.user = { id: 2, role: types_1.UserRole.SALES, email: 'sales@test.com' };
            await expect(middleware(req, res, next))
                .rejects.toThrow();
            expect(next).not.toHaveBeenCalled();
        });
        it('should reject Cashier role for forced transitions', async () => {
            req.user = { id: 3, role: types_1.UserRole.CASHIER, email: 'cashier@test.com' };
            await expect(middleware(req, res, next))
                .rejects.toThrow();
            expect(next).not.toHaveBeenCalled();
        });
    });
    describe('Missing user scenarios', () => {
        it('should reject requests without user for all middlewares', async () => {
            req.user = undefined;
            await expect((0, auth_1.requireProcessingView)(req, res, next))
                .rejects.toThrow();
            await expect((0, auth_1.requireServeToProcessing)(req, res, next))
                .rejects.toThrow();
            await expect((0, auth_1.requireForcedTransitions)(req, res, next))
                .rejects.toThrow();
            expect(next).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=rbac-queue.test.js.map