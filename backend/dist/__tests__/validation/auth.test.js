"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const validation_1 = require("../../middleware/validation");
const auth_1 = require("../../validation/schemas/auth");
// Create test app
const createTestApp = (schema) => {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.post('/test', (0, validation_1.validateSchema)(schema), (req, res) => {
        res.json({ success: true });
    });
    return app;
};
describe('Auth Validation', () => {
    describe('Login Validation', () => {
        const app = createTestApp(auth_1.loginSchema);
        it('should pass validation with valid login data', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test')
                .send({
                email: 'test@example.com',
                password: 'password123'
            });
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
        it('should fail validation with invalid email', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test')
                .send({
                email: 'invalid-email',
                password: 'password123'
            });
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation failed');
            expect(response.body.details).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    field: 'email',
                    message: 'Invalid email address'
                })
            ]));
        });
        it('should fail validation with short password', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test')
                .send({
                email: 'test@example.com',
                password: '12345'
            });
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation failed');
            expect(response.body.details).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    field: 'password',
                    message: 'Password must be at least 6 characters long'
                })
            ]));
        });
        it('should fail validation with missing fields', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test')
                .send({});
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation failed');
            expect(response.body.details).toHaveLength(2);
        });
    });
    describe('Registration Validation', () => {
        const app = createTestApp(auth_1.registerSchema);
        it('should pass validation with valid registration data', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test')
                .send({
                email: 'test@example.com',
                full_name: 'Test User',
                password: 'Password123!',
                role: 'sales'
            });
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
        it('should fail validation with weak password', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test')
                .send({
                email: 'test@example.com',
                full_name: 'Test User',
                password: 'password',
                role: 'sales'
            });
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation failed');
            expect(response.body.details).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    field: 'password',
                    message: expect.stringContaining('Password must contain')
                })
            ]));
        });
        it('should fail validation with invalid role', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test')
                .send({
                email: 'test@example.com',
                full_name: 'Test User',
                password: 'Password123!',
                role: 'invalid_role'
            });
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation failed');
            expect(response.body.details).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    field: 'role',
                    message: 'Invalid user role'
                })
            ]));
        });
        it('should fail validation with short full name', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test')
                .send({
                email: 'test@example.com',
                full_name: 'A',
                password: 'Password123!',
                role: 'sales'
            });
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation failed');
            expect(response.body.details).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    field: 'full_name',
                    message: 'Full name must be between 2 and 100 characters'
                })
            ]));
        });
    });
    describe('Change Password Validation', () => {
        const app = createTestApp(auth_1.changePasswordSchema);
        it('should pass validation with valid password change data', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test')
                .send({
                email: 'test@example.com',
                currentPassword: 'OldPassword123!',
                newPassword: 'NewPassword123!'
            });
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
        it('should fail validation with weak new password', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test')
                .send({
                email: 'test@example.com',
                currentPassword: 'OldPassword123!',
                newPassword: 'weak'
            });
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation failed');
            expect(response.body.details).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    field: 'newPassword',
                    message: expect.stringContaining('New password must')
                })
            ]));
        });
        it('should fail validation with missing current password', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test')
                .send({
                email: 'test@example.com',
                newPassword: 'NewPassword123!'
            });
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation failed');
            expect(response.body.details).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    field: 'currentPassword',
                    message: 'Current password is required'
                })
            ]));
        });
    });
    describe('Password Reset Request Validation', () => {
        const app = createTestApp(auth_1.requestPasswordResetSchema);
        it('should pass validation with valid email', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test')
                .send({
                email: 'test@example.com'
            });
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
        it('should fail validation with invalid email', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test')
                .send({
                email: 'invalid-email'
            });
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation failed');
            expect(response.body.details).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    field: 'email',
                    message: 'Invalid email address'
                })
            ]));
        });
    });
    describe('Password Reset Validation', () => {
        const app = createTestApp(auth_1.resetPasswordSchema);
        it('should pass validation with valid reset data', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test')
                .send({
                token: 'a'.repeat(32),
                newPassword: 'NewPassword123!'
            });
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
        it('should fail validation with short token', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test')
                .send({
                token: 'short',
                newPassword: 'NewPassword123!'
            });
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation failed');
            expect(response.body.details).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    field: 'token',
                    message: 'Invalid reset token format'
                })
            ]));
        });
        it('should fail validation with weak new password', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test')
                .send({
                token: 'a'.repeat(32),
                newPassword: 'weak'
            });
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation failed');
            expect(response.body.details).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    field: 'newPassword',
                    message: expect.stringContaining('New password must')
                })
            ]));
        });
    });
    describe('Token Verification Validation', () => {
        const app = createTestApp(auth_1.verifyTokenSchema);
        it('should pass validation with valid token', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test')
                .send({
                token: 'a'.repeat(32)
            });
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
        it('should fail validation with short token', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test')
                .send({
                token: 'short'
            });
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation failed');
            expect(response.body.details).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    field: 'token',
                    message: 'Invalid token format'
                })
            ]));
        });
        it('should fail validation with missing token', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test')
                .send({});
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation failed');
            expect(response.body.details).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    field: 'token',
                    message: 'Token is required'
                })
            ]));
        });
    });
});
//# sourceMappingURL=auth.test.js.map