"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const transaction_1 = require("../../services/transaction");
const database_1 = require("../../config/database");
// Mock the database pool
jest.mock('../../config/database', () => ({
    pool: {
        query: jest.fn(),
    },
}));
describe('ReportService', () => {
    const mockPool = database_1.pool;
    beforeEach(() => {
        mockPool.query.mockClear();
    });
    describe('getDailyReport', () => {
        it('should return null when no report exists for the given date', async () => {
            // Mock database returning no rows
            mockPool.query.mockResolvedValueOnce({
                rows: [],
                rowCount: 0,
            });
            const result = await transaction_1.ReportService.getDailyReport('2024-01-15');
            expect(result).toBeNull();
            expect(mockPool.query).toHaveBeenCalledWith(`\n      SELECT * FROM daily_reports\n      WHERE date = $1\n    `, ['2024-01-15']);
        });
        it('should normalize null/undefined values to defaults when DB row contains nulls', async () => {
            // Mock database returning a row with NULL values
            const dbRowWithNulls = {
                date: '2024-01-15',
                total_cash: null,
                total_gcash: null,
                total_maya: undefined,
                total_credit_card: null,
                total_bank_transfer: null,
                petty_cash_start: null,
                petty_cash_end: undefined,
                expenses: null,
                funds: null,
                cash_turnover: null,
                transaction_count: null,
            };
            mockPool.query.mockResolvedValueOnce({
                rows: [dbRowWithNulls],
                rowCount: 1,
            });
            const result = await transaction_1.ReportService.getDailyReport('2024-01-15');
            expect(result).not.toBeNull();
            const report = result;
            // All numeric fields should be 0 instead of null
            expect(report.total_cash).toBe(0);
            expect(report.total_gcash).toBe(0);
            expect(report.total_maya).toBe(0);
            expect(report.total_credit_card).toBe(0);
            expect(report.total_bank_transfer).toBe(0);
            expect(report.petty_cash_start).toBe(0);
            expect(report.petty_cash_end).toBe(0);
            expect(report.cash_turnover).toBe(0);
            expect(report.transaction_count).toBe(0);
            // Arrays should be empty instead of null
            expect(report.expenses).toEqual([]);
            expect(report.funds).toEqual([]);
            // Date should be preserved
            expect(report.date).toBe('2024-01-15');
        });
        it('should preserve valid values when DB row contains valid data', async () => {
            // Mock database returning a row with valid values
            const dbRowWithValues = {
                date: '2024-01-15',
                total_cash: 1500.50,
                total_gcash: 2000.75,
                total_maya: 500.25,
                total_credit_card: 800.00,
                total_bank_transfer: 1200.00,
                petty_cash_start: 300.00,
                petty_cash_end: 250.00,
                expenses: [
                    { description: 'Office supplies', amount: 100.00 },
                    { description: 'Utilities', amount: 200.00 }
                ],
                funds: [
                    { description: 'Investment', amount: 1000.00 }
                ],
                cash_turnover: 5850.50,
                transaction_count: 25,
            };
            mockPool.query.mockResolvedValueOnce({
                rows: [dbRowWithValues],
                rowCount: 1,
            });
            const result = await transaction_1.ReportService.getDailyReport('2024-01-15');
            expect(result).not.toBeNull();
            const report = result;
            // All values should be preserved exactly as they were
            expect(report.total_cash).toBe(1500.50);
            expect(report.total_gcash).toBe(2000.75);
            expect(report.total_maya).toBe(500.25);
            expect(report.total_credit_card).toBe(800.00);
            expect(report.total_bank_transfer).toBe(1200.00);
            expect(report.petty_cash_start).toBe(300.00);
            expect(report.petty_cash_end).toBe(250.00);
            expect(report.cash_turnover).toBe(5850.50);
            expect(report.transaction_count).toBe(25);
            expect(report.expenses).toEqual([
                { description: 'Office supplies', amount: 100.00 },
                { description: 'Utilities', amount: 200.00 }
            ]);
            expect(report.funds).toEqual([
                { description: 'Investment', amount: 1000.00 }
            ]);
            expect(report.date).toBe('2024-01-15');
        });
        it('should handle mixed null and valid values correctly', async () => {
            // Mock database returning a row with mixed null/valid values
            const dbRowMixed = {
                date: '2024-01-15',
                total_cash: 1500.50,
                total_gcash: null,
                total_maya: 500.25,
                total_credit_card: null,
                total_bank_transfer: 1200.00,
                petty_cash_start: null,
                petty_cash_end: 250.00,
                expenses: [{ description: 'Office supplies', amount: 100.00 }],
                funds: null,
                cash_turnover: null,
                transaction_count: 25,
            };
            mockPool.query.mockResolvedValueOnce({
                rows: [dbRowMixed],
                rowCount: 1,
            });
            const result = await transaction_1.ReportService.getDailyReport('2024-01-15');
            expect(result).not.toBeNull();
            const report = result;
            // Valid values should be preserved
            expect(report.total_cash).toBe(1500.50);
            expect(report.total_maya).toBe(500.25);
            expect(report.total_bank_transfer).toBe(1200.00);
            expect(report.petty_cash_end).toBe(250.00);
            expect(report.transaction_count).toBe(25);
            expect(report.expenses).toEqual([{ description: 'Office supplies', amount: 100.00 }]);
            // Null values should be defaulted
            expect(report.total_gcash).toBe(0);
            expect(report.total_credit_card).toBe(0);
            expect(report.petty_cash_start).toBe(0);
            expect(report.cash_turnover).toBe(0);
            expect(report.funds).toEqual([]);
            expect(report.date).toBe('2024-01-15');
        });
        it('should handle edge case where date is null/undefined', async () => {
            // Mock database returning a row with null date
            const dbRowNullDate = {
                date: null,
                total_cash: 1500.50,
                total_gcash: 2000.75,
                total_maya: 500.25,
                total_credit_card: 800.00,
                total_bank_transfer: 1200.00,
                petty_cash_start: 300.00,
                petty_cash_end: 250.00,
                expenses: [],
                funds: [],
                cash_turnover: 5850.50,
                transaction_count: 25,
            };
            mockPool.query.mockResolvedValueOnce({
                rows: [dbRowNullDate],
                rowCount: 1,
            });
            const result = await transaction_1.ReportService.getDailyReport('2024-01-15');
            expect(result).not.toBeNull();
            const report = result;
            // Date should default to empty string
            expect(report.date).toBe('');
            // Other values should be preserved
            expect(report.total_cash).toBe(1500.50);
            expect(report.total_gcash).toBe(2000.75);
        });
    });
});
//# sourceMappingURL=reportService.test.js.map