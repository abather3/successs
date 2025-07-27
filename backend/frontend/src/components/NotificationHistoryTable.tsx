import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Grid,
  Paper,
  IconButton,
  Tooltip,
  Menu,
  ListItemIcon,
  ListItemText,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridPaginationModel,
  GridSortModel,
  GridFilterModel,
  GridRowParams,
  GridToolbar
} from '@mui/x-data-grid';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  GetApp as ExportIcon,
  Visibility as ViewIcon,
  Clear as ClearIcon,
  Person as PersonIcon,
  Receipt as ReceiptIcon,
  CheckCircle as ProcessedIcon,
  Schedule as PendingIcon,
  Error as ErrorIcon,
  FileDownload as DownloadIcon,
  TableView as CsvIcon,
  PictureAsPdf as PdfIcon
} from '@mui/icons-material';
import { format } from 'date-fns';

// Types for notification data
interface NotificationRow {
  id: string;
  notification_id: string;
  type: string;
  title: string;
  message: string;
  customer_data: {
    id: number;
    name: string;
    or_number: string;
    token_number: number;
    contact_number?: string;
    priority_type: string;
    priority_flags: {
      senior_citizen: boolean;
      pregnant: boolean;
      pwd: boolean;
    };
    payment_amount: number;
    payment_mode: string;
  };
  created_by_name: string;
  created_by_role: string;
  target_role: string;
  is_read: boolean;
  read_at?: string;
  read_by_user_id?: number;
  expires_at: string;
  created_at: string;
  actions: Array<{
    action_type: string;
    label: string;
    is_primary: boolean;
  }>;
  transaction_id?: number;
  transaction_amount?: number;
  transaction_status?: string;
}

interface NotificationHistoryResponse {
  success: boolean;
  notifications: NotificationRow[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_records: number;
    per_page: number;
    has_next: boolean;
    has_prev: boolean;
  };
  filters_applied: any;
  timestamp: string;
}

interface NotificationHistoryTableProps {
  onRowClick?: (notification: NotificationRow) => void;
  onExport?: (format: 'csv' | 'xlsx' | 'pdf', filters: any) => void;
  initialFilters?: {
    search?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    priority?: string;
    action?: string;
    status?: string;
  };
  height?: number;
  enableSelection?: boolean;
  showExportButton?: boolean;
  title?: string;
}

// Priority type options
const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'Senior Citizen', label: 'Senior Citizen' },
  { value: 'Pregnant', label: 'Pregnant' },
  { value: 'PWD', label: 'PWD' },
  { value: 'Regular Customer', label: 'Regular Customer' }
];

// Action type options
const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'view_customer', label: 'View Customer' },
  { value: 'start_transaction', label: 'Process Transaction' }
];

// Status options
const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'read', label: 'Processed' },
  { value: 'unread', label: 'Unread' },
  { value: 'expired', label: 'Expired' }
];

const NotificationHistoryTable: React.FC<NotificationHistoryTableProps> = ({
  onRowClick,
  onExport,
  initialFilters = {},
  height = 600,
  enableSelection = false,
  showExportButton = true,
  title = 'Notification History'
}) => {
  // State management
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NotificationRow[]>([]);
  const [pagination, setPagination] = useState({
    current_page: 1,
    total_pages: 0,
    total_records: 0,
    per_page: 20,
    has_next: false,
    has_prev: false
  });
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState(initialFilters.search || '');
  const [startDate, setStartDate] = useState<Date | null>(initialFilters.startDate || null);
  const [endDate, setEndDate] = useState<Date | null>(initialFilters.endDate || null);
  const [priorityFilter, setPriorityFilter] = useState(initialFilters.priority || '');
  const [actionFilter, setActionFilter] = useState(initialFilters.action || '');
  const [statusFilter, setStatusFilter] = useState(initialFilters.status || '');
  
  // DataGrid states
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 20
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([
    { field: 'created_at', sort: 'desc' }
  ]);
  
  // Export menu state
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null);

  // Fetch data function
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: (paginationModel.page + 1).toString(),
        q: searchTerm,
        startDate: startDate ? format(startDate, 'yyyy-MM-dd') : '',
        endDate: endDate ? format(endDate, 'yyyy-MM-dd') : '',
        priority_type: priorityFilter,
        action: actionFilter,
        status: statusFilter
      });

      const response = await fetch(`/api/customer-notifications/history?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: NotificationHistoryResponse = await response.json();
      
      if (result.success) {
        setData(result.notifications);
        setPagination(result.pagination);
      } else {
        throw new Error('Failed to fetch notification history');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load notification history';
      setError(errorMessage);
      console.error('Error fetching notification history:', err);
    } finally {
      setLoading(false);
    }
  }, [paginationModel.page, searchTerm, startDate, endDate, priorityFilter, actionFilter, statusFilter]);

  // Effect to fetch data when dependencies change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle search with debouncing
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    const timeout = setTimeout(() => {
      setPaginationModel(prev => ({ ...prev, page: 0 }));
    }, 500);
    setSearchTimeout(timeout);
  };

  // Handle filter changes
  const handleFilterChange = (filterType: string, value: any) => {
    setPaginationModel(prev => ({ ...prev, page: 0 })); // Reset to first page
    
    switch (filterType) {
      case 'priority':
        setPriorityFilter(value);
        break;
      case 'action':
        setActionFilter(value);
        break;
      case 'status':
        setStatusFilter(value);
        break;
      case 'startDate':
        setStartDate(value);
        break;
      case 'endDate':
        setEndDate(value);
        break;
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setStartDate(null);
    setEndDate(null);
    setPriorityFilter('');
    setActionFilter('');
    setStatusFilter('');
    setPaginationModel(prev => ({ ...prev, page: 0 }));
  };

  // Handle export
  const handleExport = (format: 'csv' | 'xlsx' | 'pdf') => {
    const filters = {
      search: searchTerm,
      startDate: startDate ? format(startDate, 'yyyy-MM-dd') : '',
      endDate: endDate ? format(endDate, 'yyyy-MM-dd') : '',
      priority_type: priorityFilter,
      action: actionFilter,
      status: statusFilter
    };

    if (onExport) {
      onExport(format, filters);
    } else {
      // Default export behavior - download from backend
      const params = new URLSearchParams({
        format,
        ...filters
      });
      
      const link = document.createElement('a');
      link.href = `/api/customer-notifications/export?${params}`;
      link.download = `notification-history-${format}.${format}`;
      link.click();
    }
    
    setExportAnchorEl(null);
  };

  // Get priority chip color
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'senior citizen':
        return 'primary';
      case 'pregnant':
        return 'secondary';
      case 'pwd':
        return 'warning';
      default:
        return 'default';
    }
  };

  // Get status icon and color
  const getStatusDisplay = (notification: NotificationRow) => {
    const now = new Date();
    const expiresAt = new Date(notification.expires_at);
    const isExpired = now > expiresAt;
    
    if (isExpired && !notification.is_read) {
      return { icon: <ErrorIcon />, color: 'error', label: 'Expired' };
    } else if (notification.is_read) {
      return { icon: <ProcessedIcon />, color: 'success', label: 'Processed' };
    } else {
      return { icon: <PendingIcon />, color: 'warning', label: 'Pending' };
    }
  };

  // Format transaction link
  const getTransactionLink = (notification: NotificationRow) => {
    if (notification.transaction_id) {
      return (
        <Tooltip title={`View Transaction #${notification.transaction_id}`}>
          <Chip
            icon={<ReceiptIcon />}
            label={`Txn #${notification.transaction_id}`}
            size="small"
            color="primary"
            variant="outlined"
            clickable
            onClick={(e) => {
              e.stopPropagation();
              // Handle transaction view
              window.open(`/transactions/${notification.transaction_id}`, '_blank');
            }}
          />
        </Tooltip>
      );
    }
    return <Typography variant="caption" color="textSecondary">No linked transaction</Typography>;
  };

  // DataGrid columns configuration
  const columns: GridColDef[] = useMemo(() => [
    {
      field: 'created_at',
      headerName: 'Date',
      width: 160,
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2">
          {format(new Date(params.value), 'MMM dd, yyyy HH:mm')}
        </Typography>
      )
    },
    {
      field: 'customer',
      headerName: 'Customer',
      width: 200,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => {
        const customer = params.row.customer_data;
        return (
          <Box>
            <Typography variant="body2" fontWeight="medium">
              {customer.name}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              OR: {customer.or_number} | Token: #{customer.token_number}
            </Typography>
          </Box>
        );
      }
    },
    {
      field: 'priority',
      headerName: 'Priority',
      width: 140,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => {
        const priority = params.row.customer_data.priority_type;
        return (
          <Chip
            label={priority}
            size="small"
            color={getPriorityColor(priority) as any}
            variant="filled"
          />
        );
      }
    },
    {
      field: 'action_taken',
      headerName: 'Action Taken',
      width: 150,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => {
        const actions = params.row.actions;
        const primaryAction = actions.find(a => a.is_primary) || actions[0];
        return primaryAction ? (
          <Chip
            label={primaryAction.label}
            size="small"
            variant="outlined"
          />
        ) : (
          <Typography variant="caption">No action</Typography>
        );
      }
    },
    {
      field: 'processed_by',
      headerName: 'Processed By',
      width: 150,
      renderCell: (params: GridRenderCellParams) => {
        return params.row.is_read ? (
          <Box>
            <Typography variant="body2">
              {params.row.created_by_name}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {params.row.read_at ? format(new Date(params.row.read_at), 'MMM dd, HH:mm') : 'Unknown time'}
            </Typography>
          </Box>
        ) : (
          <Typography variant="caption" color="textSecondary">
            Not processed
          </Typography>
        );
      }
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params: GridRenderCellParams) => {
        const statusDisplay = getStatusDisplay(params.row);
        return (
          <Chip
            icon={statusDisplay.icon}
            label={statusDisplay.label}
            size="small"
            color={statusDisplay.color as any}
            variant="filled"
          />
        );
      }
    },
    {
      field: 'linked_transaction',
      headerName: 'Linked Transaction',
      width: 180,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => getTransactionLink(params.row)
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Tooltip title="View Details">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              if (onRowClick) {
                onRowClick(params.row);
              }
            }}
          >
            <ViewIcon />
          </IconButton>
        </Tooltip>
      )
    }
  ], [onRowClick]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Paper elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box p={3} pb={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5" component="h2" fontWeight="bold">
              {title}
            </Typography>
            {showExportButton && (
              <Button
                variant="outlined"
                startIcon={<ExportIcon />}
                onClick={(e) => setExportAnchorEl(e.currentTarget)}
                disabled={loading || data.length === 0}
              >
                Export
              </Button>
            )}
          </Box>

          {/* Filters */}
          <Grid container spacing={2} alignItems="center">
            {/* Search */}
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search notifications, customers, OR numbers..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
                  endAdornment: searchTerm && (
                    <IconButton
                      size="small"
                      onClick={() => handleSearchChange('')}
                    >
                      <ClearIcon />
                    </IconButton>
                  )
                }}
              />
            </Grid>

            {/* Date Range */}
            <Grid item xs={6} md={2}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={(date) => handleFilterChange('startDate', date)}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid item xs={6} md={2}>
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={(date) => handleFilterChange('endDate', date)}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>

            {/* Priority Filter */}
            <Grid item xs={4} md={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Priority</InputLabel>
                <Select
                  value={priorityFilter}
                  label="Priority"
                  onChange={(e) => handleFilterChange('priority', e.target.value)}
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Action Filter */}
            <Grid item xs={4} md={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel>Action</InputLabel>
                <Select
                  value={actionFilter}
                  label="Action"
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                >
                  {ACTION_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Status Filter */}
            <Grid item xs={4} md={1}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Clear Filters */}
            <Grid item xs={12} md={12}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Button
                  startIcon={<ClearIcon />}
                  onClick={handleClearFilters}
                  disabled={!searchTerm && !startDate && !endDate && !priorityFilter && !actionFilter && !statusFilter}
                >
                  Clear Filters
                </Button>
                <Typography variant="body2" color="textSecondary">
                  {pagination.total_records} notifications found
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>

        <Divider />

        {/* Error Display */}
        {error && (
          <Box p={2}>
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          </Box>
        )}

        {/* Data Grid */}
        <Box flex={1} p={2}>
          <DataGrid
            rows={data}
            columns={columns}
            loading={loading}
            paginationMode="server"
            sortingMode="server"
            filterMode="server"
            pagination
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[10, 20, 50, 100]}
            rowCount={pagination.total_records}
            sortModel={sortModel}
            onSortModelChange={setSortModel}
            onRowClick={(params: GridRowParams) => {
              if (onRowClick) {
                onRowClick(params.row);
              }
            }}
            disableRowSelectionOnClick
            checkboxSelection={enableSelection}
            disableColumnMenu
            slots={{
              toolbar: GridToolbar,
              loadingOverlay: CircularProgress
            }}
            slotProps={{
              toolbar: {
                showQuickFilter: false,
                printOptions: { disableToolbarButton: true }
              }
            }}
            sx={{
              '& .MuiDataGrid-row:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                cursor: 'pointer'
              },
              '& .MuiDataGrid-cell': {
                borderRight: '1px solid rgba(224, 224, 224, 1)'
              },
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: 'rgba(0, 0, 0, 0.02)',
                borderBottom: '2px solid rgba(224, 224, 224, 1)'
              }
            }}
            getRowId={(row) => row.notification_id}
          />
        </Box>

        {/* Export Menu */}
        <Menu
          anchorEl={exportAnchorEl}
          open={Boolean(exportAnchorEl)}
          onClose={() => setExportAnchorEl(null)}
        >
          <MenuItem onClick={() => handleExport('csv')}>
            <ListItemIcon>
              <CsvIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Export as CSV</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleExport('xlsx')}>
            <ListItemIcon>
              <DownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Export as Excel</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleExport('pdf')}>
            <ListItemIcon>
              <PdfIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Export as PDF</ListItemText>
          </MenuItem>
        </Menu>
      </Paper>
    </LocalizationProvider>
  );
};

export default NotificationHistoryTable;
