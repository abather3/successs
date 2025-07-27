import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  CircularProgress,
  Alert,
  Avatar,
  IconButton,
  Stack
} from '@mui/material';
import {
  Person as PersonIcon,
  Group as GroupIcon,
  AccessTime as AccessTimeIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  CalendarToday as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  Dashboard as DashboardIcon
} from '@mui/icons-material';

interface SalesAgentStats {
  total: number;
  waiting: number;
  serving: number;
  completed: number;
  cancelled: number;
  todayTotal: number;
  thisWeekTotal: number;
  thisMonthTotal: number;
}

interface Customer {
  id: number;
  or_number: string;
  name: string;
  contact_number: string;
  email: string;
  queue_status: string;
  token_number: number;
  created_at: string;
  priority_flags: {
    senior_citizen: boolean;
    pregnant: boolean;
    pwd: boolean;
  };
}

const SalesAgentDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  
  const [stats, setStats] = useState<SalesAgentStats | null>(null);
  const [recentCustomers, setRecentCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch sales agent statistics
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/customers/stats/sales-agent', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }
      
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setError('Failed to load statistics');
    }
  };

  // Fetch recent customers
  const fetchRecentCustomers = async () => {
    try {
      const response = await fetch('/api/customers?limit=5&sortBy=created_at&sortOrder=desc', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch recent customers');
      }
      
      const data = await response.json();
      setRecentCustomers(data.customers || []);
    } catch (error) {
      console.error('Error fetching recent customers:', error);
      setError('Failed to load recent customers');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchRecentCustomers()]);
      setLoading(false);
    };
    
    loadData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'warning';
      case 'serving': return 'info';
      case 'completed': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'waiting': return <AccessTimeIcon fontSize="small" />;
      case 'serving': return <PersonIcon fontSize="small" />;
      case 'completed': return <CheckCircleIcon fontSize="small" />;
      case 'cancelled': return <CancelIcon fontSize="small" />;
      default: return <GroupIcon fontSize="small" />;
    }
  };

  const getPriorityText = (priorityFlags: any) => {
    const priorities = [];
    if (priorityFlags?.senior_citizen) priorities.push('Senior');
    if (priorityFlags?.pregnant) priorities.push('Pregnant');
    if (priorityFlags?.pwd) priorities.push('PWD');
    return priorities.length > 0 ? priorities.join(', ') : 'Regular';
  };

  const handleCustomerAction = (customerId: number, action: string) => {
    switch (action) {
      case 'view':
        navigate(`/customers/${customerId}`);
        break;
      case 'edit':
        navigate(`/customers/${customerId}/edit`);
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ 
        p: { xs: 1, sm: 2, md: 3 }, 
        maxWidth: '100vw',
        width: '100%',
        mx: 'auto',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          alignItems={{ xs: 'center', sm: 'center' }} 
          spacing={2} 
          sx={{ mb: 2 }}
        >
          <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
            <DashboardIcon />
          </Avatar>
          <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
            <Typography variant="h4" component="h1" gutterBottom>
              Sales Agent Dashboard
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Welcome back, {user?.full_name}! Here's your performance overview.
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Quick Stats Cards */}
      	<Grid container spacing={3} sx={{ 
          mb: 4,
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}>
        	<Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ 
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Today's Customers
                  </Typography>
                  <Typography variant="h4" component="div">
                    {stats?.todayTotal || 0}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                  <CalendarIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ 
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    This Week
                  </Typography>
                  <Typography variant="h4" component="div">
                    {stats?.thisWeekTotal || 0}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: theme.palette.success.main }}>
                  <TrendingUpIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ 
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    This Month
                  </Typography>
                  <Typography variant="h4" component="div">
                    {stats?.thisMonthTotal || 0}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: theme.palette.info.main }}>
                  <GroupIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ 
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="text.secondary" variant="body2">
                    Waiting Now
                  </Typography>
                  <Typography variant="h4" component="div">
                    {stats?.waiting || 0}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: theme.palette.warning.main }}>
                  <AccessTimeIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Today's Status Breakdown */}
      	<Grid container spacing={3} sx={{ 
          mb: 4,
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}>
        	<Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ 
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Today's Status Breakdown
              </Typography>
              <Grid container spacing={2}>
                <Grid size={6}>
                  <Box textAlign="center">
                    <Typography variant="h3" color="warning.main">
                      {stats?.waiting || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Waiting
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={6}>
                  <Box textAlign="center">
                    <Typography variant="h3" color="info.main">
                      {stats?.serving || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Serving
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={6}>
                  <Box textAlign="center">
                    <Typography variant="h3" color="success.main">
                      {stats?.completed || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completed
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={6}>
                  <Box textAlign="center">
                    <Typography variant="h3" color="error.main">
                      {stats?.cancelled || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Cancelled
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ 
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Stack spacing={2}>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/customers/new')}
                  fullWidth
                >
                  Register New Customer
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<GroupIcon />}
                  onClick={() => navigate('/customers')}
                  fullWidth
                >
                  View All My Customers
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<AccessTimeIcon />}
                  onClick={() => navigate('/queue')}
                  fullWidth
                >
                  View Queue
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Customers */}
      <Card sx={{ 
        maxWidth: '100%', 
        width: '100%', 
        overflow: 'hidden', 
        boxSizing: 'border-box' 
      }}>
        <CardContent sx={{ 
          p: { xs: 2, sm: 3 }, 
          maxWidth: '100%', 
          width: '100%', 
          overflow: 'hidden', 
          boxSizing: 'border-box' 
        }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">
              Recent Customers
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => navigate('/customers')}
              startIcon={<ViewIcon />}
            >
              View All
            </Button>
          </Box>
          
          <Box sx={{ overflowX: 'auto' }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Token</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Customer</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', display: { xs: 'none', sm: 'table-cell' } }}>Contact</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Status</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', display: { xs: 'none', md: 'table-cell' } }}>Priority</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', display: { xs: 'none', md: 'table-cell' } }}>Created</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentCustomers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <Chip
                          label={`#${customer.token_number.toString().padStart(3, '0')}`}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="medium" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                            {customer.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', sm: 'block' } }}>
                            {customer.or_number}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {customer.contact_number}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(customer.queue_status)}
                          label={customer.queue_status.charAt(0).toUpperCase() + customer.queue_status.slice(1)}
                          color={getStatusColor(customer.queue_status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {getPriorityText(customer.priority_flags)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {new Date(customer.created_at).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton
                            size="small"
                            onClick={() => handleCustomerAction(customer.id, 'view')}
                            title="View Customer"
                          >
                            <ViewIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleCustomerAction(customer.id, 'edit')}
                            title="Edit Customer"
                            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
          
          {recentCustomers.length === 0 && (
            <Box textAlign="center" py={4}>
              <Typography color="text.secondary">
                No customers registered yet. Start by creating your first customer!
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/customers/new')}
                sx={{ mt: 2 }}
              >
                Register Customer
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default SalesAgentDashboard;
