import { QueueService } from '../../services/queue';
import { QueueStatus, UserRole } from '../../types';

// Mock database pool
jest.mock('../../config/database', () => ({
  pool: {
    connect: jest.fn(() => ({
      query: jest.fn(),
      release: jest.fn()
    })),
    query: jest.fn()
  }
}));

// Mock WebSocketService
jest.mock('../../services/websocket', () => ({
  WebSocketService: {
    emitQueueUpdate: jest.fn(),
    emitQueueStatusChanged: jest.fn()
  }
}));

// Mock QueueAnalyticsService
jest.mock('../../services/QueueAnalyticsService', () => ({
  QueueAnalyticsService: {
    recordQueueEvent: jest.fn()
  }
}));

describe('QueueService RBAC Enforcement', () => {
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    
    // Mock pool.connect to return our mock client
    const { pool } = require('../../config/database');
    pool.connect.mockResolvedValue(mockClient);
  });

  describe('changeStatus RBAC Enforcement', () => {
    beforeEach(() => {
      // Mock successful database queries for getting customer status
      mockClient.query.mockImplementation((query: string) => {
        if (query.includes('SELECT id, name, queue_status')) {
          return { rows: [{ id: 1, name: 'Test Customer', queue_status: 'serving' }] };
        }
        if (query.includes('UPDATE customers')) {
          return { rows: [{ id: 1, name: 'Test Customer', queue_status: 'processing' }] };
        }
        if (query.includes('BEGIN') || query.includes('COMMIT')) {
          return { rows: [] };
        }
        if (query.includes('INSERT INTO queue_events')) {
          return { rows: [] };
        }
        return { rows: [] };
      });
    });

    describe('Super Admin permissions', () => {
      it('should allow Super Admin to perform any valid transition', async () => {
        const result = await QueueService.changeStatus(
          1, 
          QueueStatus.PROCESSING, 
          1, 
          UserRole.SUPER_ADMIN
        );

        expect(result).toBeDefined();
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      });
    });

    describe('Admin permissions', () => {
      it('should allow Admin to perform any valid transition', async () => {
        const result = await QueueService.changeStatus(
          1, 
          QueueStatus.PROCESSING, 
          1, 
          UserRole.ADMIN
        );

        expect(result).toBeDefined();
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      });

      it('should allow Admin to perform valid transitions', async () => {
        // Setup a different current status (Waiting -> Serving is valid)
        mockClient.query.mockImplementation((query: string) => {
          if (query.includes('SELECT id, name, queue_status')) {
            return { rows: [{ id: 1, name: 'Test Customer', queue_status: 'waiting' }] };
          }
          if (query.includes('UPDATE customers')) {
            return { rows: [{ id: 1, name: 'Test Customer', queue_status: 'serving' }] };
          }
          return { rows: [] };
        });

        const result = await QueueService.changeStatus(
          1, 
          QueueStatus.SERVING, 
          1, 
          UserRole.ADMIN
        );

        expect(result).toBeDefined();
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      });
    });

    describe('Cashier permissions', () => {
      it('should allow Cashier to perform Serve → Processing transition', async () => {
        const result = await QueueService.changeStatus(
          1, 
          QueueStatus.PROCESSING, 
          1, 
          UserRole.CASHIER
        );

        expect(result).toBeDefined();
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      });

      it('should allow Cashier to perform standard transitions', async () => {
        // Test Waiting → Serving
        mockClient.query.mockImplementation((query: string) => {
          if (query.includes('SELECT id, name, queue_status')) {
            return { rows: [{ id: 1, name: 'Test Customer', queue_status: 'waiting' }] };
          }
          if (query.includes('UPDATE customers')) {
            return { rows: [{ id: 1, name: 'Test Customer', queue_status: 'serving' }] };
          }
          return { rows: [] };
        });

        const result = await QueueService.changeStatus(
          1, 
          QueueStatus.SERVING, 
          1, 
          UserRole.CASHIER
        );

        expect(result).toBeDefined();
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      });

      it('should allow Cashier to cancel from any status', async () => {
        const result = await QueueService.changeStatus(
          1, 
          QueueStatus.CANCELLED, 
          1, 
          UserRole.CASHIER
        );

        expect(result).toBeDefined();
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      });

      it('should reject Cashier from non-standard transitions', async () => {
        // Actually, we need to test this differently since business logic validation
        // happens before RBAC. Let's verify that Cashiers can only do allowed transitions
        // by checking the validation logic directly
        const { isTransitionAllowedForRole } = QueueService as any;
        
        // Test that Cashier cannot do some transitions that Admin can
        expect(isTransitionAllowedForRole(
          UserRole.CASHIER, 
          QueueStatus.WAITING, 
          QueueStatus.PROCESSING
        )).toBe(false);
        
        // But can do allowed ones
        expect(isTransitionAllowedForRole(
          UserRole.CASHIER, 
          QueueStatus.SERVING, 
          QueueStatus.PROCESSING
        )).toBe(true);
      });
    });

    describe('Sales permissions', () => {
      it('should reject Sales from performing any transitions', async () => {
        await expect(QueueService.changeStatus(
          1, 
          QueueStatus.PROCESSING, 
          1, 
          UserRole.SALES
        )).rejects.toThrow('Access denied');

        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      });
    });

    describe('Invalid status transitions', () => {
      it('should reject invalid transitions regardless of role', async () => {
        // Try to go from Completed to Processing (invalid)
        mockClient.query.mockImplementation((query: string) => {
          if (query.includes('SELECT id, name, queue_status')) {
            return { rows: [{ id: 1, name: 'Test Customer', queue_status: 'completed' }] };
          }
          return { rows: [] };
        });

        await expect(QueueService.changeStatus(
          1, 
          QueueStatus.PROCESSING, 
          1, 
          UserRole.ADMIN
        )).rejects.toThrow('Invalid status transition');

        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      });
    });

    describe('No user role provided', () => {
      it('should allow transitions when no userRole is provided (backward compatibility)', async () => {
        const result = await QueueService.changeStatus(
          1, 
          QueueStatus.PROCESSING, 
          1
        );

        expect(result).toBeDefined();
        expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      });
    });

    describe('Error handling', () => {
      it('should handle database errors gracefully', async () => {
        mockClient.query.mockRejectedValue(new Error('Database connection failed'));

        await expect(QueueService.changeStatus(
          1, 
          QueueStatus.PROCESSING, 
          1, 
          UserRole.CASHIER
        )).rejects.toThrow('Database connection failed');

        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      });

      it('should handle customer not found', async () => {
        mockClient.query.mockImplementation((query: string) => {
          if (query.includes('SELECT id, name, queue_status')) {
            return { rows: [] }; // No customer found
          }
          return { rows: [] };
        });

        await expect(QueueService.changeStatus(
          999, 
          QueueStatus.PROCESSING, 
          1, 
          UserRole.CASHIER
        )).rejects.toThrow('Customer not found');

        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      });
    });
  });

  describe('RBAC transition validation logic', () => {
    const { isTransitionAllowedForRole } = QueueService as any;

    it('should correctly validate Super Admin permissions', () => {
      expect(isTransitionAllowedForRole(
        UserRole.SUPER_ADMIN, 
        QueueStatus.SERVING, 
        QueueStatus.PROCESSING
      )).toBe(true);

      expect(isTransitionAllowedForRole(
        UserRole.SUPER_ADMIN, 
        QueueStatus.WAITING, 
        QueueStatus.COMPLETED
      )).toBe(true);
    });

    it('should correctly validate Admin permissions', () => {
      expect(isTransitionAllowedForRole(
        UserRole.ADMIN, 
        QueueStatus.SERVING, 
        QueueStatus.PROCESSING
      )).toBe(true);

      expect(isTransitionAllowedForRole(
        UserRole.ADMIN, 
        QueueStatus.WAITING, 
        QueueStatus.COMPLETED
      )).toBe(true);
    });

    it('should correctly validate Cashier permissions', () => {
      // Valid Cashier transitions
      expect(isTransitionAllowedForRole(
        UserRole.CASHIER, 
        QueueStatus.SERVING, 
        QueueStatus.PROCESSING
      )).toBe(true);

      expect(isTransitionAllowedForRole(
        UserRole.CASHIER, 
        QueueStatus.WAITING, 
        QueueStatus.SERVING
      )).toBe(true);

      expect(isTransitionAllowedForRole(
        UserRole.CASHIER, 
        QueueStatus.SERVING, 
        QueueStatus.CANCELLED
      )).toBe(true);

      // Invalid Cashier transitions
      expect(isTransitionAllowedForRole(
        UserRole.CASHIER, 
        QueueStatus.WAITING, 
        QueueStatus.PROCESSING
      )).toBe(false);
    });

    it('should correctly validate Sales permissions', () => {
      // Sales should not be able to perform any transitions
      expect(isTransitionAllowedForRole(
        UserRole.SALES, 
        QueueStatus.SERVING, 
        QueueStatus.PROCESSING
      )).toBe(false);

      expect(isTransitionAllowedForRole(
        UserRole.SALES, 
        QueueStatus.WAITING, 
        QueueStatus.SERVING
      )).toBe(false);
    });
  });
});
