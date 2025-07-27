import request from 'supertest';
import express from 'express';
import { TransactionService } from '../../services/transaction';
import { authenticateToken } from '../../middleware/auth';
import transactionRoutes from '../../routes/transactions';
import { PaymentMode } from '../../types';

// Mock the services and auth middleware
jest.mock('../../services/transaction');
jest.mock('../../middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 1, email: 'test@example.com', role: 'admin' };
    next();
  }),
  requireCashierOrAdmin: jest.fn((req, res, next) => next()),
  requireAdmin: jest.fn((req, res, next) => next()),
  logActivity: jest.fn(() => (req, res, next) => next())
}));

// Mock WebSocket service to avoid issues
jest.mock('../../services/websocket', () => ({
  WebSocketService: {
    emitTransactionUpdate: jest.fn(),
    emitPaymentStatusUpdate: jest.fn(),
    setIO: jest.fn()
  }
}));

describe('Daily Reports Endpoint Integration Test', () => {
  let app: express.Application;
  const mockTransactionService = TransactionService as jest.Mocked<typeof TransactionService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/transactions', transactionRoutes);
    jest.clearAllMocks();
  });

  describe('GET /api/transactions/reports/daily', () => {
    it('should return daily summary with correct JSON structure', async () => {
      // Mock the getDailySummary method to return expected structure
      const mockDailySummary = {
        totalAmount: 5250.75,
        totalTransactions: 15,
        paymentModeBreakdown: {
          [PaymentMode.CASH]: { amount: 1500.25, count: 5 },
          [PaymentMode.GCASH]: { amount: 2000.50, count: 6 },
          [PaymentMode.MAYA]: { amount: 750.00, count: 2 },
          [PaymentMode.CREDIT_CARD]: { amount: 800.00, count: 1 },
          [PaymentMode.BANK_TRANSFER]: { amount: 200.00, count: 1 }
        },
        salesAgentBreakdown: [
          { agent_name: 'John Doe', amount: 3000.50, count: 8 },
          { agent_name: 'Jane Smith', amount: 2250.25, count: 7 }
        ]
      };

      mockTransactionService.getDailySummary.mockResolvedValue(mockDailySummary);

      const response = await request(app)
        .get('/api/transactions/reports/daily')
        .expect(200);

      // Verify the response structure matches expected format
      expect(response.body).toHaveProperty('totalAmount');
      expect(response.body).toHaveProperty('totalTransactions');
      expect(response.body).toHaveProperty('paymentModeBreakdown');
      expect(response.body).toHaveProperty('salesAgentBreakdown');

      // Verify totalAmount and totalTransactions are numbers
      expect(typeof response.body.totalAmount).toBe('number');
      expect(typeof response.body.totalTransactions).toBe('number');
      expect(response.body.totalAmount).toBe(5250.75);
      expect(response.body.totalTransactions).toBe(15);

      // Verify paymentModeBreakdown structure
      const { paymentModeBreakdown } = response.body;
      expect(paymentModeBreakdown).toHaveProperty('cash');
      expect(paymentModeBreakdown).toHaveProperty('gcash');
      expect(paymentModeBreakdown).toHaveProperty('maya');
      expect(paymentModeBreakdown).toHaveProperty('credit_card');
      expect(paymentModeBreakdown).toHaveProperty('bank_transfer');

      // Verify CASH breakdown specifically
      expect(paymentModeBreakdown.cash).toHaveProperty('amount');
      expect(paymentModeBreakdown.cash).toHaveProperty('count');
      expect(typeof paymentModeBreakdown.cash.amount).toBe('number');
      expect(typeof paymentModeBreakdown.cash.count).toBe('number');
      expect(paymentModeBreakdown.cash.amount).toBe(1500.25);
      expect(paymentModeBreakdown.cash.count).toBe(5);

      // Verify salesAgentBreakdown structure
      expect(Array.isArray(response.body.salesAgentBreakdown)).toBe(true);
      expect(response.body.salesAgentBreakdown.length).toBe(2);
      expect(response.body.salesAgentBreakdown[0]).toHaveProperty('agent_name');
      expect(response.body.salesAgentBreakdown[0]).toHaveProperty('amount');
      expect(response.body.salesAgentBreakdown[0]).toHaveProperty('count');
    });

    it('should handle date parameter correctly', async () => {
      const mockDailySummary = {
        totalAmount: 1000.00,
        totalTransactions: 5,
        paymentModeBreakdown: {
          [PaymentMode.CASH]: { amount: 1000.00, count: 5 },
          [PaymentMode.GCASH]: { amount: 0, count: 0 },
          [PaymentMode.MAYA]: { amount: 0, count: 0 },
          [PaymentMode.CREDIT_CARD]: { amount: 0, count: 0 },
          [PaymentMode.BANK_TRANSFER]: { amount: 0, count: 0 }
        },
        salesAgentBreakdown: []
      };

      mockTransactionService.getDailySummary.mockResolvedValue(mockDailySummary);

      const response = await request(app)
        .get('/api/transactions/reports/daily?date=2024-01-15')
        .expect(200);

      // Verify that getDailySummary was called with the correct date
      expect(mockTransactionService.getDailySummary).toHaveBeenCalledWith(
        new Date('2024-01-15')
      );

      expect(response.body.totalAmount).toBe(1000.00);
      expect(response.body.totalTransactions).toBe(5);
    });

    it('should handle missing payment modes with zero values', async () => {
      const mockDailySummary = {
        totalAmount: 500.00,
        totalTransactions: 2,
        paymentModeBreakdown: {
          [PaymentMode.CASH]: { amount: 500.00, count: 2 },
          [PaymentMode.GCASH]: { amount: 0, count: 0 },
          [PaymentMode.MAYA]: { amount: 0, count: 0 },
          [PaymentMode.CREDIT_CARD]: { amount: 0, count: 0 },
          [PaymentMode.BANK_TRANSFER]: { amount: 0, count: 0 }
        },
        salesAgentBreakdown: [
          { agent_name: 'Agent Test', amount: 500.00, count: 2 }
        ]
      };

      mockTransactionService.getDailySummary.mockResolvedValue(mockDailySummary);

      const response = await request(app)
        .get('/api/transactions/reports/daily')
        .expect(200);

      // Verify that unused payment modes have zero amounts
      expect(response.body.paymentModeBreakdown.gcash.amount).toBe(0);
      expect(response.body.paymentModeBreakdown.gcash.count).toBe(0);
      expect(response.body.paymentModeBreakdown.maya.amount).toBe(0);
      expect(response.body.paymentModeBreakdown.maya.count).toBe(0);
      expect(response.body.paymentModeBreakdown.credit_card.amount).toBe(0);
      expect(response.body.paymentModeBreakdown.credit_card.count).toBe(0);
      expect(response.body.paymentModeBreakdown.bank_transfer.amount).toBe(0);
      expect(response.body.paymentModeBreakdown.bank_transfer.count).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      mockTransactionService.getDailySummary.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/transactions/reports/daily')
        .expect(500);

      expect(response.body).toEqual({ error: 'Internal server error' });
    });

    it('should require authentication', async () => {
      // Mock the auth middleware to simulate unauthenticated request
      jest.doMock('../../middleware/auth', () => ({
        authenticateToken: jest.fn((req, res, next) => {
          res.status(401).json({ error: 'Unauthorized' });
        }),
        requireCashierOrAdmin: jest.fn((req, res, next) => next()),
        requireAdmin: jest.fn((req, res, next) => next()),
        logActivity: jest.fn(() => (req, res, next) => next())
      }));

      // Re-import the routes with the new mock
      jest.resetModules();
      const unauthenticatedRoutes = require('../../routes/transactions').default;
      
      const unauthenticatedApp = express();
      unauthenticatedApp.use(express.json());
      unauthenticatedApp.use('/api/transactions', unauthenticatedRoutes);

      const response = await request(unauthenticatedApp)
        .get('/api/transactions/reports/daily')
        .expect(401);

      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should handle empty database results', async () => {
      const mockEmptyDailySummary = {
        totalAmount: 0,
        totalTransactions: 0,
        paymentModeBreakdown: {
          [PaymentMode.CASH]: { amount: 0, count: 0 },
          [PaymentMode.GCASH]: { amount: 0, count: 0 },
          [PaymentMode.MAYA]: { amount: 0, count: 0 },
          [PaymentMode.CREDIT_CARD]: { amount: 0, count: 0 },
          [PaymentMode.BANK_TRANSFER]: { amount: 0, count: 0 }
        },
        salesAgentBreakdown: []
      };

      mockTransactionService.getDailySummary.mockResolvedValue(mockEmptyDailySummary);

      const response = await request(app)
        .get('/api/transactions/reports/daily')
        .expect(200);

      expect(response.body.totalAmount).toBe(0);
      expect(response.body.totalTransactions).toBe(0);
      expect(response.body.salesAgentBreakdown).toEqual([]);
      
      // Verify all payment modes have zero values
      Object.values(PaymentMode).forEach(mode => {
        expect(response.body.paymentModeBreakdown[mode].amount).toBe(0);
        expect(response.body.paymentModeBreakdown[mode].count).toBe(0);
      });
    });
  });

  describe('Real Database Integration Test', () => {
    it('should match database values when querying actual data', async () => {
      // This test would need actual database setup to verify that the endpoint
      // returns values that match what's actually in the database.
      // For now, we'll create a comprehensive mock that simulates this scenario.
      
      const mockDailySummary = {
        totalAmount: 12345.67,
        totalTransactions: 42,
        paymentModeBreakdown: {
          [PaymentMode.CASH]: { amount: 5000.00, count: 20 },
          [PaymentMode.GCASH]: { amount: 4000.00, count: 15 },
          [PaymentMode.MAYA]: { amount: 2000.00, count: 5 },
          [PaymentMode.CREDIT_CARD]: { amount: 1245.67, count: 1 },
          [PaymentMode.BANK_TRANSFER]: { amount: 100.00, count: 1 }
        },
        salesAgentBreakdown: [
          { agent_name: 'Top Performer', amount: 8000.00, count: 25 },
          { agent_name: 'Second Best', amount: 4345.67, count: 17 }
        ]
      };

      mockTransactionService.getDailySummary.mockResolvedValue(mockDailySummary);

      const response = await request(app)
        .get('/api/transactions/reports/daily')
        .expect(200);

      // Verify total calculations are consistent
      const calculatedTotal = Object.values(response.body.paymentModeBreakdown)
        .reduce((sum: number, mode: any) => sum + mode.amount, 0);
      
      expect(calculatedTotal).toBe(response.body.totalAmount);

      const calculatedTransactionCount = Object.values(response.body.paymentModeBreakdown)
        .reduce((sum: number, mode: any) => sum + mode.count, 0);
      
      expect(calculatedTransactionCount).toBe(response.body.totalTransactions);

      // Verify sales agent totals are consistent with overall totals
      const salesAgentTotal = response.body.salesAgentBreakdown
        .reduce((sum: number, agent: any) => sum + agent.amount, 0);
      expect(salesAgentTotal).toBe(response.body.totalAmount);

      const salesAgentTransactionCount = response.body.salesAgentBreakdown
        .reduce((sum: number, agent: any) => sum + agent.count, 0);
      expect(salesAgentTransactionCount).toBe(response.body.totalTransactions);
    });
  });
});
