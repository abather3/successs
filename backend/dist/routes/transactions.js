"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const transaction_1 = require("../services/transaction");
// import { PaymentSettlementService } from '../services/paymentSettlementService';
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Add logging middleware for all transaction routes
router.use((req, res, next) => {
    console.log(`Transaction Route: ${req.method} ${req.url}`);
    console.log(`Transaction Route Path: ${req.path}`);
    console.log(`Transaction Route Params:`, req.params);
    console.log(`Transaction Route Headers:`, req.headers.authorization ? 'Bearer token present' : 'No auth token');
    next();
});
// Create transaction
router.post('/', auth_1.authenticateToken, auth_1.requireCashierOrAdmin, (0, auth_1.logActivity)('create_transaction'), async (req, res) => {
    try {
        const transactionData = {
            ...req.body,
            cashier_id: req.user.id
        };
        const transaction = await transaction_1.TransactionService.create(transactionData);
        res.status(201).json(transaction);
    }
    catch (error) {
        console.error('Error creating transaction:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// List transactions
router.get('/', auth_1.authenticateToken, (0, auth_1.logActivity)('list_transactions'), async (req, res) => {
    try {
        const { startDate, endDate, paymentMode, salesAgentId, cashierId, customerId, page = '1', limit = '50' } = req.query;
        const filters = {
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            paymentMode: paymentMode,
            salesAgentId: salesAgentId ? parseInt(salesAgentId, 10) : undefined,
            cashierId: cashierId ? parseInt(cashierId, 10) : undefined,
            customerId: customerId ? parseInt(customerId, 10) : undefined,
            includePaymentDetails: true, // Include payment details for transaction listing
        };
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const offset = (pageNum - 1) * limitNum;
        const result = await transaction_1.TransactionService.list(filters, limitNum, offset);
        res.json({
            transactions: result.transactions,
            pagination: {
                current_page: pageNum,
                per_page: limitNum,
                total: result.total,
                total_pages: Math.ceil(result.total / limitNum)
            }
        });
    }
    catch (error) {
        console.error('Error listing transactions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Delete daily report (Admin only) - MOVED BEFORE GENERIC ROUTES
router.delete('/reports/daily/:date', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('delete_daily_report'), async (req, res) => {
    try {
        const { date } = req.params;
        console.log(`DELETE request received for date: ${date}`);
        console.log(`Request params:`, req.params);
        console.log(`Request URL:`, req.url);
        // Validate date format (basic check)
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD' });
            return;
        }
        const deleted = await transaction_1.ReportService.deleteDailyReport(date);
        if (!deleted) {
            res.status(404).json({ error: 'Daily report not found' });
            return;
        }
        console.log(`ADMIN ACTION: ${req.user?.full_name} deleted daily report for ${date} at ${new Date().toISOString()}`);
        res.status(200).json({
            success: true,
            message: `Daily report for ${date} has been deleted successfully.`
        });
    }
    catch (error) {
        console.error('Error deleting daily report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get transaction by ID
router.get('/:id', auth_1.authenticateToken, (0, auth_1.logActivity)('get_transaction'), async (req, res) => {
    try {
        const { id } = req.params;
        const txId = Number(id);
        if (!Number.isInteger(txId)) {
            res.status(400).json({ error: 'Invalid transaction id' });
            return;
        }
        const transaction = await transaction_1.TransactionService.findById(txId);
        if (!transaction) {
            res.status(404).json({ error: 'Transaction not found' });
            return;
        }
        res.json(transaction);
    }
    catch (error) {
        console.error('Error getting transaction:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get daily summary (keep this for backward compatibility)
router.get('/reports/summary/daily', auth_1.authenticateToken, (0, auth_1.logActivity)('get_daily_summary'), async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date ? new Date(date) : new Date();
        const summary = await transaction_1.TransactionService.getDailySummary(targetDate);
        res.json(summary);
    }
    catch (error) {
        console.error('Error getting daily summary:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get monthly report
router.get('/reports/monthly', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('get_monthly_report'), async (req, res) => {
    try {
        const { year, month } = req.query;
        if (!year || !month) {
            res.status(400).json({ error: 'Year and month are required' });
            return;
        }
        const report = await transaction_1.TransactionService.getMonthlyReport(parseInt(year, 10), parseInt(month, 10));
        res.json(report);
    }
    catch (error) {
        console.error('Error getting monthly report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get weekly report
router.get('/reports/weekly', auth_1.authenticateToken, (0, auth_1.logActivity)('get_weekly_report'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            res.status(400).json({ error: 'Start date and end date are required' });
            return;
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        const [summary, paymentStats] = await Promise.all([
            transaction_1.TransactionService.getDailySummary(start),
            transaction_1.TransactionService.getPaymentModeStats(start, end)
        ]);
        res.json({
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
            summary,
            paymentStats
        });
    }
    catch (error) {
        console.error('Error getting weekly report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all daily reports (Admin only) - This must come BEFORE the parameterized routes
router.get('/reports/daily/all', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('get_all_daily_reports'), async (req, res) => {
    try {
        const reports = await transaction_1.ReportService.getAllDailyReports();
        res.json(reports);
    }
    catch (error) {
        console.error('Error getting all daily reports:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Generate daily report
router.post('/reports/daily', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('generate_daily_report'), async (req, res) => {
    try {
        const { date, expenses = [], funds = [], pettyCashStart = 0, pettyCashEnd = 0 } = req.body;
        const targetDate = date ? new Date(date) : new Date();
        const report = await transaction_1.ReportService.generateDailyReport(targetDate, expenses, funds, pettyCashStart, pettyCashEnd);
        await transaction_1.ReportService.saveDailyReport(report);
        res.json(report);
    }
    catch (error) {
        console.error('Error generating daily report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get saved daily report (MUST come after specific routes like /all)
router.get('/reports/daily/:date', auth_1.authenticateToken, (0, auth_1.logActivity)('get_saved_daily_report'), async (req, res) => {
    try {
        const { date } = req.params;
        const report = await transaction_1.ReportService.getDailyReport(date);
        if (!report) {
            res.status(200).json({ exists: false });
            return;
        }
        res.json(report);
    }
    catch (error) {
        console.error('Error getting saved daily report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Export transactions
router.post('/export', auth_1.authenticateToken, (0, auth_1.logActivity)('export_transactions'), async (req, res) => {
    try {
        const { format, startDate, endDate, paymentMode, salesAgentId, cashierId } = req.body;
        if (!format || !['excel', 'pdf', 'csv'].includes(format)) {
            res.status(400).json({ error: 'Invalid export format. Supported formats: excel, pdf, csv' });
            return;
        }
        const filters = {
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            paymentMode: paymentMode,
            salesAgentId: salesAgentId ? parseInt(salesAgentId, 10) : undefined,
            cashierId: cashierId ? parseInt(cashierId, 10) : undefined,
            includePaymentDetails: true, // Include payment details for export
        };
        const result = await transaction_1.TransactionService.list(filters, 10000, 0); // Get all transactions
        // For now, return the data as JSON. In a real implementation, you would
        // generate the actual file format and return it as a download.
        res.json({
            format,
            exportedAt: new Date().toISOString(),
            totalRecords: result.total,
            data: result.transactions
        });
    }
    catch (error) {
        console.error('Error exporting transactions:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Create a new payment settlement
router.post('/:id/settlements', auth_1.authenticateToken, auth_1.requireCashierOrAdmin, (0, auth_1.logActivity)('create_settlement'), async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, payment_mode, cashier_id } = req.body;
        // Validate required fields
        if (!amount || !payment_mode || !cashier_id) {
            res.status(400).json({ error: 'Missing required fields: amount, payment_mode, cashier_id' });
            return;
        }
        // Validate transaction ID
        const transactionId = Number(id);
        if (!Number.isInteger(transactionId)) {
            res.status(400).json({ error: 'Invalid transaction id' });
            return;
        }
        // Validate amount
        const settlementAmount = parseFloat(amount);
        if (isNaN(settlementAmount) || settlementAmount <= 0) {
            res.status(400).json({ error: 'Amount must be a positive number' });
            return;
        }
        // Validate cashier_id
        const cashierIdInt = parseInt(cashier_id, 10);
        if (isNaN(cashierIdInt)) {
            res.status(400).json({ error: 'Invalid cashier ID' });
            return;
        }
        // Temporarily disabled PaymentSettlementService
        // const result = await PaymentSettlementService.createSettlement(
        //   transactionId,
        //   settlementAmount,
        //   payment_mode,
        //   cashierIdInt
        // );
        const result = { message: 'PaymentSettlementService temporarily disabled' };
        res.status(201).json(result);
    }
    catch (error) {
        console.error('Error creating payment settlement:', error);
        // Handle specific error types
        if (error instanceof Error) {
            if (error.message.includes('not found') || error.message.includes('Invalid') || error.message.includes('exceeds')) {
                res.status(400).json({ error: error.message });
                return;
            }
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Delete transaction (Admin only)
router.delete('/:id', auth_1.authenticateToken, auth_1.requireAdmin, (0, auth_1.logActivity)('delete_transaction'), async (req, res) => {
    try {
        const { id } = req.params;
        // Validate transaction ID
        const transactionId = Number(id);
        if (!Number.isInteger(transactionId)) {
            res.status(400).json({ error: 'Invalid transaction id' });
            return;
        }
        await transaction_1.TransactionService.delete(transactionId);
        res.status(204).send(); // No content response for successful deletion
    }
    catch (error) {
        console.error('Error deleting transaction:', error);
        if (error instanceof Error && error.message.includes('not found')) {
            res.status(404).json({ error: 'Transaction not found' });
            return;
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all settlements for a transaction
router.get('/:id/settlements', auth_1.authenticateToken, (0, auth_1.logActivity)('get_settlements'), async (req, res) => {
    try {
        const { id } = req.params;
        // Validate transaction ID
        const transactionId = Number(id);
        if (!Number.isInteger(transactionId)) {
            res.status(400).json({ error: 'Invalid transaction id' });
            return;
        }
        // Temporarily disabled PaymentSettlementService
        // const settlements = await PaymentSettlementService.getSettlements(transactionId);
        const settlements = [];
        res.json(settlements);
    }
    catch (error) {
        console.error('Error getting settlements:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=transactions.js.map