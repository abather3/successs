"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("../../middleware/auth");
const types_1 = require("../../types");
describe('RBAC Middleware Tests', () => {
    let mockRequest;
    let mockResponse;
    let nextFunction = jest.fn();
    beforeEach(() => {
        mockRequest = {
            user: {
                id: 1,
                email: 'test@user.com',
                full_name: 'Test User',
                role: types_1.UserRole.CASHIER,
                status: 'active',
                created_at: new Date(),
                updated_at: new Date()
            }
        };
        mockResponse = {};
    });
    it('should allow access with correct role', async () => {
        (0, auth_1.requireRole)([types_1.UserRole.CASHIER])(mockRequest, mockResponse, nextFunction);
        expect(nextFunction).toBeCalled();
    });
    it('should deny access with incorrect role', async () => {
        (0, auth_1.requireRole)([types_1.UserRole.ADMIN])(mockRequest, mockResponse, nextFunction);
        expect(nextFunction).not.toBeCalled();
    });
});
//# sourceMappingURL=RBACMiddleware.test.js.map