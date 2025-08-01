"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const transaction_1 = require("../../services/transaction");
const database_1 = require("../../config/database");
const types_1 = require("../../types");
// Mock the database pool
jest.mock('../../config/database');
const mockPool = database_1.pool;
describe('TransactionService.getDailySummary()', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('with known test data (10 transactions, 2 per payment mode)', () => {
        const testDate = new Date('2024-01-15');
        const expectedStartOfDay = new Date(testDate);
        expectedStartOfDay.setHours(0, 0, 0, 0);
        const expectedEndOfDay = new Date(testDate);
        expectedEndOfDay.setHours(23, 59, 59, 999);
        // Test data: 10 transactions, 2 per payment mode
        const seedData = {
            transactions: [
                // CASH transactions
                { payment_mode: types_1.PaymentMode.CASH, amount: 1000, count: 1 },
                { payment_mode: types_1.PaymentMode.CASH, amount: 1500, count: 1 },
                // GCASH transactions  
                { payment_mode: types_1.PaymentMode.GCASH, amount: 2000, count: 1 },
                { payment_mode: types_1.PaymentMode.GCASH, amount: 2500, count: 1 },
                // MAYA transactions
                { payment_mode: types_1.PaymentMode.MAYA, amount: 800, count: 1 },
                { payment_mode: types_1.PaymentMode.MAYA, amount: 1200, count: 1 },
                // CREDIT_CARD transactions
                { payment_mode: types_1.PaymentMode.CREDIT_CARD, amount: 3000, count: 1 },
                { payment_mode: types_1.PaymentMode.CREDIT_CARD, amount: 3500, count: 1 },
                // BANK_TRANSFER transactions
                { payment_mode: types_1.PaymentMode.BANK_TRANSFER, amount: 750, count: 1 },
                { payment_mode: types_1.PaymentMode.BANK_TRANSFER, amount: 1250, count: 1 }
            ]
        };
        // Expected totals
        const expectedTotalAmount = 17500; // Sum of all amounts
        const expectedTotalTransactions = 10; // Count of all transactions
        // Expected payment mode breakdowns
        const expectedPaymentModeBreakdown = {
            [types_1.PaymentMode.CASH]: { amount: 2500, count: 2 }, // 1000 + 1500 = 2500
            [types_1.PaymentMode.GCASH]: { amount: 4500, count: 2 }, // 2000 + 2500 = 4500
            [types_1.PaymentMode.MAYA]: { amount: 2000, count: 2 }, // 800 + 1200 = 2000
            [types_1.PaymentMode.CREDIT_CARD]: { amount: 6500, count: 2 }, // 3000 + 3500 = 6500
            [types_1.PaymentMode.BANK_TRANSFER]: { amount: 2000, count: 2 } // 750 + 1250 = 2000
        };
        beforeEach(() => {
            // Mock the totals query result
            const totalsQueryResult = {
                rows: [{
                        total_transactions: expectedTotalTransactions,
                        total_amount: expectedTotalAmount.toString()
                    }]
            };
            // Mock the payment modes query result
            const modesQueryResult = {
                rows: [
                    { payment_mode: types_1.PaymentMode.CASH, count: '2', amount: '2500' },
                    { payment_mode: types_1.PaymentMode.GCASH, count: '2', amount: '4500' },
                    { payment_mode: types_1.PaymentMode.MAYA, count: '2', amount: '2000' },
                    { payment_mode: types_1.PaymentMode.CREDIT_CARD, count: '2', amount: '6500' },
                    { payment_mode: types_1.PaymentMode.BANK_TRANSFER, count: '2', amount: '2000' }
                ]
            };
            // Mock the sales agent query result
            const agentQueryResult = {
                rows: [
                    { agent_name: 'John Smith', count: '6', amount: '10500' },
                    { agent_name: 'Jane Doe', count: '4', amount: '7000' }
                ]
            };
            // Setup the Promise.all mock to return all three query results
            mockPool.query
                .mockResolvedValueOnce(totalsQueryResult)
                .mockResolvedValueOnce(modesQueryResult)
                .mockResolvedValueOnce(agentQueryResult);
        });
        it('should return correct totalAmount and totalTransactions', async () => {
            const result = await transaction_1.TransactionService.getDailySummary(testDate);
            expect(result.totalAmount).toBe(expectedTotalAmount);
            expect(result.totalTransactions).toBe(expectedTotalTransactions);
        });
        it('should return correct payment mode breakdown for all payment modes', async () => {
            const result = await transaction_1.TransactionService.getDailySummary(testDate);
            // Verify each payment mode has correct amount and count
            expect(result.paymentModeBreakdown[types_1.PaymentMode.CASH]).toEqual(expectedPaymentModeBreakdown[types_1.PaymentMode.CASH]);
            expect(result.paymentModeBreakdown[types_1.PaymentMode.GCASH]).toEqual(expectedPaymentModeBreakdown[types_1.PaymentMode.GCASH]);
            expect(result.paymentModeBreakdown[types_1.PaymentMode.MAYA]).toEqual(expectedPaymentModeBreakdown[types_1.PaymentMode.MAYA]);
            expect(result.paymentModeBreakdown[types_1.PaymentMode.CREDIT_CARD]).toEqual(expectedPaymentModeBreakdown[types_1.PaymentMode.CREDIT_CARD]);
            expect(result.paymentModeBreakdown[types_1.PaymentMode.BANK_TRANSFER]).toEqual(expectedPaymentModeBreakdown[types_1.PaymentMode.BANK_TRANSFER]);
        });
        it('should call database queries with correct date range', async () => {
            await transaction_1.TransactionService.getDailySummary(testDate);
            // Verify all three queries were called with correct date parameters
            expect(mockPool.query).toHaveBeenCalledTimes(3);
            // Check that all calls used the correct date range
            const callArgs = mockPool.query.mock.calls;
            // First call - totals query
            expect(callArgs[0][1]).toEqual([expectedStartOfDay, expectedEndOfDay]);
            // Second call - modes query  
            expect(callArgs[1][1]).toEqual([expectedStartOfDay, expectedEndOfDay]);
            // Third call - agents query
            expect(callArgs[2][1]).toEqual([expectedStartOfDay, expectedEndOfDay]);
        });
        it('should include sales agent breakdown in response', async () => {
            const result = await transaction_1.TransactionService.getDailySummary(testDate);
            expect(result.salesAgentBreakdown).toHaveLength(2);
            expect(result.salesAgentBreakdown[0]).toEqual({
                agent_name: 'John Smith',
                amount: 10500,
                count: 6
            });
            expect(result.salesAgentBreakdown[1]).toEqual({
                agent_name: 'Jane Doe',
                amount: 7000,
                count: 4
            });
        });
        it('should use current date when no date parameter is provided', async () => {
            const mockCurrentDate = new Date('2024-02-20T10:30:00.000Z');
            // Mock the Date constructor
            const originalDate = global.Date;
            global.Date = jest.fn((arg) => {
                if (arg === undefined) {
                    return new originalDate(mockCurrentDate);
                }
                return new originalDate(arg);
            });
            // Copy static methods and prototype
            Object.setPrototypeOf(global.Date, originalDate);
            Object.assign(global.Date, originalDate);
            // Reset the mock to capture new calls
            mockPool.query.mockClear();
            // Re-setup the mocks for this test
            mockPool.query
                .mockResolvedValueOnce({ rows: [{ total_transactions: 0, total_amount: '0' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });
            await transaction_1.TransactionService.getDailySummary();
            const expectedStart = new originalDate(mockCurrentDate);
            expectedStart.setHours(0, 0, 0, 0);
            const expectedEnd = new originalDate(mockCurrentDate);
            expectedEnd.setHours(23, 59, 59, 999);
            expect(mockPool.query).toHaveBeenCalledTimes(3);
            const firstCall = mockPool.query.mock.calls[0];
            // Verify date range calculations
            const [startParam, endParam] = firstCall[1];
            expect(startParam.getTime()).toBe(expectedStart.getTime());
            expect(endParam.getTime()).toBe(expectedEnd.getTime());
            // Restore original Date
            global.Date = originalDate;
        });
    });
    describe('edge cases and error handling', () => {
        it('should handle empty result sets gracefully', async () => {
            // Mock empty results
            mockPool.query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });
            const result = await transaction_1.TransactionService.getDailySummary(new Date('2024-01-01'));
            expect(result.totalAmount).toBe(0);
            expect(result.totalTransactions).toBe(0);
            // Verify all payment modes default to 0
            Object.values(types_1.PaymentMode).forEach(mode => {
                expect(result.paymentModeBreakdown[mode]).toEqual({ amount: 0, count: 0 });
            });
            expect(result.salesAgentBreakdown).toEqual([]);
        });
        it('should handle missing payment modes in results', async () => {
            // Mock result with only some payment modes
            const partialModesResult = {
                rows: [
                    { payment_mode: types_1.PaymentMode.CASH, count: '1', amount: '100' },
                    { payment_mode: types_1.PaymentMode.GCASH, count: '1', amount: '200' }
                    // Missing MAYA, CREDIT_CARD, BANK_TRANSFER
                ]
            };
            mockPool.query
                .mockResolvedValueOnce({ rows: [{ total_transactions: 2, total_amount: '300' }] })
                .mockResolvedValueOnce(partialModesResult)
                .mockResolvedValueOnce({ rows: [] });
            const result = await transaction_1.TransactionService.getDailySummary(new Date('2024-01-01'));
            // Verify present modes have correct values
            expect(result.paymentModeBreakdown[types_1.PaymentMode.CASH]).toEqual({ amount: 100, count: 1 });
            expect(result.paymentModeBreakdown[types_1.PaymentMode.GCASH]).toEqual({ amount: 200, count: 1 });
            // Verify missing modes default to 0
            expect(result.paymentModeBreakdown[types_1.PaymentMode.MAYA]).toEqual({ amount: 0, count: 0 });
            expect(result.paymentModeBreakdown[types_1.PaymentMode.CREDIT_CARD]).toEqual({ amount: 0, count: 0 });
            expect(result.paymentModeBreakdown[types_1.PaymentMode.BANK_TRANSFER]).toEqual({ amount: 0, count: 0 });
        });
        it('should handle null/undefined values in database results', async () => {
            // Mock results with null values
            mockPool.query
                .mockResolvedValueOnce({
                rows: [{ total_transactions: null, total_amount: null }]
            })
                .mockResolvedValueOnce({
                rows: [
                    { payment_mode: types_1.PaymentMode.CASH, count: null, amount: null }
                ]
            })
                .mockResolvedValueOnce({
                rows: [
                    { agent_name: 'Agent Test', count: null, amount: null }
                ]
            });
            const result = await transaction_1.TransactionService.getDailySummary(new Date('2024-01-01'));
            expect(result.totalAmount).toBe(0);
            expect(result.totalTransactions).toBe(0);
            expect(result.paymentModeBreakdown[types_1.PaymentMode.CASH]).toEqual({ amount: 0, count: 0 });
            expect(result.salesAgentBreakdown[0]).toEqual({
                agent_name: 'Agent Test',
                amount: 0,
                count: 0
            });
        });
        it('should propagate database errors', async () => {
            const dbError = new Error('Database connection failed');
            mockPool.query.mockRejectedValueOnce(dbError);
            await expect(transaction_1.TransactionService.getDailySummary(new Date('2024-01-01')))
                .rejects.toThrow('Database connection failed');
        });
    });
    describe('data consistency verification', () => {
        it('should ensure payment mode breakdown amounts sum to total amount', async () => {
            // This test verifies that the sum of individual payment mode amounts equals the total
            const testDate = new Date('2024-01-15');
            mockPool.query
                .mockResolvedValueOnce({ rows: [{ total_transactions: 5, total_amount: '5000' }] })
                .mockResolvedValueOnce({
                rows: [
                    { payment_mode: types_1.PaymentMode.CASH, count: '2', amount: '2000' },
                    { payment_mode: types_1.PaymentMode.GCASH, count: '2', amount: '1500' },
                    { payment_mode: types_1.PaymentMode.MAYA, count: '1', amount: '1500' }
                ]
            })
                .mockResolvedValueOnce({ rows: [] });
            const result = await transaction_1.TransactionService.getDailySummary(testDate);
            // Calculate sum of payment mode amounts
            const paymentModeSum = Object.values(result.paymentModeBreakdown)
                .reduce((sum, mode) => sum + mode.amount, 0);
            expect(paymentModeSum).toBe(result.totalAmount);
            expect(result.totalAmount).toBe(5000);
        });
        it('should ensure payment mode breakdown counts sum to total transactions', async () => {
            const testDate = new Date('2024-01-15');
            mockPool.query
                .mockResolvedValueOnce({ rows: [{ total_transactions: 8, total_amount: '8000' }] })
                .mockResolvedValueOnce({
                rows: [
                    { payment_mode: types_1.PaymentMode.CASH, count: '3', amount: '3000' },
                    { payment_mode: types_1.PaymentMode.GCASH, count: '2', amount: '2000' },
                    { payment_mode: types_1.PaymentMode.CREDIT_CARD, count: '3', amount: '3000' }
                ]
            })
                .mockResolvedValueOnce({ rows: [] });
            const result = await transaction_1.TransactionService.getDailySummary(testDate);
            // Calculate sum of payment mode counts
            const paymentModeCountSum = Object.values(result.paymentModeBreakdown)
                .reduce((sum, mode) => sum + mode.count, 0);
            expect(paymentModeCountSum).toBe(result.totalTransactions);
            expect(result.totalTransactions).toBe(8);
        });
    });
});
//# sourceMappingURL=TransactionService.test.js.map