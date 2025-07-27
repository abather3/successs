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
  FormControlLabel
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
  Timer as TimerIcon,
  Store as StoreIcon,
  Insights as InsightsIcon,
  CalendarToday as CalendarIcon,
  FilterList as FilterIcon,
  Print as PrintIcon,
  GetApp as GetAppIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';

interface QueueActivity {
  id: number;
  customer_id: number;
  event_type: 'joined' | 'called' | 'served' | 'left' | 'cancelled';
  queue_position: number;
  wait_time_minutes: number;
  service_time_minutes: number;
  is_priority: boolean;
  created_at: string;
  counter_name: string;
  customer_name: string;
  or_number: string;
}

interface AnalyticsDashboard {
  today: {
    date: string;
    totalCustomers: number;
    priorityCustomers: number;
    avgWaitTimeMinutes: number;
    avgServiceTimeMinutes: number;
    peakHour: number;
    peakQueueLength: number;
    customersServed: number;
    busiestCounterId: number;
  };
  hourlyTrend: Array<{
    date: string;
    hour: number;
    totalCustomers: number;
    priorityCustomers: number;
    avgWaitTimeMinutes: number;
    avgServiceTimeMinutes: number;
    peakQueueLength: number;
    customersServed: number;
  }>;
  weeklyComparison: Array<{
    date: string;
    totalCustomers: number;
    priorityCustomers: number;
    avgWaitTimeMinutes: number;
    avgServiceTimeMinutes: number;
    peakHour: number;
    peakQueueLength: number;
    customersServed: number;
    busiestCounterId: number;
  }>;
  peakHours: Array<{ hour: number; avgCustomers: number }>;
  counterPerformance: Array<{ 
    counterId: number; 
    name: string; 
    customersServed: number; 
    avgServiceTime: number; 
  }>;
  waitTimeDistribution: Array<{ range: string; count: number }>;
}

const QueueAnalyticsDashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null);
  const [queueActivities, setQueueActivities] = useState<QueueActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Include tomorrow
  });
  const [exportFormat, setExportFormat] = useState('csv');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end
      });

      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_BASE_URL}/analytics/dashboard?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
      } else {
        throw new Error('Failed to fetch dashboard data');
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      setSnackbar({
        open: true,
        message: 'Failed to fetch analytics dashboard',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const fetchActivities = useCallback(async () => {
    try {
      setActivitiesLoading(true);
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end,
        limit: '50'
      });

      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_BASE_URL}/analytics/queue-activities?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setQueueActivities(data.activities || []);
      } else {
        throw new Error('Failed to fetch queue activities');
      }
    } catch (error) {
      console.error('Error fetching queue activities:', error);
      setSnackbar({
        open: true,
        message: 'Failed to fetch queue activities',
        severity: 'error'
      });
    } finally {
      setActivitiesLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchDashboard();
    fetchActivities();
  }, [fetchDashboard, fetchActivities]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        startDate: dateRange.start,
        endDate: dateRange.end,
        type: 'daily',
        format: exportFormat
      });

      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_BASE_URL}/analytics/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        if (exportFormat === 'csv') {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `queue-analytics-${dateRange.start}-${dateRange.end}.csv`;
          a.click();
          window.URL.revokeObjectURL(url);
        } else {
          const data = await response.json();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `queue-analytics-${dateRange.start}-${dateRange.end}.json`;
          a.click();
          window.URL.revokeObjectURL(url);
        }

        setSnackbar({
          open: true,
          message: 'Analytics data exported successfully',
          severity: 'success'
        });
      } else {
        throw new Error('Failed to export data');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      setSnackbar({
        open: true,
        message: 'Failed to export analytics data',
        severity: 'error'
      });
    }
  };

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

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading analytics...</Typography>
      </Box>
    );
  }

  if (!dashboard) {
    return (
      <Box>
        <Alert severity="error">Failed to load analytics dashboard</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Queue Analytics Dashboard</Typography>
        <Box display="flex" gap={2} alignItems="center">
          <TextField
            label="Start Date"
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
          <TextField
            label="End Date"
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Format</InputLabel>
            <Select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              label="Format"
            >
              <MenuItem value="csv">CSV</MenuItem>
              <MenuItem value="json">JSON</MenuItem>
            </Select>
          </FormControl>
          <Button
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            variant="outlined"
          >
            Export
          </Button>
          <Tooltip title="Refresh Data">
            <IconButton onClick={() => { fetchDashboard(); fetchActivities(); }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Key Metrics Cards */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 3 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <PeopleIcon color="primary" sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h4">{dashboard.today.totalCustomers}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Customers Today
                </Typography>
                {dashboard.today.priorityCustomers > 0 && (
                  <Typography variant="caption" color="warning.main">
                    {dashboard.today.priorityCustomers} priority
                  </Typography>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <AccessTimeIcon color="info" sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h4">
                  {formatTime(dashboard.today.avgWaitTimeMinutes)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg Wait Time
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <SpeedIcon color="success" sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h4">
                  {formatTime(dashboard.today.avgServiceTimeMinutes)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg Service Time
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2}>
              <TrendingUpIcon color="warning" sx={{ fontSize: 40 }} />
              <Box>
                <Typography variant="h4">{dashboard.today.peakQueueLength}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Peak Queue Length
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  at {formatHour(dashboard.today.peakHour)}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Charts and Analysis */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3, mb: 3 }}>
        {/* Peak Hours Analysis */}
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Peak Hours Analysis</Typography>
            <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
              {dashboard.peakHours.map((peak, index) => (
                <Box key={peak.hour} display="flex" justifyContent="space-between" alignItems="center" py={1}>
                  <Typography variant="body2">
                    #{index + 1} - {formatHour(peak.hour)}
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {Math.round(peak.avgCustomers)} avg customers
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* Counter Performance */}
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Counter Performance</Typography>
            <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
              {dashboard.counterPerformance.map((counter) => (
                <Box key={counter.counterId} py={1}>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" fontWeight="medium">
                      {counter.name}
                    </Typography>
                    <Typography variant="body2">
                      {counter.customersServed} served
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Avg service time: {formatTime(counter.avgServiceTime || 0)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Wait Time Distribution */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Wait Time Distribution</Typography>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
            {dashboard.waitTimeDistribution.map((dist) => (
              <Box key={dist.range} textAlign="center" sx={{ flex: 1 }}>
                <Typography variant="h5" color="primary">{dist.count}</Typography>
                <Typography variant="body2" color="text.secondary">{dist.range}</Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Queue Activities Log */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Queue Activities Log</Typography>
            <Button 
              startIcon={<RefreshIcon />} 
              onClick={fetchActivities}
              disabled={activitiesLoading}
              size="small"
            >
              Refresh
            </Button>
          </Box>
          
          {activitiesLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Event</TableCell>
                    <TableCell>Queue Position</TableCell>
                    <TableCell>Wait Time</TableCell>
                    <TableCell>Service Time</TableCell>
                    <TableCell>Counter</TableCell>
                    <TableCell>Priority</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {queueActivities.length > 0 ? (
                    queueActivities.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell>
                          {new Date(activity.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {activity.customer_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {activity.or_number}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={activity.event_type}
                            size="small"
                            color={
                              activity.event_type === 'joined' ? 'info' :
                              activity.event_type === 'called' ? 'warning' :
                              activity.event_type === 'served' ? 'success' :
                              activity.event_type === 'cancelled' ? 'error' :
                              'default'
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {activity.queue_position || '-'}
                        </TableCell>
                        <TableCell>
                          {activity.wait_time_minutes ? formatTime(activity.wait_time_minutes) : '-'}
                        </TableCell>
                        <TableCell>
                          {activity.service_time_minutes ? formatTime(activity.service_time_minutes) : '-'}
                        </TableCell>
                        <TableCell>
                          {activity.counter_name || '-'}
                        </TableCell>
                        <TableCell>
                          {activity.is_priority && (
                            <Chip label="Priority" size="small" color="warning" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        <Typography variant="body2" color="text.secondary" py={4}>
                          No queue activities found for the selected date range
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Weekly Comparison */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Weekly Comparison</Typography>
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {dashboard.weeklyComparison.length > 0 ? (
              <Box>
                {dashboard.weeklyComparison.map((day) => (
                  <Box key={day.date} py={2} borderBottom="1px solid #eee">
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="subtitle1" fontWeight="medium">
                        {new Date(day.date).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </Typography>
                      <Typography variant="body2" color="primary">
                        {day.totalCustomers} customers
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Avg Wait: {formatTime(day.avgWaitTimeMinutes)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Peak Queue: {day.peakQueueLength}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Served: {day.customersServed}
                      </Typography>
                      {day.priorityCustomers > 0 && (
                        <Typography variant="caption" color="warning.main">
                          Priority: {day.priorityCustomers}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                No data available for the selected date range
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>

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

export default QueueAnalyticsDashboard;
