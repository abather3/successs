import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  IconButton,
  Stack,
  Grid,
  LinearProgress,
  Chip,
  Divider,
  Badge,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  useTheme,
  alpha
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  AccessTime as AccessTimeIcon,
  Speed as SpeedIcon,
  Dashboard as DashboardIcon,
  Timeline as TimelineIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  ShowChart as ShowChartIcon,
  Assessment as AssessmentIcon,
  Schedule as ScheduleIcon,
  Group as GroupIcon,
  Star as StarIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Timer as TimerIcon,
  Store as StoreIcon,
  Insights as InsightsIcon,
  CalendarToday as CalendarIcon,
  FilterList as FilterIcon,
  Print as PrintIcon,
  GetApp as GetAppIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  Archive as ArchiveIcon,
  EventNote as EventNoteIcon,
  Autorenew as AutorenewIcon,
  DataUsage as DataUsageIcon
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart as RechartsBarChart, Bar, PieChart as RechartsPieChart, Cell, Pie, AreaChart, Area } from 'recharts';

// Types
interface DailyQueueHistory {
  date: string;
  totalCustomers: number;
  waitingCustomers: number;
  servingCustomers: number;
  completedCustomers: number;
  cancelledCustomers: number;
  carriedForwardCustomers: number;
  avgWaitTime: number;
  peakQueueLength: number;
  operatingHours: number;
}

interface DisplayMonitorHistory {
  date: string;
  daily_customers_served: number;
  daily_avg_wait_time: number;
  daily_peak_queue_length: number;
  daily_priority_customers: number;
  operating_efficiency: number;
  created_at: string;
}

interface CustomerHistoryItem {
  id: number;
  original_customer_id: number;
  name: string;
  email: string;
  phone: string;
  queue_status: string;
  token_number: number;
  priority_flags: any;
  wait_time_minutes: number;
  service_duration_minutes: number;
  carried_forward: boolean;
  archive_date: string;
  created_at: string;
}

interface DailyResetLog {
  id: number;
  reset_date: string;
  customers_archived: number;
  customers_carried_forward: number;
  queues_reset: number;
  success: boolean;
  error_message: string | null;
  duration_ms: number;
  created_at: string;
}

interface HistoricalDashboard {
  period: {
    days: number;
    start_date: string;
    end_date: string;
  };
  summary: {
    total_customers_served: number;
    average_wait_time_minutes: number;
    successful_resets: number;
    failed_resets: number;
    reset_success_rate: number;
  };
  daily_queue_history: DailyQueueHistory[];
  display_monitor_history: DisplayMonitorHistory[];
  reset_logs: DailyResetLog[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

const HistoricalAnalyticsDashboard: React.FC = () => {
  const theme = useTheme();
  const [dashboard, setDashboard] = useState<HistoricalDashboard | null>(null);
  const [customerHistory, setCustomerHistory] = useState<CustomerHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerHistoryLoading, setCustomerHistoryLoading] = useState(false);
  const [days, setDays] = useState(30);
  const [currentTab, setCurrentTab] = useState(0);
  const [customerPage, setCustomerPage] = useState(1);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });

  const fetchHistoricalDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_BASE_URL}/analytics/historical-dashboard?days=${days}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDashboard(data);
        } else {
          throw new Error(data.error || 'Failed to fetch historical dashboard');
        }
      } else {
        throw new Error('Failed to fetch historical dashboard');
      }
    } catch (error) {
      console.error('Error fetching historical dashboard:', error);
      setSnackbar({
        open: true,
        message: 'Failed to fetch historical analytics dashboard',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [days]);

  const fetchCustomerHistory = useCallback(async () => {
    try {
      setCustomerHistoryLoading(true);
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_BASE_URL}/analytics/customer-history?days=${days}&page=${customerPage}&limit=20`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCustomerHistory(data.data);
        } else {
          throw new Error(data.error || 'Failed to fetch customer history');
        }
      } else {
        throw new Error('Failed to fetch customer history');
      }
    } catch (error) {
      console.error('Error fetching customer history:', error);
      setSnackbar({
        open: true,
        message: 'Failed to fetch customer history',
        severity: 'error'
      });
    } finally {
      setCustomerHistoryLoading(false);
    }
  }, [days, customerPage]);

  useEffect(() => {
    fetchHistoricalDashboard();
  }, [fetchHistoricalDashboard]);

  useEffect(() => {
    if (currentTab === 3) { // Customer History tab
      fetchCustomerHistory();
    }
  }, [fetchCustomerHistory, currentTab]);

  const formatTime = (minutes: number): string => {
    if (isNaN(minutes) || minutes === null || minutes === undefined) {
      return '0m';
    }
    
    const numMinutes = Number(minutes);
    if (numMinutes < 60) {
      return `${Math.round(numMinutes)}m`;
    }
    const hours = Math.floor(numMinutes / 60);
    const remainingMinutes = Math.round(numMinutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading historical analytics...</Typography>
      </Box>
    );
  }

  if (!dashboard) {
    return (
      <Box>
        <Alert severity="error">Failed to load historical analytics dashboard</Alert>
      </Box>
    );
  }

  // Prepare chart data
  const dailyTrendData = dashboard.daily_queue_history.map(day => ({
    date: formatDate(day.date),
    customers: day.totalCustomers,
    waitTime: day.avgWaitTime,
    completed: day.completedCustomers,
    cancelled: day.cancelledCustomers,
    peak: day.peakQueueLength
  }));

  const efficiencyData = dashboard.display_monitor_history.map(day => ({
    date: formatDate(day.date),
    efficiency: day.operating_efficiency,
    served: day.daily_customers_served,
    avgWait: day.daily_avg_wait_time,
    priority: day.daily_priority_customers
  }));

  const resetStatusData = [
    { name: 'Successful Resets', value: dashboard.summary.successful_resets, color: '#00C49F' },
    { name: 'Failed Resets', value: dashboard.summary.failed_resets, color: '#FF8042' }
  ];

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            <HistoryIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
            Historical Queue Analytics
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Data from Daily Queue Scheduler Archives ({dashboard.period.start_date} to {dashboard.period.end_date})
          </Typography>
        </Box>
        <Box display="flex" gap={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Period</InputLabel>
            <Select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              label="Time Period"
            >
              <MenuItem value={7}>Last 7 days</MenuItem>
              <MenuItem value={30}>Last 30 days</MenuItem>
              <MenuItem value={60}>Last 60 days</MenuItem>
              <MenuItem value={90}>Last 90 days</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Refresh Data">
            <IconButton onClick={fetchHistoricalDashboard}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Box 
        display="flex" 
        flexWrap="wrap" 
        gap={3} 
        mb={3}
        sx={{
          '& > *': {
            flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(25% - 18px)' }
          }
        }}
      >
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                <PeopleIcon />
              </Avatar>
              <Box>
                <Typography variant="h4">{dashboard.summary.total_customers_served}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Customers
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar sx={{ bgcolor: theme.palette.info.main }}>
                <AccessTimeIcon />
              </Avatar>
              <Box>
                <Typography variant="h4">
                  {formatTime(dashboard.summary.average_wait_time_minutes)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg Wait Time
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar sx={{ bgcolor: theme.palette.success.main }}>
                <CheckCircleIcon />
              </Avatar>
              <Box>
                <Typography variant="h4">{dashboard.summary.successful_resets}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Successful Resets
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar sx={{ bgcolor: theme.palette.error.main }}>
                <ErrorIcon />
              </Avatar>
              <Box>
                <Typography variant="h4">{dashboard.summary.failed_resets}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Failed Resets
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar sx={{ bgcolor: theme.palette.warning.main }}>
                <DataUsageIcon />
              </Avatar>
              <Box>
                <Typography variant="h4">{dashboard.summary.reset_success_rate}%</Typography>
                <Typography variant="body2" color="text.secondary">
                  Success Rate
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Tabs for different views */}
      <Card>
        <CardContent>
          <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)}>
            <Tab label="Daily Trends" icon={<ShowChartIcon />} />
            <Tab label="Efficiency Analysis" icon={<AssessmentIcon />} />
            <Tab label="Reset Logs" icon={<AutorenewIcon />} />
            <Tab label="Customer History" icon={<ArchiveIcon />} />
          </Tabs>

          <Box mt={3}>
            {/* Daily Trends Tab */}
            {currentTab === 0 && (
              <Box>
                <Typography variant="h6" gutterBottom>Daily Queue Trends</Typography>
                <Box height={400}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Area type="monotone" dataKey="customers" stackId="1" stroke="#8884d8" fill="#8884d8" name="Total Customers" />
                      <Area type="monotone" dataKey="completed" stackId="1" stroke="#00C49F" fill="#00C49F" name="Completed" />
                      <Area type="monotone" dataKey="cancelled" stackId="1" stroke="#FF8042" fill="#FF8042" name="Cancelled" />
                      <Line type="monotone" dataKey="waitTime" stroke="#FF6B6B" name="Avg Wait Time (min)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>

                <Box 
                  display="flex" 
                  flexWrap="wrap" 
                  gap={2} 
                  mt={2}
                  sx={{
                    '& > *': {
                      flex: { xs: '1 1 100%', md: '1 1 calc(50% - 8px)' }
                    }
                  }}
                >
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Peak Queue Lengths</Typography>
                      <Box height={300}>
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsBarChart data={dailyTrendData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <RechartsTooltip />
                            <Bar dataKey="peak" fill="#FFBB28" name="Peak Queue Length" />
                          </RechartsBarChart>
                        </ResponsiveContainer>
                      </Box>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Customer Status Distribution</Typography>
                      <Box height={300}>
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPieChart>
                            <Pie
                              data={[
                                { name: 'Completed', value: dailyTrendData.reduce((sum, day) => sum + day.completed, 0) },
                                { name: 'Cancelled', value: dailyTrendData.reduce((sum, day) => sum + day.cancelled, 0) }
                              ]}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {COLORS.map((color, index) => (
                                <Cell key={`cell-${index}`} fill={color} />
                              ))}
                            </Pie>
                            <RechartsTooltip />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              </Box>
            )}

            {/* Efficiency Analysis Tab */}
            {currentTab === 1 && (
              <Box>
                <Typography variant="h6" gutterBottom>Operating Efficiency Analysis</Typography>
                <Box height={400}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={efficiencyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="efficiency" stroke="#00C49F" strokeWidth={3} name="Efficiency %" />
                      <Line type="monotone" dataKey="served" stroke="#8884d8" name="Customers Served" />
                      <Line type="monotone" dataKey="avgWait" stroke="#FF8042" name="Avg Wait Time" />
                      <Line type="monotone" dataKey="priority" stroke="#FFBB28" name="Priority Customers" />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>

                <Box 
                  display="flex" 
                  flexWrap="wrap" 
                  gap={2} 
                  mt={2}
                  sx={{
                    '& > *:first-of-type': {
                      flex: { xs: '1 1 100%', md: '1 1 calc(66.67% - 8px)' }
                    },
                    '& > *:last-of-type': {
                      flex: { xs: '1 1 100%', md: '1 1 calc(33.33% - 8px)' }
                    }
                  }}
                >
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Efficiency Metrics Summary</Typography>
                      <List>
                        <ListItem>
                          <ListItemIcon><TrendingUpIcon color="success" /></ListItemIcon>
                          <ListItemText
                            primary="Average Efficiency"
                            secondary={`${Math.round(efficiencyData.reduce((sum, day) => sum + day.efficiency, 0) / efficiencyData.length)}%`}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon><PeopleIcon color="primary" /></ListItemIcon>
                          <ListItemText
                            primary="Total Customers Served"
                            secondary={efficiencyData.reduce((sum, day) => sum + day.served, 0)}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon><StarIcon color="warning" /></ListItemIcon>
                          <ListItemText
                            primary="Priority Customers"
                            secondary={efficiencyData.reduce((sum, day) => sum + day.priority, 0)}
                          />
                        </ListItem>
                      </List>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Reset Success Rate</Typography>
                      <Box display="flex" justifyContent="center" alignItems="center" height={200}>
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPieChart>
                            <Pie
                              data={resetStatusData}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {resetStatusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </Box>
                      <Box textAlign="center">
                        <Typography variant="h4" color="success.main">
                          {dashboard.summary.reset_success_rate}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Success Rate
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              </Box>
            )}

            {/* Reset Logs Tab */}
            {currentTab === 2 && (
              <Box>
                <Typography variant="h6" gutterBottom>Daily Reset Operation Logs</Typography>
                <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Customers Archived</TableCell>
                        <TableCell>Carried Forward</TableCell>
                        <TableCell>Duration</TableCell>
                        <TableCell>Error Message</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {dashboard.reset_logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {formatDate(log.reset_date)}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={log.success ? 'Success' : 'Failed'}
                              color={log.success ? 'success' : 'error'}
                              size="small"
                              icon={log.success ? <CheckCircleIcon /> : <ErrorIcon />}
                            />
                          </TableCell>
                          <TableCell>{log.customers_archived}</TableCell>
                          <TableCell>{log.customers_carried_forward}</TableCell>
                          <TableCell>
                            {log.duration_ms ? `${Math.round(log.duration_ms)}ms` : '-'}
                          </TableCell>
                          <TableCell>
                            {log.error_message ? (
                              <Tooltip title={log.error_message}>
                                <Chip label="View Error" size="small" color="error" />
                              </Tooltip>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* Customer History Tab */}
            {currentTab === 3 && (
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">Archived Customer Records</Typography>
                  <Button
                    startIcon={<RefreshIcon />}
                    onClick={fetchCustomerHistory}
                    disabled={customerHistoryLoading}
                    size="small"
                  >
                    Refresh
                  </Button>
                </Box>
                
                {customerHistoryLoading ? (
                  <Box display="flex" justifyContent="center" py={4}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Archive Date</TableCell>
                          <TableCell>Customer Name</TableCell>
                          <TableCell>Token #</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Wait Time</TableCell>
                          <TableCell>Service Time</TableCell>
                          <TableCell>Carried Forward</TableCell>
                          <TableCell>Priority</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {customerHistory.map((customer) => (
                          <TableRow key={customer.id}>
                            <TableCell>
                              {formatDate(customer.archive_date)}
                            </TableCell>
                            <TableCell>
                              <Box>
                                <Typography variant="body2" fontWeight="medium">
                                  {customer.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {customer.email}
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Badge badgeContent={customer.token_number} color="primary">
                                <EventNoteIcon />
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={customer.queue_status}
                                size="small"
                                color={
                                  customer.queue_status === 'completed' ? 'success' :
                                  customer.queue_status === 'cancelled' ? 'error' :
                                  customer.queue_status === 'serving' ? 'warning' :
                                  'default'
                                }
                              />
                            </TableCell>
                            <TableCell>
                              {customer.wait_time_minutes ? formatTime(customer.wait_time_minutes) : '-'}
                            </TableCell>
                            <TableCell>
                              {customer.service_duration_minutes ? formatTime(customer.service_duration_minutes) : '-'}
                            </TableCell>
                            <TableCell>
                              {customer.carried_forward && (
                                <Chip label="Yes" size="small" color="info" />
                              )}
                            </TableCell>
                            <TableCell>
                              {customer.priority_flags && (
                                Object.entries(customer.priority_flags).some(([key, value]) => 
                                  key !== 'regular' && value === true
                                ) && <Chip label="Priority" size="small" color="warning" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default HistoricalAnalyticsDashboard;
