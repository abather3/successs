"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const validation_1 = require("../../middleware/validation");
const customer_1 = require("../../validation/schemas/customer");
// Create test app
const createTestApp = (schema) => {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.post('/test', (0, validation_1.validateSchema)(schema), (req, res) => {
        res.json({ success: true });
    });
    app.post('/test/:id', (0, validation_1.validateSchema)(schema), (req, res) => {
        res.json({ success: true });
    });
    app.patch('/test/:id', (0, validation_1.validateSchema)(schema), (req, res) => {
        res.json({ success: true });
    });
    app.get('/test', (0, validation_1.validateSchema)(schema), (req, res) => {
        res.json({ success: true });
    });
    return app;
};
describe('Customer Validation', () => {
    describe('Create Customer Validation', () => {
        const app = createTestApp(customer_1.createCustomerSchema);
        it('should pass validation with valid customer data', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test')
                .send({
                name: 'John Doe',
                contact_number: '+12345678901',
                email: 'john.doe@example.com',
                age: 30,
                address: '123 Main St, Anytown, USA',
                distribution_info: 'lalamove',
                grade_type: 'single',
                lens_type: 'bifocal',
                'estimated_time.days': 1,
                'estimated_time.hours': 5,
                'estimated_time.minutes': 30,
                'payment_info.mode': 'cash',
                'payment_info.amount': 999.99
            });
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
        it('should fail validation with invalid email', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test')
                .send({
                name: 'John Doe',
                contact_number: '+12345678901',
                email: 'invalid email',
                age: 30,
                address: '123 Main St, Anytown, USA',
                distribution_info: 'lalamove',
                grade_type: 'single',
                lens_type: 'bifocal',
                'estimated_time.days': 1,
                'estimated_time.hours': 5,
                'estimated_time.minutes': 30,
                'payment_info.mode': 'cash',
                'payment_info.amount': 999.99
            });
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation failed');
            expect(response.body.details).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    field: 'email',
                    message: 'Invalid email format'
                })
            ]));
        });
        it('should fail validation with invalid age', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test')
                .send({
                name: 'John Doe',
                contact_number: '+12345678901',
                email: 'john.doe@example.com',
                age: 200, // Invalid age
                address: '123 Main St, Anytown, USA',
                distribution_info: 'lalamove',
                grade_type: 'single',
                lens_type: 'bifocal',
                'estimated_time.days': 1,
                'estimated_time.hours': 5,
                'estimated_time.minutes': 30,
                'payment_info.mode': 'cash',
                'payment_info.amount': 999.99
            });
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation failed');
            expect(response.body.details).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    field: 'age',
                    message: 'Age must be between 1 and 120'
                })
            ]));
        });
    });
    describe('Update Customer Validation', () => {
        const app = createTestApp(customer_1.updateCustomerSchema);
        it('should pass validation with valid update data', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test/1')
                .send({
                name: 'Jane Doe',
                contact_number: '+12345678901',
                email: 'jane.doe@example.com',
                age: 28
            });
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
        it('should fail validation with invalid customer ID', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test/invalid')
                .send({
                name: 'Jane Doe'
            });
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation failed');
            expect(response.body.details).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    field: 'id',
                    message: 'Invalid customer ID'
                })
            ]));
        });
    });
    describe('Update Customer Status Validation', () => {
        const app = createTestApp(customer_1.updateCustomerStatusSchema);
        it('should pass validation with valid status data', async () => {
            const response = await (0, supertest_1.default)(app)
                .patch('/test/1')
                .send({
                status: 'waiting'
            });
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
        it('should fail validation with invalid status', async () => {
            const response = await (0, supertest_1.default)(app)
                .patch('/test/1')
                .send({
                status: 'invalid'
            });
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation failed');
            expect(response.body.details).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    field: 'status',
                    message: 'Invalid queue status'
                })
            ]));
        });
    });
    describe('List Customers Validation', () => {
        const app = createTestApp(customer_1.listCustomersSchema);
        it('should pass validation with valid filters', async () => {
            const response = await (0, supertest_1.default)(app)
                .get('/test')
                .query({
                status: 'waiting',
                salesAgentId: 1,
                startDate: '2023-01-01',
                endDate: '2023-12-31',
                searchTerm: 'John',
                sortBy: 'name',
                sortOrder: 'asc',
                page: 1,
                limit: 20
            });
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
        it('should fail validation with invalid sort order', async () => {
            const response = await (0, supertest_1.default)(app)
                .get('/test')
                .query({
                sortBy: 'name',
                sortOrder: 'invalid'
            });
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation failed');
            expect(response.body.details).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    field: 'sortOrder',
                    message: 'Sort order must be asc or desc'
                })
            ]));
        });
    });
    describe('Notify Customer Validation', () => {
        const app = createTestApp(customer_1.notifyCustomerSchema);
        it('should pass validation with valid notification data', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test/1')
                .send({
                type: 'ready',
                customMessage: 'Your order is ready for pickup.'
            });
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
        it('should fail validation with invalid notification type', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/test/1')
                .send({
                type: 'invalid'
            });
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Validation failed');
            expect(response.body.details).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    field: 'type',
                    message: 'Invalid notification type'
                })
            ]));
        });
    });
});
//# sourceMappingURL=customer.test.js.map