"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const transaction_1 = require("../../services/transaction");
const transactions_1 = __importDefault(require("../../routes/transactions"));
// Mock the services
jest.mock('../../services/transaction', () => ({
    ReportService: {
        getDailyReport: jest.fn()
    }
}));
// Mock the auth middleware
jest.mock('../../middleware/auth', () => ({
    authenticateToken: jest.fn((req, res, next) => {
        req.user = { id: 1, email: 'test@example.com', role: 'admin' };
        next();
    }),
    requireCashierOrAdmin: jest.fn((req, res, next) => next()),
    requireAdmin: jest.fn((req, res, next) => next()),
    logActivity: jest.fn(() => (req, res, next) => next())
}));
describe('Daily Reports API', () => {
    let app;
    const mockReportService = transaction_1.ReportService;
    beforeEach(() => {
        app = (0, express_1.default)();
        app.use(express_1.default.json());
        app.use('/api/transactions', transactions_1.default);
        jest.clearAllMocks();
    });
    describe('GET /api/transactions/reports/daily/:date', () => {
        it('should return exists:false when report does not exist', async () => {
            // Mock ReportService.getDailyReport to return null
            mockReportService.getDailyReport.mockResolvedValue(null);
            const response = await (0, supertest_1.default)(app)
                .get('/api/transactions/reports/daily/2024-01-15')
                .expect(200);
            expect(response.body).toEqual({ exists: false });
            expect(mockReportService.getDailyReport).toHaveBeenCalledWith('2024-01-15');
        });
        it('should return the report when it exists', async () => {
            const mockReport = {
                date: '2024-01-15',
                total_cash: 1500.50,
                total_gcash: 2000.75,
                total_maya: 500.25,
                total_credit_card: 800.00,
                total_bank_transfer: 1200.00,
                petty_cash_start: 300.00,
                petty_cash_end: 250.00,
                expenses: [
                    { description: 'Office supplies', amount: 100.00 }
                ],
                funds: [
                    { description: 'Investment', amount: 1000.00 }
                ],
                cash_turnover: 5850.50,
                transaction_count: 25
            };
            mockReportService.getDailyReport.mockResolvedValue(mockReport);
            const response = await (0, supertest_1.default)(app)
                .get('/api/transactions/reports/daily/2024-01-15')
                .expect(200);
            expect(response.body).toEqual(mockReport);
            expect(mockReportService.getDailyReport).toHaveBeenCalledWith('2024-01-15');
        });
        it('should return numeric defaults as 0 when report has null values', async () => {
            const mockReportWithNulls = {
                date: '2024-01-15',
                total_cash: 0,
                total_gcash: 0,
                total_maya: 0,
                total_credit_card: 0,
                total_bank_transfer: 0,
                petty_cash_start: 0,
                petty_cash_end: 0,
                expenses: [],
                funds: [],
                cash_turnover: 0,
                transaction_count: 0
            };
            mockReportService.getDailyReport.mockResolvedValue(mockReportWithNulls);
            const response = await (0, supertest_1.default)(app)
                .get('/api/transactions/reports/daily/2024-01-15')
                .expect(200);
            expect(response.body).toEqual(mockReportWithNulls);
            // Verify all numeric fields are 0, not null
            expect(response.body.total_cash).toBe(0);
            expect(response.body.total_gcash).toBe(0);
            expect(response.body.total_maya).toBe(0);
            expect(response.body.total_credit_card).toBe(0);
            expect(response.body.total_bank_transfer).toBe(0);
            expect(response.body.petty_cash_start).toBe(0);
            expect(response.body.petty_cash_end).toBe(0);
            expect(response.body.cash_turnover).toBe(0);
            expect(response.body.transaction_count).toBe(0);
            // Verify arrays are empty, not null
            expect(response.body.expenses).toEqual([]);
            expect(response.body.funds).toEqual([]);
        });
        it('should handle database errors gracefully', async () => {
            mockReportService.getDailyReport.mockRejectedValue(new Error('Database connection failed'));
            const response = await (0, supertest_1.default)(app)
                .get('/api/transactions/reports/daily/2024-01-15')
                .expect(500);
            expect(response.body).toEqual({ error: 'Internal server error' });
        });
        it('should handle different date formats', async () => {
            mockReportService.getDailyReport.mockResolvedValue(null);
            // Test with different date formats
            await (0, supertest_1.default)(app)
                .get('/api/transactions/reports/daily/2024-12-31')
                .expect(200);
            await (0, supertest_1.default)(app)
                .get('/api/transactions/reports/daily/2024-01-01')
                .expect(200);
            expect(mockReportService.getDailyReport).toHaveBeenCalledWith('2024-12-31');
            expect(mockReportService.getDailyReport).toHaveBeenCalledWith('2024-01-01');
        });
        it('should preserve mixed valid and null values correctly', async () => {
            const mockMixedReport = {
                date: '2024-01-15',
                total_cash: 1500.50,
                total_gcash: 0, // null converted to 0
                total_maya: 500.25,
                total_credit_card: 0, // null converted to 0
                total_bank_transfer: 1200.00,
                petty_cash_start: 0, // null converted to 0
                petty_cash_end: 250.00,
                expenses: [{ description: 'Office supplies', amount: 100.00 }],
                funds: [], // null converted to empty array
                cash_turnover: 0, // null converted to 0
                transaction_count: 25
            };
            mockReportService.getDailyReport.mockResolvedValue(mockMixedReport);
            const response = await (0, supertest_1.default)(app)
                .get('/api/transactions/reports/daily/2024-01-15')
                .expect(200);
            expect(response.body).toEqual(mockMixedReport);
            // Verify mixed values are handled correctly
            expect(response.body.total_cash).toBe(1500.50);
            expect(response.body.total_gcash).toBe(0);
            expect(response.body.total_maya).toBe(500.25);
            expect(response.body.total_credit_card).toBe(0);
            expect(response.body.petty_cash_start).toBe(0);
            expect(response.body.petty_cash_end).toBe(250.00);
            expect(response.body.transaction_count).toBe(25);
        });
    });
});
//# sourceMappingURL=dailyReports.test.js.map