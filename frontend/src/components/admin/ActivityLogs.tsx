import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Pagination,
  Alert,
  Snackbar,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Clear as ClearIcon
} from '@mui/icons-material';

interface ActivityLog {
  id: number;
  user_id: number;
  user_full_name: string;
  action: string;
  details: any;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

interface Filters {
  action: string;
  startDate: string;
  endDate: string;
  userId: string;
}

const ActivityLogs: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    action: '',
    startDate: '',
    endDate: '',
    userId: ''
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });

  const availableActions = [
    'login', 'logout', 'password_change', 'password_reset',
    'create_user', 'update_user', 'delete_user',
    'create_customer', 'update_customer', 'delete_customer',
    'create_counter', 'update_counter', 'delete_counter',
    'create_grade_type', 'update_grade_type', 'delete_grade_type',
    'create_lens_type', 'update_lens_type', 'delete_lens_type',
    'get_queue', 'call_next_customer', 'complete_service',
    'view_activity_logs', 'export_customer_excel', 'export_customer_pdf'
  ];

  const fetchActivityLogs = async () => {
    try {
      setLoading(true);
      const queryParams: Record<string, string> = {
        page: currentPage.toString(),
        limit: '50'
      };
      
      // Add non-empty filter values
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          queryParams[key] = value;
        }
      });
      
      const params = new URLSearchParams(queryParams);

      const response = await fetch(`/api/admin/activity-logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
        setTotalPages(Math.ceil(data.pagination.total / data.pagination.per_page));
      } else {
        throw new Error('Failed to fetch activity logs');
      }
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      setSnackbar({
        open: true,
        message: 'Failed to fetch activity logs',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivityLogs();
  }, [currentPage, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = (field: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      action: '',
      startDate: '',
      endDate: '',
      userId: ''
    });
    setCurrentPage(1);
  };

  const handleViewDetails = (log: ActivityLog) => {
    setSelectedLog(log);
    setShowDetailsDialog(true);
  };

  const getActionColor = (action: string) => {
    if (action.includes('create')) return 'success';
    if (action.includes('update')) return 'warning';
    if (action.includes('delete')) return 'error';
    if (action.includes('login') || action.includes('logout')) return 'info';
    return 'default';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const exportLogs = async () => {
    try {
      const queryParams: Record<string, string> = {};
      
      // Add non-empty filter values
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          queryParams[key] = value;
        }
      });
      
      const params = new URLSearchParams(queryParams);
      const response = await fetch(`/api/admin/activity-logs/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `activity-logs-${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        setSnackbar({
          open: true,
          message: 'Activity logs exported successfully',
          severity: 'success'
        });
      } else {
        throw new Error('Failed to export logs');
      }
    } catch (error) {
      console.error('Error exporting logs:', error);
      setSnackbar({
        open: true,
        message: 'Failed to export activity logs',
        severity: 'error'
      });
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">
          Activity Logs
        </Typography>
        <Box>
          <Button
            startIcon={<DownloadIcon />}
            onClick={exportLogs}
            variant="outlined"
            sx={{ mr: 2 }}
          >
            Export
          </Button>
          <Button
            startIcon={<RefreshIcon />}
            onClick={fetchActivityLogs}
            variant="outlined"
          >
            Refresh
          </Button>
        </Box>
      </Box>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Comprehensive audit trail of all system activities. Logs are immutable and accessible only to administrators.
      </Typography>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Filters
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: 'center' }}>
            <Box sx={{ flex: 1, minWidth: { xs: '100%', md: '200px' } }}>
              <FormControl fullWidth size="small">
                <InputLabel>Action</InputLabel>
                <Select
                  value={filters.action}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                  label="Action"
                >
                  <MenuItem value="">All Actions</MenuItem>
                  {availableActions.map((action) => (
                    <MenuItem key={action} value={action}>
                      {action.replace(/_/g, ' ').toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ flex: 1, minWidth: { xs: '100%', md: '200px' } }}>
              <TextField
                label="Start Date"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: { xs: '100%', md: '200px' } }}>
              <TextField
                label="End Date"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: { xs: '100%', md: '200px' } }}>
              <Button
                startIcon={<ClearIcon />}
                onClick={clearFilters}
                variant="outlined"
                fullWidth
              >
                Clear Filters
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Activity Logs Table */}
      <Card>
        <CardContent>
          <TableContainer component={Paper} elevation={0}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>User Agent</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography>Loading activity logs...</Typography>
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography>No activity logs found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id} hover>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(log.created_at)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {log.user_full_name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={log.action.replace(/_/g, ' ').toUpperCase()}
                          color={getActionColor(log.action)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {log.ip_address}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            maxWidth: 200, 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {log.user_agent}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => handleViewDetails(log)}
                          >
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          <Box display="flex" justifyContent="center" mt={3}>
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={(_, page) => setCurrentPage(page)}
              color="primary"
              showFirstButton
              showLastButton
            />
          </Box>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog
        open={showDetailsDialog}
        onClose={() => setShowDetailsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Activity Log Details</DialogTitle>
        <DialogContent>
          {selectedLog && (
            <Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2">Timestamp</Typography>
                    <Typography variant="body2" gutterBottom>
                      {formatDate(selectedLog.created_at)}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2">User</Typography>
                    <Typography variant="body2" gutterBottom>
                      {selectedLog.user_full_name}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2">Action</Typography>
                    <Typography variant="body2" gutterBottom>
                      {selectedLog.action}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2">IP Address</Typography>
                    <Typography variant="body2" gutterBottom fontFamily="monospace">
                      {selectedLog.ip_address}
                    </Typography>
                  </Box>
                </Box>
                <Box>
                  <Typography variant="subtitle2">User Agent</Typography>
                  <Typography variant="body2" gutterBottom>
                    {selectedLog.user_agent}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">Details</Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetailsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ActivityLogs;
