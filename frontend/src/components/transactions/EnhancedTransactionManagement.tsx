import React, { useState, useEffect, useCallback } from 'react';
import { 
  Typography, 
  Box, 
  Card, 
  CardContent, 
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  useTheme,
  useMediaQuery,
  Stack,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Divider,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  TablePagination,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Fade,
  Grow,
  DialogContentText,
  Snackbar
} from '@mui/material';
import { 
  Receipt as ReceiptIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  GetApp as ExportIcon,
  Assessment as ReportIcon,
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  FileDownload as FileDownloadIcon,
  Print as PrintIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Timeline as TimelineIcon,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  Speed as SpeedIcon,
  CalendarToday as CalendarTodayIcon,
  Event as EventIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  RestoreFromTrash as RestoreFromTrashIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { Transaction, DailyReport, Expense, Fund, PaymentMode, PaymentStatus, UserRole } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import TransactionApi from '../../services/transactionApi';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// UUID generation utility (fallback for frontend)
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`simple-tabpanel-${index}`}
    aria-labelledby={`simple-tab-${index}`}
  >
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

const EnhancedTransactionManagement: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();
  const { socket } = useSocket();
  
  // Consistent currency formatting function
  const formatCurrency = (amount: number | string): string => {
    // Convert string to number if needed
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (isNaN(numAmount) || numAmount === null || numAmount === undefined) return '₱0.00';
    if (numAmount === 0) return '₱0.00';
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numAmount);
  };
  
  // State management
  const [tabValue, setTabValue] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: ''
  });
  const [paymentModeFilter, setPaymentModeFilter] = useState<PaymentMode | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Daily Report Management
  const [dailyReportDialog, setDailyReportDialog] = useState(false);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [pettyCashStart, setPettyCashStart] = useState(0);
  const [pettyCashEnd, setPettyCashEnd] = useState(0);
  const [generatedReport, setGeneratedReport] = useState<DailyReport | null>(null);
  
  // Export dialog
  const [exportDialog, setExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf' | 'csv'>('excel');
  
  // Past reports dialog
  const [pastReportsDialog, setPastReportsDialog] = useState(false);
  
  // Delete and Reset dialogs (Admin only)
  const [deleteReportDialog, setDeleteReportDialog] = useState(false);
  const [deleteDate, setDeleteDate] = useState('');
  const [resetSystemDialog, setResetSystemDialog] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  
  // Settlement dialog
  const [settleDialog, setSettleDialog] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [settlementAmount, setSettlementAmount] = useState(0);
  const [settlementPaymentMode, setSettlementPaymentMode] = useState<PaymentMode>(PaymentMode.CASH);
  const [settlementNotes, setSettlementNotes] = useState('');
  const [settlementHistory, setSettlementHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Delete transaction dialog
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  
  // Past reports state - loaded from API
  const [pastReports, setPastReports] = useState<Array<{
    date: string;
    summary: string;
    transactions: number;
    revenue: number;
  }>>([]);
  
  // Check if user is admin
  const isAdmin = user?.role === UserRole.ADMIN;

  // Mock data for demonstration
  const mockTransactions: Transaction[] = [
    {
      id: 1,
      customer_id: 1,
      or_number: '20250108-001',
      amount: 1500,
      payment_mode: PaymentMode.GCASH,
      sales_agent_id: 1,
      cashier_id: 1,
      transaction_date: '2025-07-08T10:00:00Z',
      created_at: '2025-07-08T10:00:00Z',
      customer_name: 'John Doe',
      sales_agent_name: 'Agent Smith',
      cashier_name: 'Cashier Jones',
      paid_amount: 1500,
      balance_amount: 0,
      payment_status: PaymentStatus.PAID
    },
    {
      id: 2,
      customer_id: 2,
      or_number: '20250108-002',
      amount: 2500,
      payment_mode: PaymentMode.CREDIT_CARD,
      sales_agent_id: 1,
      cashier_id: 1,
      transaction_date: '2025-07-08T11:00:00Z',
      created_at: '2025-07-08T11:00:00Z',
      customer_name: 'Jane Smith',
      sales_agent_name: 'Agent Smith',
      cashier_name: 'Cashier Jones',
      paid_amount: 1200,
      balance_amount: 1300,
      payment_status: PaymentStatus.PARTIAL
    },
    {
      id: 3,
      customer_id: 3,
      or_number: '20250108-003',
      amount: 3500,
      payment_mode: PaymentMode.CASH,
      sales_agent_id: 2,
      cashier_id: 1,
      transaction_date: '2025-07-08T12:00:00Z',
      created_at: '2025-07-08T12:00:00Z',
      customer_name: 'Maria Garcia',
      sales_agent_name: 'Agent Brown',
      cashier_name: 'Cashier Jones',
      paid_amount: 0,
      balance_amount: 3500,
      payment_status: PaymentStatus.UNPAID
    }
  ];

  // Load transactions from API
  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        paymentMode: paymentModeFilter || undefined,
        page: page + 1, // API uses 1-based pagination
        limit: rowsPerPage,
      };

      const response = await TransactionApi.getTransactions(filters);
      setTransactions(response.transactions);
      setTotalCount(response.pagination.total);
    } catch (err) {
      console.error('Error loading transactions:', err);
      setError('Failed to load transactions. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, dateFilter, paymentModeFilter, searchQuery]);

  // Real API implementation - Load transactions on component mount and filter changes
  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Load daily reports only when Daily Reports tab is active
  useEffect(() => {
    if (tabValue === 1) {
      loadDailyReports();
    }
  }, [tabValue]);

  // Load daily reports for the past reports functionality
  const loadDailyReports = async () => {
    try {
      // Get past 30 days of reports
      const reports = [];
      const today = new Date();
      
      for (let i = 0; i <= 30; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        
        try {
          const report = await TransactionApi.getDailyReport(dateString);
          // Check if report exists and has valid data
          if (report && report.exists !== false) {
            const revenue = Number(report.total_cash || 0) + Number(report.total_gcash || 0) + Number(report.total_credit_card || 0) + Number(report.total_maya || 0) + Number(report.total_bank_transfer || 0);
            const totalRevenue = Math.round(revenue * 100) / 100;
            reports.push({
              date: dateString,
              summary: `Revenue: ₱${totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              transactions: report.transaction_count || 0,
              revenue: totalRevenue
            });
          } else if (report && report.exists === false) {
            // API returned {exists: false}, skip this date
            console.log(`No daily report exists for ${dateString}`);
            continue;
          }
        } catch (err: any) {
          // Skip if report doesn't exist for this date (404 errors are expected)
          // Only log if it's not a 404 error
          if (err?.response?.status !== 404 && err?.status !== 404) {
            console.warn(`Error loading report for ${dateString}:`, err);
          } else {
            // Log 404 errors once for dev awareness, but don't show user alerts
            console.log(`No daily report found for ${dateString} (404)`);
          }
          continue;
        }
      }
      
      // If no reports found, keep the existing mock data for demonstration
      if (reports.length === 0) {
        console.log('No daily reports found in database, using mock data for demonstration');
        // Keep the existing mock data that was initialized in state
      } else {
        setPastReports(reports);
      }
    } catch (err) {
      console.error('Error loading daily reports:', err);
    }
  };

  const getPaymentModeLabel = (mode: PaymentMode | string) => {
    switch (mode) {
      case PaymentMode.GCASH:
      case 'gcash':
        return 'GCash';
      case PaymentMode.MAYA:
      case 'maya':
        return 'Maya';
      case PaymentMode.BANK_TRANSFER:
      case 'bank_transfer':
        return 'Bank Transfer';
      case PaymentMode.CREDIT_CARD:
      case 'credit_card':
        return 'Credit Card';
      case PaymentMode.CASH:
      case 'cash':
        return 'Cash';
      default:
        return 'Unknown';
    }
  };

  const getPaymentModeColor = (mode: PaymentMode | string) => {
    switch (mode) {
      case PaymentMode.GCASH:
      case 'gcash':
        return 'primary';
      case PaymentMode.MAYA:
      case 'maya':
        return 'secondary';
      case PaymentMode.BANK_TRANSFER:
      case 'bank_transfer':
        return 'info';
      case PaymentMode.CREDIT_CARD:
      case 'credit_card':
        return 'warning';
      case PaymentMode.CASH:
      case 'cash':
        return 'success';
      default:
        return 'default';
    }
  };

  const getPaymentStatusLabel = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PAID:
        return 'Paid';
      case PaymentStatus.PARTIAL:
        return 'Partial';
      case PaymentStatus.UNPAID:
        return 'Unpaid';
      default:
        return 'Unknown';
    }
  };

  const getPaymentStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PAID:
        return 'success';
      case PaymentStatus.PARTIAL:
        return 'warning';
      case PaymentStatus.UNPAID:
        return 'error';
      default:
        return 'default';
    }
  };

  const handleSettleTransaction = async (transaction: Transaction) => {
    // Guard against undefined transaction or ID
    if (!transaction || !transaction.id || isNaN(transaction.id)) {
      setError('Invalid transaction selected. Please try again.');
      return;
    }
    
    setSelectedTransaction(transaction);
    setSettlementAmount(transaction.balance_amount);
    setSettlementPaymentMode(PaymentMode.CASH);
    setSettlementNotes('');
    setSuccessMessage('');
    setSettleDialog(true);
    
    // Load settlement history for this transaction
    await loadSettlementHistory(transaction.id);
  };
  
  const loadSettlementHistory = async (transactionId: number) => {
    // Guard against invalid transaction ID
    if (!transactionId || isNaN(transactionId) || transactionId <= 0) {
      console.error('Invalid transaction ID provided to loadSettlementHistory:', transactionId);
      setSettlementHistory([]);
      return;
    }
    
    setLoadingHistory(true);
    console.log(`[SETTLEMENT_HISTORY] Loading history for transaction ${transactionId}`);
    
    try {
      const history = await TransactionApi.getSettlementHistory(transactionId);
      console.log(`[SETTLEMENT_HISTORY] Successfully loaded ${history.length} settlements for transaction ${transactionId}:`, history);
      setSettlementHistory(history || []);
    } catch (err) {
      console.error(`[SETTLEMENT_HISTORY] Error loading settlement history for transaction ${transactionId}:`, err);
      
      // Check if it's an authentication error
      if (err instanceof Error && err.message.includes('Network error: HTTP error! status: 401')) {
        console.warn('[SETTLEMENT_HISTORY] Authentication required - user may need to log in again');
        setError('Authentication required. Please refresh the page and log in again.');
      } else if (err instanceof Error && err.message.includes('Network error: HTTP error! status: 500')) {
        console.warn('[SETTLEMENT_HISTORY] Server error occurred');
        setError('Server error occurred while loading settlement history.');
      } else {
        console.warn('[SETTLEMENT_HISTORY] Unknown error occurred:', err);
      }
      
      setSettlementHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };
  
  // WebSocket listeners for real-time updates
  useEffect(() => {
    if (socket) {
      // TRACING: Generate UUID for this listener setup
      const listenerId = generateUUID();
      console.log(`[FRONTEND_TRACE] ${listenerId}: Setting up WebSocket listeners for transaction updates`);
      
      socket.on('transactionUpdated', (data) => {
        // TRACING: Log incoming transaction update
        const eventId = generateUUID();
        console.log(`[FRONTEND_TRACE] ${listenerId}|${eventId}: Received 'transactionUpdated' event:`, { transactionId: data.id, type: 'transactionUpdated', timestamp: new Date().toISOString() });
        
        setTransactions(prev => prev.map(t => 
          t.id === data.id ? { ...t, ...data } : t
        ));
        
        console.log(`[FRONTEND_TRACE] ${listenerId}|${eventId}: Transaction state updated in frontend for transaction ID: ${data.id}`);
      });
      
      socket.on('settlementCreated', (data) => {
        // TRACING: Log incoming settlement created event
        const eventId = generateUUID();
        console.log(`[FRONTEND_TRACE] ${listenerId}|${eventId}: Received 'settlementCreated' event:`, { transactionId: data.transaction_id, settlementId: data.settlement?.id, type: 'settlementCreated', timestamp: new Date().toISOString() });
        
        // Update settlement history if dialog is open for this transaction
        if (selectedTransaction && selectedTransaction.id === data.transaction_id) {
          console.log(`[FRONTEND_TRACE] ${listenerId}|${eventId}: Reloading settlement history for open dialog, transaction: ${data.transaction_id}`);
          loadSettlementHistory(data.transaction_id);
        }
        
        // Update transaction in list
        console.log(`[FRONTEND_TRACE] ${listenerId}|${eventId}: Updating transaction in frontend list for transaction: ${data.transaction_id}`);
        setTransactions(prev => prev.map(t => 
          t.id === data.transaction_id ? { ...t, ...data.transaction } : t
        ));
        
        console.log(`[FRONTEND_TRACE] ${listenerId}|${eventId}: Settlement event processing completed`);
      });
      
      socket.on('payment_status_updated', (data) => {
        // TRACING: Log incoming payment status update
        const eventId = generateUUID();
        console.log(`[FRONTEND_TRACE] ${listenerId}|${eventId}: Received 'payment_status_updated' event:`, { transactionId: data.transactionId, paymentStatus: data.payment_status, paidAmount: data.paid_amount, balanceAmount: data.balance_amount, timestamp: new Date().toISOString() });
        
        // Update transaction state based on payment status update
        setTransactions(prev => prev.map(t => 
          t.id === data.transactionId ? { 
            ...t, 
            payment_status: data.payment_status,
            paid_amount: data.paid_amount,
            balance_amount: data.balance_amount
          } : t
        ));
        
        console.log(`[FRONTEND_TRACE] ${listenerId}|${eventId}: Payment status update applied to frontend state for transaction: ${data.transactionId}`);
      });
      
      socket.on('transaction:update', (data) => {
        // TRACING: Log incoming generic transaction update
        const eventId = generateUUID();
        console.log(`[FRONTEND_TRACE] ${listenerId}|${eventId}: Received 'transaction:update' event:`, { type: data.type, transactionId: data.transaction?.id || data.transactionId, timestamp: new Date().toISOString() });
        
        if (data.transaction) {
          setTransactions(prev => prev.map(t => 
            t.id === data.transaction.id ? { ...t, ...data.transaction } : t
          ));
          console.log(`[FRONTEND_TRACE] ${listenerId}|${eventId}: Generic transaction update applied for transaction: ${data.transaction.id}`);
        }
      });
      
      console.log(`[FRONTEND_TRACE] ${listenerId}: WebSocket listeners setup complete`);
      
      return () => {
        console.log(`[FRONTEND_TRACE] ${listenerId}: Cleaning up WebSocket listeners`);
        socket.off('transactionUpdated');
        socket.off('settlementCreated');
        socket.off('payment_status_updated');
        socket.off('transaction:update');
      };
    }
  }, [socket, selectedTransaction]);

  const handleConfirmSettlement = async () => {
    if (!selectedTransaction || !selectedTransaction.id || isNaN(selectedTransaction.id)) {
      setError('Invalid transaction selected. Please try again.');
      return;
    }
    
    if (settlementAmount <= 0) {
      setError('Please enter a valid settlement amount.');
      return;
    }

    if (settlementAmount > selectedTransaction.balance_amount) {
      setError('Settlement amount cannot exceed the outstanding balance.');
      return;
    }

    setLoading(true);
    try {
      // Create settlement using real API
      await TransactionApi.createSettlement(selectedTransaction.id, {
        amount: settlementAmount,
        payment_mode: settlementPaymentMode,
        cashier_id: user?.id || 1,
        notes: settlementNotes
      });

      // Show success message
      setSuccessMessage(`Payment of ₱${settlementAmount.toLocaleString()} recorded successfully!`);
      
      // Close dialog
      setSettleDialog(false);
      setSelectedTransaction(null);
      
      // Reload transactions to get fresh data from API
      await loadTransactions();
      
    } catch (err) {
      console.error('Error settling payment:', err);
      setError('Failed to record payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTransaction = (transaction: Transaction) => {
    // Guard against undefined transaction or ID
    if (!transaction || !transaction.id || isNaN(transaction.id)) {
      setError('Invalid transaction selected for deletion.');
      return;
    }
    
    setTransactionToDelete(transaction);
    setDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!transactionToDelete || !transactionToDelete.id || isNaN(transactionToDelete.id)) {
      setError('Invalid transaction selected for deletion.');
      return;
    }

    setLoading(true);
    try {
      // Delete transaction using real API
      await TransactionApi.deleteTransaction(transactionToDelete.id);

      // Show success message
      setSuccessMessage(`Transaction ${transactionToDelete.or_number} deleted successfully!`);
      
      // Close dialog
      setDeleteDialog(false);
      setTransactionToDelete(null);
      
      // Reload transactions to get fresh data from API
      await loadTransactions();
      
    } catch (err) {
      console.error('Error deleting transaction:', err);
      setError('Failed to delete transaction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = () => {
    setExpenses([...expenses, { description: '', amount: 0 }]);
  };

  const handleRemoveExpense = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index));
  };

  const handleExpenseChange = (index: number, field: 'description' | 'amount', value: string | number) => {
    const newExpenses = [...expenses];
    newExpenses[index][field] = value as never;
    setExpenses(newExpenses);
  };

  const handleAddFund = () => {
    setFunds([...funds, { description: '', amount: 0 }]);
  };

  const handleRemoveFund = (index: number) => {
    setFunds(funds.filter((_, i) => i !== index));
  };

  const handleFundChange = (index: number, field: 'description' | 'amount', value: string | number) => {
    const newFunds = [...funds];
    newFunds[index][field] = value as never;
    setFunds(newFunds);
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      // Generate report using real API
      const report = await TransactionApi.generateDailyReport({
        date: reportDate,
        expenses,
        funds,
        pettyCashStart,
        pettyCashEnd
      });
      
      console.log('Generated report from API:', report);
      console.log('Available fields:', Object.keys(report));
      console.log('Transaction count field:', report.transaction_count);
      console.log('Transactions count field:', (report as any).transactions_count);
      console.log('Total cash:', report.total_cash);
      console.log('Total gcash:', report.total_gcash);
      console.log('Total credit card:', report.total_credit_card);
      console.log('Total maya:', report.total_maya);
      console.log('Total bank transfer:', report.total_bank_transfer);
      
      setGeneratedReport(report);
      
      // Add the new report to pastReports state immediately
      const revenue = Number(report.total_cash || 0) + Number(report.total_gcash || 0) + Number(report.total_credit_card || 0) + Number(report.total_maya || 0) + Number(report.total_bank_transfer || 0);
      const totalRevenue = Math.round(revenue * 100) / 100;
      const transactionCount = report.transaction_count || (report as any).transactions_count || 0;
      console.log('Calculated total revenue:', totalRevenue);
      console.log('Calculated transaction count:', transactionCount);
      
      const newReport = {
        date: reportDate,
        summary: `Revenue: ₱${totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        transactions: transactionCount,
        revenue: totalRevenue
      };
      
      console.log('New report object:', newReport);
      
      // Update pastReports state: remove any existing report for the same date and add the new one
      setPastReports(prevReports => {
        const filteredReports = prevReports.filter(r => r.date !== reportDate);
        return [newReport, ...filteredReports].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      });
      
      // Also reload daily reports to sync with API
      await loadDailyReports();
      
      // Show success message
      alert(`Daily report for ${new Date(reportDate).toLocaleDateString()} generated successfully!`);
    } catch (err) {
      console.error('Error generating report:', err);
      setError('Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      // Export transactions using real API
      const response = await TransactionApi.exportTransactions({
        format: exportFormat,
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        paymentMode: paymentModeFilter || undefined
      });
      
      // Handle the download based on the response
      if (response.downloadUrl) {
        // If the API returns a download URL, use it
        const link = document.createElement('a');
        link.href = response.downloadUrl;
        link.download = `transactions_${new Date().toISOString().split('T')[0]}.${exportFormat}`;
        link.click();
      } else if (response.data) {
        // If the API returns raw data, handle it directly
        const blob = new Blob([response.data], { 
          type: exportFormat === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `transactions_${new Date().toISOString().split('T')[0]}.${exportFormat}`;
        link.click();
        URL.revokeObjectURL(url);
      }
      
      setExportDialog(false);
      alert(`Transactions exported successfully as ${exportFormat.toUpperCase()}!`);
    } catch (err) {
      console.error('Error exporting transactions:', err);
      setError('Failed to export data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = async (format: 'excel' | 'pdf' | 'csv') => {
    if (!generatedReport) return;
    
    setLoading(true);
    try {
      const reportData = {
        date: generatedReport.date,
        totalCash: generatedReport.total_cash,
        totalGCash: generatedReport.total_gcash,
        totalMaya: generatedReport.total_maya || 0,
        totalCreditCard: generatedReport.total_credit_card,
        totalBankTransfer: generatedReport.total_bank_transfer || 0,
        totalPettyCash: generatedReport.funds.reduce((sum, f) => sum + f.amount, 0),
        pettyCashStart: generatedReport.petty_cash_start,
        pettyCashEnd: generatedReport.petty_cash_end,
        totalRevenue: Number(generatedReport.total_cash || 0) + Number(generatedReport.total_gcash || 0) + Number(generatedReport.total_maya || 0) + Number(generatedReport.total_credit_card || 0) + Number(generatedReport.total_bank_transfer || 0),
        cashTurnover: generatedReport.cash_turnover,
        expenses: generatedReport.expenses,
        funds: generatedReport.funds,
        totalExpenses: generatedReport.expenses.reduce((sum, e) => sum + e.amount, 0),
        totalFunds: generatedReport.funds.reduce((sum, f) => sum + f.amount, 0)
      };
      
      const filename = `Daily_Report_${generatedReport.date}`;
      
      switch (format) {
        case 'excel':
          exportToExcel(reportData, filename);
          break;
        case 'pdf':
          exportToPDF(reportData, filename);
          break;
        case 'csv':
          exportToCSV(reportData, filename);
          break;
      }
      
      // Show success message
      alert(`Report exported successfully as ${format.toUpperCase()}!`);
    } catch (err) {
      setError('Failed to export report');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = (data: any, filename: string) => {
    // Create summary sheet
    const summaryData = [
      ['Daily Report Summary'],
      ['Date', new Date(data.date).toLocaleDateString()],
      [''],
      ['Financial Overview'],
      ['Total Cash', `₱${data.totalCash.toLocaleString()}`],
      ['Total GCash', `₱${data.totalGCash.toLocaleString()}`],
      ['Total Maya', `₱${data.totalMaya.toLocaleString()}`],
      ['Total Credit Card', `₱${data.totalCreditCard.toLocaleString()}`],
      ['Total Bank Transfer', `₱${data.totalBankTransfer.toLocaleString()}`],
      ['Total Petty Cash', `₱${data.totalPettyCash.toLocaleString()}`],
      ['Total Revenue', `₱${data.totalRevenue.toLocaleString()}`],
      ['Cash Turnover', `₱${data.cashTurnover.toLocaleString()}`],
      [''],
      ['Expenses'],
      ['Description', 'Amount'],
      ...data.expenses.map((expense: any) => [expense.description, `₱${expense.amount.toLocaleString()}`]),
      ['Total Expenses', `₱${data.totalExpenses.toLocaleString()}`],
      [''],
      ['Funds'],
      ['Description', 'Amount'],
      ...data.funds.map((fund: any) => [fund.description, `₱${fund.amount.toLocaleString()}`]),
      ['Total Funds', `₱${data.totalFunds.toLocaleString()}`]
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Report');
    
    // Style the header
    if (ws['A1']) {
      ws['A1'].s = {
        font: { bold: true, sz: 16 },
        alignment: { horizontal: 'center' }
      };
    }
    
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const exportToPDF = (data: any, filename: string) => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text('Daily Report', 20, 20);
    
    // Date
    doc.setFontSize(12);
    doc.text(`Date: ${new Date(data.date).toLocaleDateString()}`, 20, 35);
    
    // Financial Overview
    doc.setFontSize(14);
    doc.text('Financial Overview', 20, 50);
    
    const financialData = [
      ['Category', 'Amount'],
      ['Total Cash', `₱${data.totalCash.toLocaleString()}`],
      ['Total GCash', `₱${data.totalGCash.toLocaleString()}`],
      ['Total Maya', `₱${data.totalMaya.toLocaleString()}`],
      ['Total Credit Card', `₱${data.totalCreditCard.toLocaleString()}`],
      ['Total Bank Transfer', `₱${data.totalBankTransfer.toLocaleString()}`],
      ['Total Petty Cash', `₱${data.totalPettyCash.toLocaleString()}`],
      ['Total Revenue', `₱${data.totalRevenue.toLocaleString()}`],
      ['Cash Turnover', `₱${data.cashTurnover.toLocaleString()}`]
    ];
    
    autoTable(doc, {
      head: [financialData[0]],
      body: financialData.slice(1),
      startY: 60,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [41, 128, 185] }
    });
    
    // Expenses
    let currentY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(14);
    doc.text('Expenses', 20, currentY);
    
    if (data.expenses.length > 0) {
      const expenseData = [
        ['Description', 'Amount'],
        ...data.expenses.map((expense: any) => [expense.description, `₱${expense.amount.toLocaleString()}`]),
        ['Total', `₱${data.totalExpenses.toLocaleString()}`]
      ];
      
      autoTable(doc, {
        head: [expenseData[0]],
        body: expenseData.slice(1),
        startY: currentY + 10,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [231, 76, 60] }
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 20;
    } else {
      currentY += 20;
    }
    
    // Funds
    doc.setFontSize(14);
    doc.text('Funds', 20, currentY);
    
    if (data.funds.length > 0) {
      const fundData = [
        ['Description', 'Amount'],
        ...data.funds.map((fund: any) => [fund.description, `₱${fund.amount.toLocaleString()}`]),
        ['Total', `₱${data.totalFunds.toLocaleString()}`]
      ];
      
      autoTable(doc, {
        head: [fundData[0]],
        body: fundData.slice(1),
        startY: currentY + 10,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [46, 204, 113] }
      });
    }
    
    doc.save(`${filename}.pdf`);
  };

  const exportToCSV = (data: any, filename: string) => {
    const csvContent = [
      ['Daily Report Summary'],
      ['Date', new Date(data.date).toLocaleDateString()],
      [''],
      ['Financial Overview'],
      ['Total Cash', data.totalCash],
      ['Total GCash', data.totalGCash],
      ['Total Maya', data.totalMaya],
      ['Total Credit Card', data.totalCreditCard],
      ['Total Bank Transfer', data.totalBankTransfer],
      ['Total Petty Cash', data.totalPettyCash],
      ['Total Revenue', data.totalRevenue],
      ['Cash Turnover', data.cashTurnover],
      [''],
      ['Expenses'],
      ['Description', 'Amount'],
      ...data.expenses.map((expense: any) => [expense.description, expense.amount]),
      ['Total Expenses', data.totalExpenses],
      [''],
      ['Funds'],
      ['Description', 'Amount'],
      ...data.funds.map((fund: any) => [fund.description, fund.amount]),
      ['Total Funds', data.totalFunds]
    ];
    
    const csvString = csvContent.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Delete and Reset Functions (Admin Only)
  const handleDeleteDailyReport = async () => {
    if (!isAdmin) {
      setError('Access denied. Only System Administrators can delete reports.');
      return;
    }
    
    if (!deleteDate) {
      setError('Please select a date to delete.');
      return;
    }
    
    setLoading(true);
    try {
      // Make the actual API call to delete the report from the database
      const result = await TransactionApi.deleteDailyReport(deleteDate);
      
      if (result.success) {
        // Remove the report from the local state
        setPastReports(prevReports => prevReports.filter(report => report.date !== deleteDate));
        
        // Refresh the daily reports list to ensure consistency
        await loadDailyReports();
        
        // Log the activity (in a real app, this would be sent to the server)
        console.log(`ADMIN ACTION: ${user?.full_name} deleted daily report for ${deleteDate} at ${new Date().toISOString()}`);
        
        setDeleteReportDialog(false);
        setDeleteDate('');
        
        // Show success message
        alert(`Daily report for ${new Date(deleteDate).toLocaleDateString()} has been deleted successfully.`);
      } else {
        throw new Error(result.message || 'Failed to delete daily report');
      }
      
    } catch (err: any) {
      console.error('Error deleting daily report:', err);
      setError(`Failed to delete daily report: ${err.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleResetSystem = async () => {
    if (!isAdmin) {
      setError('Access denied. Only System Administrators can reset the system.');
      return;
    }
    
    if (resetConfirmText !== 'DELETE ALL DATA') {
      setError('Please type "DELETE ALL DATA" to confirm system reset.');
      return;
    }
    
    setLoading(true);
    try {
      // In a real application, this would be an API call
      // await api.post('/api/system/reset');
      
      // Reset all data (except activity logs)
      setTransactions([]);
      setPastReports([]);
      setGeneratedReport(null);
      setExpenses([]);
      setFunds([]);
      setPettyCashStart(0);
      setPettyCashEnd(0);
      setTotalCount(0);
      
      // Log the activity (in a real app, this would be sent to the server and preserved)
      console.log(`CRITICAL ADMIN ACTION: ${user?.full_name} performed system reset at ${new Date().toISOString()}`);
      
      setResetSystemDialog(false);
      setResetConfirmText('');
      
      // Show success message
      alert('System has been reset successfully. All transaction data and reports have been cleared except activity logs.');
      
    } catch (err) {
      setError('Failed to reset system. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const logActivity = (action: string, details?: string) => {
    // In a real application, this would send the log to the server
    const logEntry = {
      timestamp: new Date().toISOString(),
      user: user?.full_name || 'Unknown',
      userId: user?.id || 0,
      action,
      details,
      ipAddress: '127.0.0.1', // In a real app, this would be the actual IP
      userAgent: navigator.userAgent
    };
    
    console.log('ACTIVITY LOG:', logEntry);
    
    // In a real application, you would store this in a persistent activity log
    // that survives system resets
  };

  const renderMobileTransactionCard = (transaction: Transaction) => (
    <Card key={transaction.id} sx={{ mb: 2 }}>
      <CardContent>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Typography variant="h6" component="div">
              {transaction.or_number}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Chip 
                label={getPaymentModeLabel(transaction.payment_mode)}
                color={getPaymentModeColor(transaction.payment_mode) as any}
                size="small"
              />
              <Chip 
                label={getPaymentStatusLabel(transaction.payment_status)}
                color={getPaymentStatusColor(transaction.payment_status) as any}
                size="small"
              />
            </Stack>
          </Box>
          
          <Box>
            <Typography variant="body2" color="text.secondary">
              Customer
            </Typography>
            <Typography variant="body1">
              {transaction.customer_name}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Amount
              </Typography>
              <Typography variant="h6" color="primary">
                {formatCurrency(transaction.amount)}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" color="text.secondary">
                Sales Agent
              </Typography>
              <Typography variant="body1">
                {transaction.sales_agent_name}
              </Typography>
            </Box>
          </Box>
          
          {/* Payment Status Details */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Paid Amount
              </Typography>
              <Typography variant="body1" color="success.main">
                {formatCurrency(transaction.paid_amount)}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" color="text.secondary">
                Balance
              </Typography>
              <Typography variant="body1" color={transaction.balance_amount > 0 ? 'error.main' : 'success.main'}>
                {formatCurrency(transaction.balance_amount)}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Date
            </Typography>
            <Typography variant="body1">
              {new Date(transaction.transaction_date).toLocaleDateString()}
            </Typography>
          </Box>
          
          {/* Settle Button */}
          {transaction.payment_status !== PaymentStatus.PAID && (
            <Box sx={{ textAlign: 'center' }}>
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={() => handleSettleTransaction(transaction)}
                sx={{ mt: 1 }}
              >
                Settle Payment
              </Button>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );

  const renderTransactionTable = () => {
    if (isMobile) {
      return (
        <Box>
          {transactions.map(renderMobileTransactionCard)}
        </Box>
      );
    }
    
    return (
      <TableContainer component={Paper} elevation={0}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>OR Number</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Payment Mode</TableCell>
              <TableCell>Payment Status</TableCell>
              <TableCell>Balance</TableCell>
              <TableCell>Sales Agent</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>{transaction.or_number}</TableCell>
                <TableCell>{transaction.customer_name}</TableCell>
                <TableCell>{formatCurrency(transaction.amount)}</TableCell>
                <TableCell>
                  <Chip 
                    label={getPaymentModeLabel(transaction.payment_mode)}
                    color={getPaymentModeColor(transaction.payment_mode) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={getPaymentStatusLabel(transaction.payment_status)}
                    color={getPaymentStatusColor(transaction.payment_status) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography variant="body2" color="success.main">
                      Paid: {formatCurrency(transaction.paid_amount)}
                    </Typography>
                    <Typography variant="body2" color={transaction.balance_amount > 0 ? 'error.main' : 'success.main'}>
                      Balance: {formatCurrency(transaction.balance_amount)}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>{transaction.sales_agent_name}</TableCell>
                <TableCell>{new Date(transaction.transaction_date).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {transaction.payment_status !== PaymentStatus.PAID && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleSettleTransaction(transaction)}
                        color="primary"
                      >
                        Settle
                      </Button>
                    )}
                    {isAdmin && (
                      <Tooltip title="Delete Transaction">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteTransaction(transaction)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderDailyReportDialog = () => (
    <Dialog open={dailyReportDialog} onClose={() => setDailyReportDialog(false)} maxWidth="md" fullWidth>
      <DialogTitle>Generate Daily Report</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          <TextField
            label="Report Date"
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Petty Cash Start"
              type="number"
              value={pettyCashStart}
              onChange={(e) => setPettyCashStart(parseFloat(e.target.value) || 0)}
              fullWidth
              InputProps={{ startAdornment: '₱' }}
            />
            <TextField
              label="Petty Cash End"
              type="number"
              value={pettyCashEnd}
              onChange={(e) => setPettyCashEnd(parseFloat(e.target.value) || 0)}
              fullWidth
              InputProps={{ startAdornment: '₱' }}
            />
          </Box>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Expenses ({expenses.length})</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                {expenses.map((expense, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TextField
                      label="Description"
                      value={expense.description}
                      onChange={(e) => handleExpenseChange(index, 'description', e.target.value)}
                      fullWidth
                      size="small"
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Amount"
                      type="number"
                      value={expense.amount}
                      onChange={(e) => handleExpenseChange(index, 'amount', parseFloat(e.target.value) || 0)}
                      size="small"
                      InputProps={{ startAdornment: '₱' }}
                      sx={{ width: 120 }}
                    />
                    <IconButton onClick={() => handleRemoveExpense(index)} size="small">
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))}
                <Button onClick={handleAddExpense} startIcon={<AddIcon />} variant="outlined">
                  Add Expense
                </Button>
              </Stack>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Funds ({funds.length})</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                {funds.map((fund, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TextField
                      label="Description"
                      value={fund.description}
                      onChange={(e) => handleFundChange(index, 'description', e.target.value)}
                      fullWidth
                      size="small"
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Amount"
                      type="number"
                      value={fund.amount}
                      onChange={(e) => handleFundChange(index, 'amount', parseFloat(e.target.value) || 0)}
                      size="small"
                      InputProps={{ startAdornment: '₱' }}
                      sx={{ width: 120 }}
                    />
                    <IconButton onClick={() => handleRemoveFund(index)} size="small">
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))}
                <Button onClick={handleAddFund} startIcon={<AddIcon />} variant="outlined">
                  Add Fund
                </Button>
              </Stack>
            </AccordionDetails>
          </Accordion>

          {generatedReport && (
            <Grow in={true} timeout={500}>
              <Card 
                elevation={3}
                sx={{ 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: '1px solid',
                  borderColor: 'primary.main',
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.shadows[8]
                  }
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'white' }}>
                      📊 Generated Report
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Tooltip title="Export as Excel">
                        <IconButton 
                          onClick={() => handleExportReport('excel')}
                          disabled={loading}
                          sx={{ 
                            color: 'white',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' }
                          }}
                        >
                          <FileDownloadIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Export as PDF">
                        <IconButton 
                          onClick={() => handleExportReport('pdf')}
                          disabled={loading}
                          sx={{ 
                            color: 'white',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' }
                          }}
                        >
                          <PrintIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Export as CSV">
                        <IconButton 
                          onClick={() => handleExportReport('csv')}
                          disabled={loading}
                          sx={{ 
                            color: 'white',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' }
                          }}
                        >
                          <ExportIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Box>
                  
                  <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, 
                    gap: 3 
                  }}>
                    {[
                      { label: 'Total Cash', value: generatedReport.total_cash, icon: '💵', color: '#4CAF50' },
                      { label: 'Total GCash', value: generatedReport.total_gcash, icon: '📱', color: '#2196F3' },
                      { label: 'Total Credit Card', value: generatedReport.total_credit_card, icon: '💳', color: '#FF9800' },
                      { label: 'Total Maya', value: generatedReport.total_maya || 0, icon: '🏦', color: '#9C27B0' },
                      { label: 'Total Bank Transfer', value: generatedReport.total_bank_transfer || 0, icon: '🏛️', color: '#00BCD4' },
                      { 
                        label: 'Total Petty Cash', 
                        value: generatedReport.funds.reduce((sum, f) => sum + f.amount, 0), 
                        icon: '💼', 
                        color: '#8E24AA' 
                      },
                      { 
                        label: 'Total Revenue', 
                        value: Number(generatedReport.total_cash || 0) + Number(generatedReport.total_gcash || 0) + Number(generatedReport.total_maya || 0) + Number(generatedReport.total_credit_card || 0) + Number(generatedReport.total_bank_transfer || 0), 
                        icon: '💰', 
                        color: '#FFD700',
                        highlight: true
                      },
                      { label: 'Cash Turnover', value: generatedReport.cash_turnover, icon: '🔄', color: '#E91E63', highlight: true }
                    ].map((item, index) => (
                      <Fade in={true} timeout={800 + (index * 100)} key={item.label}>
                        <Box 
                          sx={{ 
                            textAlign: 'center',
                            p: 2,
                            borderRadius: 2,
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            backdropFilter: 'blur(10px)',
                            border: item.highlight ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.2)',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              transform: 'scale(1.05)',
                              backgroundColor: 'rgba(255,255,255,0.15)'
                            }
                          }}
                        >
                          <Typography variant="h4" sx={{ mb: 1 }}>{item.icon}</Typography>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: 'rgba(255,255,255,0.8)', 
                              mb: 1,
                              fontWeight: 500
                            }}
                          >
                            {item.label}
                          </Typography>
                          <Typography 
                            variant={item.highlight ? "h5" : "h6"} 
                            sx={{ 
                              fontWeight: 'bold',
                              color: item.highlight ? '#FFD700' : 'white',
                              textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                            }}
                          >
                            ₱{item.value.toLocaleString()}
                          </Typography>
                        </Box>
                      </Fade>
                    ))}
                  </Box>
                  
                  {/* Detailed Calculations Section */}
                  <Box sx={{ mt: 4, p: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                    <Typography variant="h6" sx={{ color: 'white', mb: 2, fontWeight: 'bold' }}>
                      📊 Detailed Calculations
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: '#FFD700', fontWeight: 'bold', mb: 1 }}>
                          Revenue Breakdown:
                        </Typography>
                        <Box sx={{ pl: 2 }}>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                            • Total Cash: ₱{generatedReport.total_cash.toLocaleString()}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                            • Total GCash: ₱{generatedReport.total_gcash.toLocaleString()}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                            • Total Maya: ₱{(generatedReport.total_maya || 0).toLocaleString()}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                            • Total Credit Card: ₱{generatedReport.total_credit_card.toLocaleString()}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                            • Total Bank Transfer: ₱{(generatedReport.total_bank_transfer || 0).toLocaleString()}
                          </Typography>
                          <Divider sx={{ my: 1, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                          <Typography variant="body2" sx={{ color: '#FFD700', fontWeight: 'bold' }}>
                            Total Revenue: ₱{(generatedReport.total_cash + generatedReport.total_gcash + (generatedReport.total_maya || 0) + generatedReport.total_credit_card + (generatedReport.total_bank_transfer || 0)).toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: '#FFD700', fontWeight: 'bold', mb: 1 }}>
                          Cash Turnover Formula:
                        </Typography>
                        <Box sx={{ pl: 2 }}>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                            (Petty Cash Start + Total Revenue + Total Funds) - Total Expenses - Petty Cash End
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', mt: 1 }}>
                            = (₱{generatedReport.petty_cash_start.toLocaleString()} + ₱{(generatedReport.total_cash + generatedReport.total_gcash + (generatedReport.total_maya || 0) + generatedReport.total_credit_card + (generatedReport.total_bank_transfer || 0)).toLocaleString()} + ₱{generatedReport.funds.reduce((sum, f) => sum + f.amount, 0).toLocaleString()})
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                            - ₱{generatedReport.expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()} - ₱{generatedReport.petty_cash_end.toLocaleString()}
                          </Typography>
                          <Divider sx={{ my: 1, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                          <Typography variant="body2" sx={{ color: '#E91E63', fontWeight: 'bold' }}>
                            = ₱{generatedReport.cash_turnover.toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                  
                  <Box sx={{ mt: 3, textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      Report generated for {new Date(generatedReport.date).toLocaleDateString()}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grow>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDailyReportDialog(false)}>Cancel</Button>
        <Button onClick={handleGenerateReport} variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={20} /> : 'Generate Report'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  const renderExportDialog = () => (
    <Dialog open={exportDialog} onClose={() => setExportDialog(false)}>
      <DialogTitle>Export Transactions</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Export Format</InputLabel>
            <Select
              value={exportFormat}
              label="Export Format"
              onChange={(e) => setExportFormat(e.target.value as 'excel' | 'pdf' | 'csv')}
            >
              <MenuItem value="excel">Excel (.xlsx)</MenuItem>
              <MenuItem value="pdf">PDF (.pdf)</MenuItem>
              <MenuItem value="csv">CSV (.csv)</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Start Date"
              type="date"
              value={dateFilter.startDate}
              onChange={(e) => setDateFilter({...dateFilter, startDate: e.target.value})}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End Date"
              type="date"
              value={dateFilter.endDate}
              onChange={(e) => setDateFilter({...dateFilter, endDate: e.target.value})}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setExportDialog(false)}>Cancel</Button>
        <Button onClick={handleExport} variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={20} /> : 'Export'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  const renderPastReportsDialog = () => (
    <Dialog open={pastReportsDialog} onClose={() => setPastReportsDialog(false)} maxWidth="md" fullWidth>
      <DialogTitle>View Past Reports</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select a past report date to view the report details.
        </Typography>
        <Box sx={{ mt: 2 }}>
          {pastReports.length > 0 ? (
            <Stack spacing={2}>
              {pastReports.map((report) => (
                <Card key={report.date} sx={{ border: '1px solid #e0e0e0' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6" color="primary">
                        📊 {new Date(report.date).toLocaleDateString()}
                      </Typography>
                      <Chip 
                        label={`${report.transactions} transactions`}
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Total Revenue</Typography>
                        <Typography variant="h6" color="success.main" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(report.revenue)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Report Summary</Typography>
                        <Typography variant="body2">{report.summary}</Typography>
                      </Box>
                    </Box>
                    
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #f0f0f0' }}>
                      <Typography variant="caption" color="text.secondary">
                        Generated on {new Date(report.date).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>📋</Typography>
              <Typography variant="body2" color="text.secondary">
                No past reports available. Generate your first daily report to see them here.
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setPastReportsDialog(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Transaction Management
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
              <Tab label="Transactions" />
              <Tab label="Daily Reports" />
              <Tab label="Monthly Reports" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <Stack spacing={3}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Transaction List</Typography>
                <Button
                  variant="outlined"
                  startIcon={<ExportIcon />}
                  onClick={() => setExportDialog(true)}
                >
                  Export
                </Button>
              </Box>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ flex: '1 1 300px', minWidth: '200px' }}>
                  <TextField
                    label="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    fullWidth
                    size="small"
                    InputProps={{
                      startAdornment: <SearchIcon />
                    }}
                  />
                </Box>
                <Box sx={{ flex: '1 1 200px', minWidth: '150px' }}>
                  <TextField
                    label="Start Date"
                    type="date"
                    value={dateFilter.startDate}
                    onChange={(e) => setDateFilter({...dateFilter, startDate: e.target.value})}
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>
                <Box sx={{ flex: '1 1 200px', minWidth: '150px' }}>
                  <TextField
                    label="End Date"
                    type="date"
                    value={dateFilter.endDate}
                    onChange={(e) => setDateFilter({...dateFilter, endDate: e.target.value})}
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>
                <Box sx={{ flex: '1 1 150px', minWidth: '120px' }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Payment Mode</InputLabel>
                    <Select
                      value={paymentModeFilter}
                      label="Payment Mode"
                      onChange={(e) => setPaymentModeFilter(e.target.value as PaymentMode)}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value={PaymentMode.CASH}>Cash</MenuItem>
                      <MenuItem value={PaymentMode.GCASH}>GCash</MenuItem>
                      <MenuItem value={PaymentMode.MAYA}>Maya</MenuItem>
                      <MenuItem value={PaymentMode.CREDIT_CARD}>Credit Card</MenuItem>
                      <MenuItem value={PaymentMode.BANK_TRANSFER}>Bank Transfer</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Box>

              {renderTransactionTable()}

              <TablePagination
                rowsPerPageOptions={[10, 25, 50]}
                component="div"
                count={totalCount}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
              />
            </Stack>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Stack spacing={3}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Daily Reports</Typography>
                <Button
                  variant="contained"
                  startIcon={<ReportIcon />}
                  onClick={() => setDailyReportDialog(true)}
                >
                  Generate Report
                </Button>
              </Box>
              
              <Typography variant="body2" color="text.secondary">
                Generate and manage daily financial reports with expense tracking and cash turnover calculations.
              </Typography>
              
              {/* Daily Transaction Summaries */}
              <Card sx={{ mt: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    📊 Daily Transaction Summaries
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
                    <Box sx={{ textAlign: 'center', p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                      <Typography variant="h4" color="primary">💵</Typography>
                      <Typography variant="body2" color="text.secondary">Total Transactions</Typography>
                      <Typography variant="h6" color="primary">{transactions.length}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center', p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                      <Typography variant="h4" color="success.main">💰</Typography>
                      <Typography variant="body2" color="text.secondary">Total Revenue</Typography>
                      <Typography variant="h6" color="success.main">
                        {formatCurrency(transactions.reduce((sum, t) => sum + t.amount, 0))}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center', p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                      <Typography variant="h4" color="info.main">📱</Typography>
                      <Typography variant="body2" color="text.secondary">Digital Payments</Typography>
                      <Typography variant="h6" color="info.main">
                        {transactions.filter(t => t.payment_mode !== PaymentMode.CASH).length}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center', p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                      <Typography variant="h4" color="warning.main">💸</Typography>
                      <Typography variant="body2" color="text.secondary">Cash Payments</Typography>
                      <Typography variant="h6" color="warning.main">
                        {transactions.filter(t => t.payment_mode === PaymentMode.CASH).length}
                      </Typography>
                    </Box>
                  </Box>
                  
                  {/* Payment Mode Breakdown */}
                  <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>Payment Mode Breakdown</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
                    {Object.values(PaymentMode).map(mode => {
                      const modeTransactions = transactions.filter(t => t.payment_mode === mode);
                      const modeTotal = modeTransactions.reduce((sum, t) => sum + t.amount, 0);
                      return (
                        <Box key={mode} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip 
                              label={getPaymentModeLabel(mode)}
                              color={getPaymentModeColor(mode) as any}
                              size="small"
                            />
                            <Typography variant="body2">{modeTransactions.length} transactions</Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{formatCurrency(modeTotal)}</Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </CardContent>
              </Card>
              
              {/* Calendar for Daily Reports */}
              <Card sx={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                mb: 3
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <CalendarTodayIcon sx={{ fontSize: 32 }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      📅 Daily Reports Calendar
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ mb: 3, opacity: 0.9 }}>
                    Select a date to view or generate daily reports. Click on any date to see transaction summaries.
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>Quick Actions</Typography>
                      <Stack spacing={1}>
                        <Button 
                          variant="contained" 
                          size="small" 
                          startIcon={<EventIcon />}
                          onClick={() => setDailyReportDialog(true)}
                          sx={{ 
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)' }
                          }}
                        >
                          Generate Today's Report
                        </Button>
                        <Button 
                          variant="outlined" 
                          size="small" 
                          startIcon={<ScheduleIcon />}
                          onClick={() => setPastReportsDialog(true)}
                          sx={{ 
                            color: 'white',
                            borderColor: 'rgba(255,255,255,0.5)',
                            '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255,255,255,0.1)' }
                          }}
                        >
                          View Past Reports
                        </Button>
                        
                        {/* Admin-only buttons */}
                        {isAdmin && (
                          <>
                            <Button 
                              variant="outlined" 
                              size="small" 
                              color="warning"
                              startIcon={<DeleteIcon />}
                              onClick={() => setDeleteReportDialog(true)}
                              sx={{ 
                                color: '#FF9800',
                                borderColor: 'rgba(255, 152, 0, 0.5)',
                                '&:hover': { borderColor: '#FF9800', backgroundColor: 'rgba(255, 152, 0, 0.1)' }
                              }}
                            >
                              Delete Report
                            </Button>
                            <Button 
                              variant="outlined" 
                              size="small" 
                              color="error"
                              startIcon={<RestoreFromTrashIcon />}
                              onClick={() => setResetSystemDialog(true)}
                              sx={{ 
                                color: '#F44336',
                                borderColor: 'rgba(244, 67, 54, 0.5)',
                                '&:hover': { borderColor: '#F44336', backgroundColor: 'rgba(244, 67, 54, 0.1)' }
                              }}
                            >
                              Reset System
                            </Button>
                          </>
                        )}
                      </Stack>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>Recent Activity</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <CheckCircleIcon sx={{ fontSize: 16, color: '#4CAF50' }} />
                        <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>Last report: Today</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <TimelineIcon sx={{ fontSize: 16, color: '#FF9800' }} />
                        <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>Reports this month: 15</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TrendingUpIcon sx={{ fontSize: 16, color: '#2196F3' }} />
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>Avg. daily revenue: {formatCurrency(transactions.reduce((sum, t) => sum + t.amount, 0))}</Typography>
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              {/* Enhanced Analytics */}
              <Card sx={{ 
                background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
                color: 'white'
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <BarChartIcon sx={{ fontSize: 32 }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      📊 Advanced Analytics Dashboard
                    </Typography>
                  </Box>
                  
                  {/* Performance Metrics */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 4 }}>
                    <Box sx={{ 
                      textAlign: 'center', 
                      p: 2, 
                      backgroundColor: 'rgba(255,255,255,0.15)', 
                      borderRadius: 2,
                      border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                      <SpeedIcon sx={{ fontSize: 32, mb: 1, color: '#FFD700' }} />
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>Performance Score</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#FFD700' }}>94%</Typography>
                    </Box>
                    <Box sx={{ 
                      textAlign: 'center', 
                      p: 2, 
                      backgroundColor: 'rgba(255,255,255,0.15)', 
                      borderRadius: 2,
                      border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                      <TrendingUpIcon sx={{ fontSize: 32, mb: 1, color: '#4CAF50' }} />
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>Growth Rate</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#4CAF50' }}>+12.5%</Typography>
                    </Box>
                    <Box sx={{ 
                      textAlign: 'center', 
                      p: 2, 
                      backgroundColor: 'rgba(255,255,255,0.15)', 
                      borderRadius: 2,
                      border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                      <PieChartIcon sx={{ fontSize: 32, mb: 1, color: '#2196F3' }} />
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>Success Rate</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#2196F3' }}>98.2%</Typography>
                    </Box>
                    <Box sx={{ 
                      textAlign: 'center', 
                      p: 2, 
                      backgroundColor: 'rgba(255,255,255,0.15)', 
                      borderRadius: 2,
                      border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                      <TimelineIcon sx={{ fontSize: 32, mb: 1, color: '#FF9800' }} />
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>Processing Time</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#FF9800' }}>1.2s</Typography>
                    </Box>
                  </Box>

                  {/* Transaction Analytics */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 4 }}>
                    <Box sx={{ 
                      p: 3, 
                      backgroundColor: 'rgba(255,255,255,0.1)', 
                      borderRadius: 2,
                      border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <BarChartIcon sx={{ fontSize: 24, color: '#FFD700' }} />
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Transaction Insights</Typography>
                      </Box>
                      <Stack spacing={2}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TrendingUpIcon sx={{ fontSize: 16, color: '#4CAF50' }} />
                            <Typography variant="body2">Average Transaction</Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {formatCurrency(mockTransactions.reduce((sum, t) => sum + t.amount, 0) / mockTransactions.length)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TrendingUpIcon sx={{ fontSize: 16, color: '#FF9800' }} />
                            <Typography variant="body2">Peak Transaction</Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {formatCurrency(Math.max(...mockTransactions.map(t => t.amount)))}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TrendingDownIcon sx={{ fontSize: 16, color: '#F44336' }} />
                            <Typography variant="body2">Minimum Transaction</Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {formatCurrency(Math.min(...mockTransactions.map(t => t.amount)))}
                          </Typography>
                        </Box>
                        <Divider sx={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SpeedIcon sx={{ fontSize: 16, color: '#2196F3' }} />
                            <Typography variant="body2">Transaction Velocity</Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>High</Typography>
                        </Box>
                      </Stack>
                    </Box>

                    <Box sx={{ 
                      p: 3, 
                      backgroundColor: 'rgba(255,255,255,0.1)', 
                      borderRadius: 2,
                      border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <PieChartIcon sx={{ fontSize: 24, color: '#FFD700' }} />
                        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Payment Analytics</Typography>
                      </Box>
                      <Stack spacing={2}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip 
                              label="Most Popular" 
                              size="small" 
                              sx={{ backgroundColor: '#4CAF50', color: 'white' }}
                            />
                            <Typography variant="body2">
                              {getPaymentModeLabel(Object.values(PaymentMode).reduce((a, b) => 
                                mockTransactions.filter(t => t.payment_mode === a).length > mockTransactions.filter(t => t.payment_mode === b).length ? a : b
                              ))}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#2196F3' }} />
                            <Typography variant="body2">Digital Payments</Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {((mockTransactions.filter(t => t.payment_mode !== PaymentMode.CASH).length / mockTransactions.length) * 100).toFixed(1)}%
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#FF9800' }} />
                            <Typography variant="body2">Cash Payments</Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {((mockTransactions.filter(t => t.payment_mode === PaymentMode.CASH).length / mockTransactions.length) * 100).toFixed(1)}%
                          </Typography>
                        </Box>
                        <Divider sx={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TrendingUpIcon sx={{ fontSize: 16, color: '#4CAF50' }} />
                            <Typography variant="body2">Digital Trend</Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#4CAF50' }}>↗ Growing</Typography>
                        </Box>
                      </Stack>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Stack>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Stack spacing={3}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Monthly Reports</Typography>
                <Button
                  variant="contained"
                  startIcon={<ReportIcon />}
                  onClick={() => alert('Monthly report generation feature coming soon!')}
                  sx={{ 
                    background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                    '&:hover': { 
                      background: 'linear-gradient(45deg, #1976D2 30%, #0288D1 90%)' 
                    }
                  }}
                >
                  Generate Monthly Report
                </Button>
              </Box>
              
              <Typography variant="body2" color="text.secondary">
                Comprehensive monthly transaction analysis with advanced performance metrics and trends.
              </Typography>

              {/* Monthly Overview Cards */}
              <Card sx={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                mb: 3
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <CalendarTodayIcon sx={{ fontSize: 32 }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      📅 Monthly Overview - {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
                    <Box sx={{ 
                      textAlign: 'center', 
                      p: 2, 
                      backgroundColor: 'rgba(255,255,255,0.1)', 
                      borderRadius: 2,
                      border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                      <Typography variant="h4" sx={{ mb: 1 }}>💰</Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Revenue</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#FFD700' }}>
                        {formatCurrency(mockTransactions.reduce((sum, t) => sum + t.amount, 0) * 30)}
                      </Typography>
                    </Box>
                    <Box sx={{ 
                      textAlign: 'center', 
                      p: 2, 
                      backgroundColor: 'rgba(255,255,255,0.1)', 
                      borderRadius: 2,
                      border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                      <Typography variant="h4" sx={{ mb: 1 }}>📊</Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Transactions</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#4CAF50' }}>
                        {mockTransactions.length * 30}
                      </Typography>
                    </Box>
                    <Box sx={{ 
                      textAlign: 'center', 
                      p: 2, 
                      backgroundColor: 'rgba(255,255,255,0.1)', 
                      borderRadius: 2,
                      border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                      <Typography variant="h4" sx={{ mb: 1 }}>📈</Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>Growth Rate</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#2196F3' }}>+18.5%</Typography>
                    </Box>
                    <Box sx={{ 
                      textAlign: 'center', 
                      p: 2, 
                      backgroundColor: 'rgba(255,255,255,0.1)', 
                      borderRadius: 2,
                      border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                      <Typography variant="h4" sx={{ mb: 1 }}>⭐</Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>Avg Daily</Typography>
                      <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#FF9800' }}>
                        {formatCurrency(mockTransactions.reduce((sum, t) => sum + t.amount, 0))}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              {/* Monthly Transaction Trends */}
              <Card sx={{ mt: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    📊 Monthly Transaction Trends
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3, mb: 3 }}>
                    <Box sx={{ textAlign: 'center', p: 3, backgroundColor: '#f8f9fa', borderRadius: 2 }}>
                      <Typography variant="h3" color="primary">📈</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Best Performing Week</Typography>
                      <Typography variant="h6" color="primary">Week 3</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{formatCurrency(mockTransactions.reduce((sum, t) => sum + t.amount, 0) * 1.4)}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center', p: 3, backgroundColor: '#f8f9fa', borderRadius: 2 }}>
                      <Typography variant="h3" color="success.main">💳</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Most Popular Payment</Typography>
                      <Typography variant="h6" color="success.main">Credit Card</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>45% of transactions</Typography>
                    </Box>
                  </Box>
                  
                  {/* Weekly Breakdown */}
                  <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>Weekly Performance</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
                    {['Week 1', 'Week 2', 'Week 3', 'Week 4'].map((week, index) => {
                      const multiplier = [0.8, 1.1, 1.4, 1.2][index];
                      const weeklyRevenue = mockTransactions.reduce((sum, t) => sum + t.amount, 0) * multiplier;
                      return (
                        <Box key={week} sx={{ 
                          display: 'flex', 
                          flexDirection: 'column',
                          alignItems: 'center',
                          p: 2, 
                          border: '1px solid #e0e0e0', 
                          borderRadius: 2,
                          '&:hover': {
                            backgroundColor: '#f5f5f5',
                            transform: 'translateY(-2px)',
                            transition: 'all 0.3s ease'
                          }
                        }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>{week}</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Revenue</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{formatCurrency(weeklyRevenue)}</Typography>
                          <Typography variant="body2" color={multiplier > 1 ? 'success.main' : 'warning.main'} sx={{ mt: 1 }}>
                            {multiplier > 1 ? '↗' : '↘'} {((multiplier - 1) * 100).toFixed(1)}%
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </CardContent>
              </Card>

              {/* Monthly Payment Analysis */}
              <Card sx={{ 
                background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
                color: 'white'
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <PieChartIcon sx={{ fontSize: 32 }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      📊 Monthly Payment Analysis
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 4 }}>
                    <Box sx={{ 
                      p: 3, 
                      backgroundColor: 'rgba(255,255,255,0.1)', 
                      borderRadius: 2,
                      border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>Payment Methods Distribution</Typography>
                      <Stack spacing={2}>
                        {Object.values(PaymentMode).map((mode, index) => {
                          const percentage = [35, 25, 20, 15, 5][index] || 0;
                          return (
                            <Box key={mode} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ 
                                  width: 12, 
                                  height: 12, 
                                  borderRadius: '50%', 
                                  backgroundColor: ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#00BCD4'][index] 
                                }} />
                                <Typography variant="body2">{getPaymentModeLabel(mode)}</Typography>
                              </Box>
                              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{percentage}%</Typography>
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                    
                    <Box sx={{ 
                      p: 3, 
                      backgroundColor: 'rgba(255,255,255,0.1)', 
                      borderRadius: 2,
                      border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>Key Metrics</Typography>
                      <Stack spacing={2}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TrendingUpIcon sx={{ fontSize: 16, color: '#4CAF50' }} />
                            <Typography variant="body2">Average Transaction</Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {formatCurrency(mockTransactions.reduce((sum, t) => sum + t.amount, 0) / mockTransactions.length)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SpeedIcon sx={{ fontSize: 16, color: '#FF9800' }} />
                            <Typography variant="body2">Transactions/Day</Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{mockTransactions.length}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CheckCircleIcon sx={{ fontSize: 16, color: '#2196F3' }} />
                            <Typography variant="body2">Success Rate</Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>99.2%</Typography>
                        </Box>
                        <Divider sx={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TimelineIcon sx={{ fontSize: 16, color: '#E91E63' }} />
                            <Typography variant="body2">Monthly Growth</Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#4CAF50' }}>+18.5%</Typography>
                        </Box>
                      </Stack>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              {/* Performance Insights */}
              <Card sx={{ 
                background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                color: '#333'
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <BarChartIcon sx={{ fontSize: 32, color: '#667eea' }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#667eea' }}>
                      📈 Performance Insights
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>
                    <Box sx={{ 
                      textAlign: 'center', 
                      p: 3, 
                      backgroundColor: 'rgba(255,255,255,0.7)', 
                      borderRadius: 2,
                      border: '1px solid rgba(102, 126, 234, 0.2)'
                    }}>
                      <Typography variant="h4" sx={{ mb: 1, color: '#4CAF50' }}>🎯</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Monthly Target</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#4CAF50' }}>85% Achieved</Typography>
                      <Typography variant="body2" color="text.secondary">{formatCurrency(mockTransactions.reduce((sum, t) => sum + t.amount, 0) * 25.5)} / {formatCurrency(mockTransactions.reduce((sum, t) => sum + t.amount, 0) * 30)}</Typography>
                    </Box>
                    <Box sx={{ 
                      textAlign: 'center', 
                      p: 3, 
                      backgroundColor: 'rgba(255,255,255,0.7)', 
                      borderRadius: 2,
                      border: '1px solid rgba(102, 126, 234, 0.2)'
                    }}>
                      <Typography variant="h4" sx={{ mb: 1, color: '#2196F3' }}>👥</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Active Customers</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#2196F3' }}>1,247</Typography>
                      <Typography variant="body2" color="success.main">+12.3% from last month</Typography>
                    </Box>
                    <Box sx={{ 
                      textAlign: 'center', 
                      p: 3, 
                      backgroundColor: 'rgba(255,255,255,0.7)', 
                      borderRadius: 2,
                      border: '1px solid rgba(102, 126, 234, 0.2)'
                    }}>
                      <Typography variant="h4" sx={{ mb: 1, color: '#FF9800' }}>⚡</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Processing Speed</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#FF9800' }}>0.8s</Typography>
                      <Typography variant="body2" color="success.main">-0.4s improvement</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              {/* Monthly Comparison */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    📊 Monthly Comparison
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
                    {['Previous Month', 'Current Month', 'Projected Next'].map((period, index) => {
                      const multipliers = [0.85, 1.0, 1.18];
                      const revenue = mockTransactions.reduce((sum, t) => sum + t.amount, 0) * 30 * multipliers[index];
                      const growth = index === 0 ? 0 : ((multipliers[index] - multipliers[index - 1]) * 100);
                      return (
                        <Box key={period} sx={{ 
                          textAlign: 'center', 
                          p: 2, 
                          border: index === 1 ? '2px solid #2196F3' : '1px solid #e0e0e0', 
                          borderRadius: 2,
                          backgroundColor: index === 1 ? '#f3f8ff' : 'transparent'
                        }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>{period}</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 'bold', color: index === 1 ? '#2196F3' : 'inherit' }}>
                            {formatCurrency(revenue)}
                          </Typography>
                          {index > 0 && (
                            <Typography variant="body2" color={growth > 0 ? 'success.main' : 'error.main'} sx={{ mt: 1 }}>
                              {growth > 0 ? '↗' : '↘'} {Math.abs(growth).toFixed(1)}%
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                </CardContent>
              </Card>
            </Stack>
          </TabPanel>
        </CardContent>
      </Card>

      {renderDailyReportDialog()}
      {renderExportDialog()}
      {renderPastReportsDialog()}
      
      {/* Delete Report Dialog - Admin Only */}
      <Dialog open={deleteReportDialog} onClose={() => setDeleteReportDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: '#FF9800', display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon />
          Delete Daily Report
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>⚠️ Warning:</strong> This action will permanently delete the selected daily report. 
            This cannot be undone.
          </DialogContentText>
          
          <TextField
            label="Select Date to Delete"
            type="date"
            value={deleteDate}
            onChange={(e) => setDeleteDate(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
            InputLabelProps={{ shrink: true }}
          />
          
          {pastReports.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Available reports to delete:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {pastReports.map((report) => (
                  <Button
                    key={report.date}
                    variant={deleteDate === report.date ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => setDeleteDate(report.date)}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    {new Date(report.date).toLocaleDateString()}
                  </Button>
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteReportDialog(false); setDeleteDate(''); }}>Cancel</Button>
          <Button 
            onClick={handleDeleteDailyReport} 
            color="warning" 
            variant="contained"
            disabled={loading || !deleteDate}
            startIcon={loading ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {loading ? 'Deleting...' : 'Delete Report'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Reset System Dialog - Admin Only */}
      <Dialog open={resetSystemDialog} onClose={() => setResetSystemDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: '#F44336', display: 'flex', alignItems: 'center', gap: 1 }}>
          <RestoreFromTrashIcon />
          Reset System
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>🚨 CRITICAL WARNING:</strong> This action will permanently delete ALL transaction data, 
            daily reports, and system records. Only activity logs will be preserved.
          </DialogContentText>
          
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              This action cannot be undone. All data will be lost permanently.
            </Typography>
          </Alert>
          
          <Typography variant="body2" sx={{ mb: 2 }}>
            To confirm this action, please type <strong>DELETE ALL DATA</strong> exactly as shown:
          </Typography>
          
          <TextField
            label="Type 'DELETE ALL DATA' to confirm"
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
            fullWidth
            error={resetConfirmText.length > 0 && resetConfirmText !== 'DELETE ALL DATA'}
            helperText={resetConfirmText.length > 0 && resetConfirmText !== 'DELETE ALL DATA' ? 
              'Please type exactly "DELETE ALL DATA"' : ''}
            sx={{ mb: 2 }}
          />
          
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            Data that will be deleted:
          </Typography>
          <Box component="ul" sx={{ mt: 1, mb: 2, pl: 2 }}>
            <Typography component="li" variant="body2" color="text.secondary">• All transaction records</Typography>
            <Typography component="li" variant="body2" color="text.secondary">• All daily reports</Typography>
            <Typography component="li" variant="body2" color="text.secondary">• All expense records</Typography>
            <Typography component="li" variant="body2" color="text.secondary">• All fund records</Typography>
            <Typography component="li" variant="body2" color="text.secondary">• All generated reports</Typography>
          </Box>
          
          <Typography variant="body2" color="success.main" sx={{ fontWeight: 'bold' }}>
            ✅ Activity logs will be preserved for audit purposes
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setResetSystemDialog(false); setResetConfirmText(''); }}>Cancel</Button>
          <Button 
            onClick={handleResetSystem} 
            color="error" 
            variant="contained"
            disabled={loading || resetConfirmText !== 'DELETE ALL DATA'}
            startIcon={loading ? <CircularProgress size={16} /> : <RestoreFromTrashIcon />}
          >
            {loading ? 'Resetting...' : 'Reset System'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Settle Payment Dialog */}
      <Dialog open={settleDialog} onClose={() => setSettleDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: '#2196F3', display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReceiptIcon />
          Settle Payment
        </DialogTitle>
        <DialogContent>
          {selectedTransaction && (
            <Stack spacing={3} sx={{ mt: 2 }}>
              <Box sx={{ p: 2, backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="h6" gutterBottom>
                  Transaction Details
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">OR Number</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{selectedTransaction.or_number}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Customer</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{selectedTransaction.customer_name}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Total Amount</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>₱{selectedTransaction.amount.toLocaleString()}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Payment Status</Typography>
                    <Chip 
                      label={getPaymentStatusLabel(selectedTransaction.payment_status)}
                      color={getPaymentStatusColor(selectedTransaction.payment_status) as any}
                      size="small"
                    />
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Paid Amount</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                      ₱{selectedTransaction.paid_amount.toLocaleString()}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Outstanding Balance</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                      ₱{selectedTransaction.balance_amount.toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              </Box>
              
              <Divider />
              
              <Box>
                <Typography variant="h6" gutterBottom>
                  Settlement Information
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="Settlement Amount"
                    type="number"
                    value={settlementAmount}
                    onChange={(e) => setSettlementAmount(parseFloat(e.target.value) || 0)}
                    fullWidth
                    InputProps={{ 
                      startAdornment: '₱',
                      inputProps: { 
                        min: 0, 
                        max: selectedTransaction.balance_amount,
                        step: 0.01
                      }
                    }}
                    helperText={`Maximum: ₱${selectedTransaction.balance_amount.toLocaleString()}`}
                  />
                  <FormControl fullWidth>
                    <InputLabel>Payment Method</InputLabel>
                    <Select
                      value={settlementPaymentMode}
                      label="Payment Method"
                      onChange={(e) => setSettlementPaymentMode(e.target.value as PaymentMode)}
                    >
                      <MenuItem value={PaymentMode.CASH}>Cash</MenuItem>
                      <MenuItem value={PaymentMode.GCASH}>GCash</MenuItem>
                      <MenuItem value={PaymentMode.MAYA}>Maya</MenuItem>
                      <MenuItem value={PaymentMode.CREDIT_CARD}>Credit Card</MenuItem>
                      <MenuItem value={PaymentMode.BANK_TRANSFER}>Bank Transfer</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Box>
              
              <TextField
                label="Settlement Notes (Optional)"
                value={settlementNotes}
                onChange={(e) => setSettlementNotes(e.target.value)}
                fullWidth
                multiline
                rows={3}
                placeholder="Add any notes about this settlement..."
              />
              
              {settlementAmount > 0 && (
                <Box sx={{ p: 2, backgroundColor: theme.palette.mode === 'dark' ? 'rgba(46, 204, 113, 0.1)' : '#e8f5e8', borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    After this settlement:
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                    <Typography variant="body2">New paid amount:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                      ₱{(selectedTransaction.paid_amount + settlementAmount).toLocaleString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Remaining balance:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: selectedTransaction.balance_amount - settlementAmount > 0 ? 'error.main' : 'success.main' }}>
                      ₱{(selectedTransaction.balance_amount - settlementAmount).toLocaleString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">New status:</Typography>
                    <Chip 
                      label={selectedTransaction.balance_amount - settlementAmount === 0 ? 'Paid' : 'Partial'}
                      color={selectedTransaction.balance_amount - settlementAmount === 0 ? 'success' : 'warning'}
                      size="small"
                    />
                  </Box>
                </Box>
              )}
              
              <Divider />
              
              {/* Settlement History */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  Settlement History
                </Typography>
                {loadingHistory ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : settlementHistory.length === 0 ? (
                  <Box sx={{ textAlign: 'center', p: 2, color: 'text.secondary' }}>
                    <Typography variant="body2">No previous settlements found</Typography>
                  </Box>
                ) : (
                  <Box sx={{ maxHeight: 250, overflowY: 'auto' }}>
                    {settlementHistory.map((settlement, index) => (
                      <Box 
                        key={index} 
                        sx={{ 
                          p: 2, 
                          border: '1px solid #e0e0e0', 
                          borderRadius: 1, 
                          mb: 1,
                          backgroundColor: '#f9f9f9'
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            ₱{settlement.amount.toLocaleString()}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip 
                              label={getPaymentModeLabel(settlement.payment_mode)}
                              color={getPaymentModeColor(settlement.payment_mode) as any}
                              size="small"
                            />
                            <Typography variant="caption" color="text.secondary">
                              {new Date(settlement.created_at).toLocaleString()}
                            </Typography>
                          </Box>
                        </Box>
                        {settlement.notes && (
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                            Notes: {settlement.notes}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          Processed by: {settlement.processed_by_name || 'System'}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettleDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleConfirmSettlement} 
            variant="contained"
            disabled={loading || !selectedTransaction || settlementAmount <= 0 || settlementAmount > selectedTransaction.balance_amount}
            startIcon={loading ? <CircularProgress size={16} /> : <ReceiptIcon />}
          >
            {loading ? 'Processing...' : 'Confirm Settlement'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Transaction Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: '#F44336', display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon />
          Delete Transaction
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>⚠️ Warning:</strong> This action will permanently delete the selected transaction. 
            This cannot be undone.
          </DialogContentText>
          
          {transactionToDelete && (
            <Box sx={{ p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="h6" gutterBottom>
                Transaction Details
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">OR Number</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{transactionToDelete.or_number}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Customer</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{transactionToDelete.customer_name}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Total Amount</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>₱{transactionToDelete.amount.toLocaleString()}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">Payment Status</Typography>
                  <Chip 
                    label={getPaymentStatusLabel(transactionToDelete.payment_status)}
                    color={getPaymentStatusColor(transactionToDelete.payment_status) as any}
                    size="small"
                  />
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleConfirmDelete} 
            color="error" 
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {loading ? 'Deleting...' : 'Delete Transaction'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Success Snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSuccessMessage('')} 
          severity="success" 
          sx={{ width: '100%' }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EnhancedTransactionManagement;
