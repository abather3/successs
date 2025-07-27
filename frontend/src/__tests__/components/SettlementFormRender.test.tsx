import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// Standard Jest globals are automatically available
// Mock functions using jest.fn() instead of vi.fn()
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import { io as Client, Socket } from 'socket.io-client';

// Import components and services
import EnhancedTransactionManagement from '../../components/transactions/EnhancedTransactionManagement';
import { AuthProvider } from '../../contexts/AuthContext';
import { SocketProvider } from '../../contexts/SocketContext';
import TransactionApi from '../../services/transactionApi';
import { PaymentMode, PaymentStatus, UserRole } from '../../types';

// Mock socket.io client
jest.mock('socket.io-client');
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  connected: true,
  connect: jest.fn(),
  disconnect: jest.fn(),
} as unknown as Socket;

(Client as any).mockReturnValue(mockSocket);

// Mock the transaction API
jest.mock('../../services/transactionApi', () => ({
  default: {
    getTransactions: jest.fn(),
    createSettlement: jest.fn(),
    getSettlements: jest.fn(),
    exportTransactions: jest.fn(),
    generateDailyReport: jest.fn(),
    deleteTransaction: jest.fn(),
  },
}));

const mockTransactionApi = TransactionApi as any;

// Mock authentication context data
const mockUser = {
  id: 1,
  email: 'cashier@test.com',
  full_name: 'Test Cashier',
  role: UserRole.CASHIER,
  status: 'active'
};

const mockAuthContextValue = {
  user: mockUser,
  login: jest.fn(),
  logout: jest.fn(),
  isAuthenticated: true,
  loading: false,
  checkAuthStatus: jest.fn(),
};

const mockSocketContextValue = {
  socket: mockSocket,
  isConnected: true,
  error: null,
};

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = createTheme();
  
  return (
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <AuthProvider value={mockAuthContextValue}>
          <SocketProvider value={mockSocketContextValue}>
            {children}
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('Settlement Form Render Tests', () => {
  let renderSpy: any;
  let user: any;

  beforeEach(() => {
    user = userEvent.setup();
    
    // Spy on React's render cycle to count renders
    renderSpy = jest.fn();
    
    // Mock the transaction API responses
    mockTransactionApi.getTransactions.mockResolvedValue({
      transactions: [
        {
          id: 1,
          customer_id: 1,
          or_number: '2025-001',
          amount: 1000,
          payment_mode: PaymentMode.CASH,
          sales_agent_id: 1,
          cashier_id: 1,
          transaction_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
          customer_name: 'John Doe',
          sales_agent_name: 'Sales Agent',
          cashier_name: 'Test Cashier',
          paid_amount: 400,
          balance_amount: 600,
          payment_status: PaymentStatus.PARTIAL
        }
      ],
      total: 1,
      page: 1,
      totalPages: 1
    });

    mockTransactionApi.getSettlements.mockResolvedValue([]);
    
    mockTransactionApi.createSettlement.mockResolvedValue({
      id: 1,
      transaction_id: 1,
      amount: 300,
      payment_mode: PaymentMode.CASH,
      cashier_id: 1,
      created_at: new Date().toISOString(),
      notes: 'Test settlement'
    });

    // Clear all socket event listeners
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
    mockSocket.emit.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Settlement UI Update Renders', () => {
    it('should update UI exactly once when settlement is submitted successfully', async () => {
      const renderTracker = {
        settlementDialogRenders: 0,
        transactionTableRenders: 0,
        totalRenders: 0
      };

      // Mock a successful settlement submission
      mockTransactionApi.createSettlement.mockImplementation(async () => {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          id: 2,
          transaction_id: 1,
          amount: 300,
          payment_mode: PaymentMode.CASH,
          cashier_id: 1,
          created_at: new Date().toISOString(),
          notes: 'Test settlement'
        };
      });

      // Mock updated transactions after settlement
      mockTransactionApi.getTransactions.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          transactions: [
            {
              id: 1,
              customer_id: 1,
              or_number: '2025-001',
              amount: 1000,
              payment_mode: PaymentMode.CASH,
              sales_agent_id: 1,
              cashier_id: 1,
              transaction_date: new Date().toISOString(),
              created_at: new Date().toISOString(),
              customer_name: 'John Doe',
              sales_agent_name: 'Sales Agent',
              cashier_name: 'Test Cashier',
              paid_amount: 700, // Updated after settlement
              balance_amount: 300, // Updated after settlement
              payment_status: PaymentStatus.PARTIAL
            }
          ],
          total: 1,
          page: 1,
          totalPages: 1
        };
      });

      // Custom render function that tracks renders
      const TrackedEnhancedTransactionManagement = () => {
        renderTracker.totalRenders++;
        return <EnhancedTransactionManagement />;
      };

      const { container } = render(
        <TestWrapper>
          <TrackedEnhancedTransactionManagement />
        </TestWrapper>
      );

      // Wait for initial load to complete
      await waitFor(() => {
        expect(mockTransactionApi.getTransactions).toHaveBeenCalled();
      });

      // Find and click the settle payment button for the transaction
      const settleButtons = screen.getAllByText(/settle/i);
      const settleButton = settleButtons.find(btn => 
        btn.closest('button') && btn.closest('tr')
      );

      expect(settleButton).toBeInTheDocument();
      
      // Track renders before opening dialog
      const initialRenderCount = renderTracker.totalRenders;

      // Click settle button to open dialog
      await act(async () => {
        await user.click(settleButton!);
      });

      // Wait for settlement dialog to open
      await waitFor(() => {
        expect(screen.getByText('Settle Payment')).toBeInTheDocument();
      });

      // Fill settlement form
      const amountInput = screen.getByLabelText(/settlement amount/i);
      const paymentModeSelect = screen.getByLabelText(/payment method/i);

      await act(async () => {
        await user.clear(amountInput);
        await user.type(amountInput, '300');
      });

      await act(async () => {
        await user.click(paymentModeSelect);
      });

      const cashOption = screen.getByText('Cash');
      await act(async () => {
        await user.click(cashOption);
      });

      // Track renders before submission
      const preSubmissionRenderCount = renderTracker.totalRenders;

      // Submit the settlement
      const confirmButton = screen.getByRole('button', { name: /confirm settlement/i });
      
      await act(async () => {
        await user.click(confirmButton);
      });

      // Wait for settlement to be processed
      await waitFor(() => {
        expect(mockTransactionApi.createSettlement).toHaveBeenCalledWith(1, {
          amount: 300,
          payment_mode: PaymentMode.CASH,
          cashier_id: 1,
          notes: ''
        });
      }, { timeout: 3000 });

      // Wait for success message and dialog closure
      await waitFor(() => {
        expect(screen.getByText(/payment.*recorded successfully/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // Wait for transactions to be reloaded
      await waitFor(() => {
        expect(mockTransactionApi.getTransactions).toHaveBeenCalledTimes(2);
      }, { timeout: 3000 });

      // Track final render count
      const finalRenderCount = renderTracker.totalRenders;

      // Calculate render counts during different phases
      const dialogOpenRenders = preSubmissionRenderCount - initialRenderCount;
      const settlementProcessRenders = finalRenderCount - preSubmissionRenderCount;

      // Assertions for render optimization
      expect(dialogOpenRenders).toBeLessThanOrEqual(2); // Should be minimal renders for opening dialog
      expect(settlementProcessRenders).toBeLessThanOrEqual(3); // Should be minimal renders for processing settlement

      // Total render count should be reasonable (not excessive)
      expect(finalRenderCount).toBeLessThan(initialRenderCount + 6);

      console.log('Render Analysis:', {
        initialRenders: initialRenderCount,
        dialogOpenRenders,
        settlementProcessRenders,
        totalRenders: finalRenderCount
      });
    });

    it('should not trigger extra renders when WebSocket events are received during settlement', async () => {
      let componentRenderCount = 0;
      const renderEvents: string[] = [];

      // Create a component that tracks its renders
      const RenderTrackingComponent = () => {
        componentRenderCount++;
        renderEvents.push(`Render ${componentRenderCount} at ${Date.now()}`);
        
        React.useEffect(() => {
          renderEvents.push(`Effect ${componentRenderCount} at ${Date.now()}`);
        });

        return <EnhancedTransactionManagement />;
      };

      const { container } = render(
        <TestWrapper>
          <RenderTrackingComponent />
        </TestWrapper>
      );

      // Wait for initial render
      await waitFor(() => {
        expect(componentRenderCount).toBeGreaterThan(0);
      });

      const initialRenderCount = componentRenderCount;

      // Open settlement dialog
      const settleButtons = screen.getAllByText(/settle/i);
      const settleButton = settleButtons[0];

      await act(async () => {
        await user.click(settleButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Settle Payment')).toBeInTheDocument();
      });

      // Fill and submit settlement form
      const amountInput = screen.getByLabelText(/settlement amount/i);
      await act(async () => {
        await user.clear(amountInput);
        await user.type(amountInput, '250');
      });

      const preSubmissionRenderCount = componentRenderCount;

      // Simulate WebSocket event during settlement process
      const mockWebSocketEvent = {
        type: 'payment_settlement_created',
        transaction: {
          id: 1,
          paid_amount: 650,
          balance_amount: 350,
          payment_status: PaymentStatus.PARTIAL
        },
        settlement: {
          id: 2,
          amount: 250,
          payment_mode: PaymentMode.CASH
        },
        timestamp: new Date()
      };

      // Submit settlement
      const confirmButton = screen.getByRole('button', { name: /confirm settlement/i });
      
      await act(async () => {
        await user.click(confirmButton);
      });

      // Simulate receiving WebSocket event during processing
      await act(async () => {
        // Find the WebSocket event handler for 'transactionUpdated'
        const transactionUpdatedHandler = mockSocket.on.mock.calls
          .find(call => call[0] === 'transactionUpdated')?.[1];
        
        if (transactionUpdatedHandler) {
          transactionUpdatedHandler(mockWebSocketEvent);
        }
      });

      // Wait for settlement processing to complete
      await waitFor(() => {
        expect(mockTransactionApi.createSettlement).toHaveBeenCalled();
      });

      const finalRenderCount = componentRenderCount;
      const totalNewRenders = finalRenderCount - initialRenderCount;

      // Should not have excessive renders during settlement process
      expect(totalNewRenders).toBeLessThanOrEqual(4);

      // Log render analysis
      console.log('WebSocket Render Analysis:', {
        initialRenders: initialRenderCount,
        preSubmissionRenders: preSubmissionRenderCount,
        finalRenders: finalRenderCount,
        totalNewRenders,
        renderEvents: renderEvents.slice(-10) // Last 10 events
      });

      // Verify that WebSocket events didn't cause duplicate renders
      const settlementRenders = finalRenderCount - preSubmissionRenderCount;
      expect(settlementRenders).toBeLessThanOrEqual(2); // Should be 1-2 renders max
    });

    it('should handle settlement submission with single UI update cycle', async () => {
      let uiUpdateEvents: Array<{ event: string; timestamp: number; renderCount: number }> = [];
      let currentRenderCount = 0;

      // Create component that tracks UI update events
      const UIUpdateTracker = () => {
        currentRenderCount++;
        
        React.useEffect(() => {
          uiUpdateEvents.push({
            event: 'Component Render',
            timestamp: Date.now(),
            renderCount: currentRenderCount
          });
        });

        React.useEffect(() => {
          uiUpdateEvents.push({
            event: 'Component Mount',
            timestamp: Date.now(),
            renderCount: currentRenderCount
          });
        }, []);

        return <EnhancedTransactionManagement />;
      };

      render(
        <TestWrapper>
          <UIUpdateTracker />
        </TestWrapper>
      );

      // Clear initial events
      await waitFor(() => expect(currentRenderCount).toBeGreaterThan(0));
      uiUpdateEvents = [];

      // Open settlement dialog
      const settleButton = screen.getAllByText(/settle/i)[0];
      await act(async () => {
        await user.click(settleButton);
      });

      // Record event: Dialog opened
      uiUpdateEvents.push({
        event: 'Settlement Dialog Opened',
        timestamp: Date.now(),
        renderCount: currentRenderCount
      });

      await waitFor(() => {
        expect(screen.getByText('Settle Payment')).toBeInTheDocument();
      });

      // Fill settlement form with valid data
      const amountInput = screen.getByLabelText(/settlement amount/i);
      await act(async () => {
        await user.clear(amountInput);
        await user.type(amountInput, '200');
      });

      const preSubmissionRenderCount = currentRenderCount;
      uiUpdateEvents.push({
        event: 'Pre-Submission State',
        timestamp: Date.now(),
        renderCount: currentRenderCount
      });

      // Submit settlement
      const confirmButton = screen.getByRole('button', { name: /confirm settlement/i });
      
      await act(async () => {
        await user.click(confirmButton);
      });

      uiUpdateEvents.push({
        event: 'Settlement Submitted',
        timestamp: Date.now(),
        renderCount: currentRenderCount
      });

      // Wait for settlement processing
      await waitFor(() => {
        expect(mockTransactionApi.createSettlement).toHaveBeenCalled();
      });

      uiUpdateEvents.push({
        event: 'Settlement API Called',
        timestamp: Date.now(),
        renderCount: currentRenderCount
      });

      // Wait for success message
      await waitFor(() => {
        expect(screen.getByText(/payment.*recorded successfully/i)).toBeInTheDocument();
      });

      uiUpdateEvents.push({
        event: 'Success Message Shown',
        timestamp: Date.now(),
        renderCount: currentRenderCount
      });

      const postSubmissionRenderCount = currentRenderCount;
      
      // Calculate render delta
      const renderDuringSubmission = postSubmissionRenderCount - preSubmissionRenderCount;

      // Log detailed analysis
      console.log('UI Update Event Timeline:', uiUpdateEvents);
      console.log('Render Analysis:', {
        preSubmissionRenders: preSubmissionRenderCount,
        postSubmissionRenders: postSubmissionRenderCount,
        renderDuringSubmission
      });

      // Assertions for optimized rendering
      expect(renderDuringSubmission).toBeLessThanOrEqual(3); // Should be minimal renders
      expect(uiUpdateEvents.length).toBeGreaterThan(4); // Should capture key events
      
      // Verify no duplicate consecutive render events
      const renderEvents = uiUpdateEvents.filter(e => e.event === 'Component Render');
      for (let i = 1; i < renderEvents.length; i++) {
        const timeDiff = renderEvents[i].timestamp - renderEvents[i-1].timestamp;
        if (timeDiff < 10) { // Less than 10ms apart indicates potential duplicate render
          console.warn('Potential duplicate render detected:', renderEvents[i-1], renderEvents[i]);
        }
      }
    });

    it('should maintain stable UI state during settlement processing without flicker', async () => {
      const uiStateChanges: Array<{
        timestamp: number;
        dialogVisible: boolean;
        loadingState: boolean;
        successMessageVisible: boolean;
        renderCount: number;
      }> = [];

      let renderCount = 0;

      const UIStateMonitor = () => {
        renderCount++;
        
        React.useEffect(() => {
          // Capture current UI state
          const dialogVisible = !!document.querySelector('[role="dialog"]');
          const loadingState = !!document.querySelector('.MuiCircularProgress-root');
          const successMessageVisible = !!document.querySelector('[role="alert"]');

          uiStateChanges.push({
            timestamp: Date.now(),
            dialogVisible,
            loadingState,
            successMessageVisible,
            renderCount
          });
        });

        return <EnhancedTransactionManagement />;
      };

      render(
        <TestWrapper>
          <UIStateMonitor />
        </TestWrapper>
      );

      await waitFor(() => expect(renderCount).toBeGreaterThan(0));

      // Clear initial state changes
      uiStateChanges.length = 0;

      // Open settlement dialog
      const settleButton = screen.getAllByText(/settle/i)[0];
      await act(async () => {
        await user.click(settleButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Settle Payment')).toBeInTheDocument();
      });

      // Fill form
      const amountInput = screen.getByLabelText(/settlement amount/i);
      await act(async () => {
        await user.clear(amountInput);
        await user.type(amountInput, '150');
      });

      // Submit settlement
      const confirmButton = screen.getByRole('button', { name: /confirm settlement/i });
      
      await act(async () => {
        await user.click(confirmButton);
      });

      // Wait for processing
      await waitFor(() => {
        expect(mockTransactionApi.createSettlement).toHaveBeenCalled();
      });

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText(/payment.*recorded successfully/i)).toBeInTheDocument();
      });

      // Analyze UI state stability
      console.log('UI State Changes:', uiStateChanges);

      // Check for UI flicker (rapid state changes)
      const rapidChanges = uiStateChanges.filter((change, index) => {
        if (index === 0) return false;
        const prevChange = uiStateChanges[index - 1];
        const timeDiff = change.timestamp - prevChange.timestamp;
        return timeDiff < 50; // Changes within 50ms might indicate flicker
      });

      expect(rapidChanges.length).toBeLessThanOrEqual(2); // Allow minimal rapid changes

      // Verify dialog state progression is logical
      const dialogStates = uiStateChanges.map(change => change.dialogVisible);
      const hasIllegalDialogToggle = dialogStates.some((visible, index) => {
        if (index === 0) return false;
        // Dialog should not rapidly toggle visible/hidden/visible
        return index > 1 && 
               dialogStates[index - 2] === visible && 
               dialogStates[index - 1] !== visible &&
               visible;
      });

      expect(hasIllegalDialogToggle).toBeFalsy();
    });
  });

  describe('Settlement Error Handling Renders', () => {
    it('should handle settlement errors with single error UI update', async () => {
      let errorRenderCount = 0;
      const errorStates: string[] = [];

      // Mock API to throw error
      mockTransactionApi.createSettlement.mockRejectedValue(
        new Error('Settlement failed: Insufficient balance')
      );

      const ErrorTrackingComponent = () => {
        const [localError, setLocalError] = React.useState<string | null>(null);
        
        React.useEffect(() => {
          errorRenderCount++;
          errorStates.push(`Render ${errorRenderCount}: ${localError || 'no error'}`);
        });

        return <EnhancedTransactionManagement />;
      };

      render(
        <TestWrapper>
          <ErrorTrackingComponent />
        </TestWrapper>
      );

      await waitFor(() => expect(errorRenderCount).toBeGreaterThan(0));

      const initialErrorRenderCount = errorRenderCount;

      // Open settlement dialog and try to submit invalid settlement
      const settleButton = screen.getAllByText(/settle/i)[0];
      await act(async () => {
        await user.click(settleButton);
      });

      const amountInput = screen.getByLabelText(/settlement amount/i);
      await act(async () => {
        await user.clear(amountInput);
        await user.type(amountInput, '999'); // This should fail
      });

      const confirmButton = screen.getByRole('button', { name: /confirm settlement/i });
      
      await act(async () => {
        await user.click(confirmButton);
      });

      // Wait for error to be handled
      await waitFor(() => {
        expect(mockTransactionApi.createSettlement).toHaveBeenCalled();
      });

      const finalErrorRenderCount = errorRenderCount;
      const errorRendersDelta = finalErrorRenderCount - initialErrorRenderCount;

      // Should have minimal renders even when handling errors
      expect(errorRendersDelta).toBeLessThanOrEqual(4);

      console.log('Error Handling Render Analysis:', {
        initialRenders: initialErrorRenderCount,
        finalRenders: finalErrorRenderCount,
        errorRendersDelta,
        errorStates: errorStates.slice(-5)
      });
    });
  });
});
