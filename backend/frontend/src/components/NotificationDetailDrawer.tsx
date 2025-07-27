import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Chip,
  Button,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Link,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Receipt as ReceiptIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  PlayArrow as StartIcon,
  History as HistoryIcon,
  Payment as PaymentIcon,
  LocalHospital as DoctorIcon,
  Work as WorkIcon,
  Home as HomeIcon,
  Calendar as CalendarIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import ReactJson from 'react-json-view';

interface NotificationData {
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

interface Customer {
  id: number;
  name: string;
  or_number: string;
  contact_number: string;
  email?: string;
  age: number;
  address: string;
  occupation?: string;
  priority_flags: {
    senior_citizen: boolean;
    pregnant: boolean;
    pwd: boolean;
  };
  prescription: {
    od: string;
    os: string;
    ou: string;
    pd: string;
    add: string;
  };
  payment_info: {
    mode: string;
    amount: number;
  };
  queue_status: string;
  token_number: number;
  estimated_time: number;
  created_at: string;
  doctor_assigned?: string;
  sales_agent_name?: string;
  grade_type: string;
  lens_type: string;
  frame_code: string;
  remarks?: string;
}

interface NotificationDetailDrawerProps {
  open: boolean;
  notification: NotificationData | null;
  onClose: () => void;
  onActionClick?: (actionType: string, notification: NotificationData) => void;
}

const NotificationDetailDrawer: React.FC<NotificationDetailDrawerProps> = ({
  open,
  notification,
  onClose,
  onActionClick
}) => {
  const [customerDetails, setCustomerDetails] = useState<Customer | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [expandedAccordion, setExpandedAccordion] = useState<string | false>('basic');

  // Fetch full customer details when notification changes
  useEffect(() => {
    if (notification && open) {
      fetchCustomerDetails(notification.customer_data.id);
    }
  }, [notification, open]);

  const fetchCustomerDetails = async (customerId: number) => {
    setLoadingCustomer(true);
    setCustomerError(null);

    try {
      const response = await fetch(`/api/customers/${customerId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        setCustomerDetails(result.customer);
      } else {
        throw new Error('Failed to fetch customer details');
      }
    } catch (error) {
      console.error('Error fetching customer details:', error);
      setCustomerError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoadingCustomer(false);
    }
  };

  if (!notification) return null;

  // Get notification status and styling
  const getNotificationStatus = () => {
    const now = new Date();
    const expiresAt = new Date(notification.expires_at);
    const isExpired = now > expiresAt;

    if (isExpired && !notification.is_read) {
      return {
        status: 'Expired',
        color: 'error' as const,
        icon: <ErrorIcon />,
        severity: 'error' as const
      };
    } else if (notification.is_read) {
      return {
        status: 'Processed',
        color: 'success' as const,
        icon: <CheckCircleIcon />,
        severity: 'success' as const
      };
    } else {
      const timeLeft = expiresAt.getTime() - now.getTime();
      const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
      
      if (hoursLeft <= 1) {
        return {
          status: 'Expiring Soon',
          color: 'warning' as const,
          icon: <WarningIcon />,
          severity: 'warning' as const
        };
      } else {
        return {
          status: 'Active',
          color: 'primary' as const,
          icon: <InfoIcon />,
          severity: 'info' as const
        };
      }
    }
  };

  const statusInfo = getNotificationStatus();

  // Format priority flags
  const formatPriorityFlags = (flags: any) => {
    const priorities = [];
    if (flags.senior_citizen) priorities.push('Senior Citizen');
    if (flags.pregnant) priorities.push('Pregnant');
    if (flags.pwd) priorities.push('PWD');
    return priorities.length > 0 ? priorities.join(', ') : 'None';
  };

  // Handle action clicks
  const handleActionClick = (actionType: string) => {
    if (onActionClick) {
      onActionClick(actionType, notification);
    } else {
      // Default action handlers
      switch (actionType) {
        case 'view_customer':
          window.open(`/customers/${notification.customer_data.id}`, '_blank');
          break;
        case 'start_transaction':
          window.open(`/transactions/new?customer=${notification.customer_data.id}`, '_blank');
          break;
      }
    }
  };

  const handleAccordionChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedAccordion(isExpanded ? panel : false);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: '90%', md: '60%', lg: '50%' },
          maxWidth: '800px'
        }
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar sx={{ bgcolor: statusInfo.color + '.main' }}>
                {statusInfo.icon}
              </Avatar>
              <Box>
                <Typography variant="h6" component="h2">
                  Notification Details
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {notification.notification_id}
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={onClose} edge="end">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {/* Status Alert */}
          <Alert severity={statusInfo.severity} sx={{ mb: 3 }}>
            <Typography variant="subtitle2" component="div">
              Status: {statusInfo.status}
            </Typography>
            {notification.is_read ? (
              <Typography variant="body2">
                Processed on {format(new Date(notification.read_at!), 'PPP p')} by {notification.created_by_name}
              </Typography>
            ) : (
              <Typography variant="body2">
                {statusInfo.status === 'Expiring Soon' 
                  ? `Expires ${format(new Date(notification.expires_at), 'PPP p')}`
                  : `Created ${format(new Date(notification.created_at), 'PPP p')}`
                }
              </Typography>
            )}
          </Alert>

          {/* Notification Basic Info */}
          <Card sx={{ mb: 3 }} elevation={2}>
            <CardHeader
              title={notification.title}
              subheader={notification.message}
              action={
                <Chip 
                  label={notification.type.replace('_', ' ').toUpperCase()} 
                  variant="outlined" 
                  size="small"
                />
              }
            />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Created By
                  </Typography>
                  <Typography variant="body1">
                    {notification.created_by_name} ({notification.created_by_role})
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Target Role
                  </Typography>
                  <Typography variant="body1">
                    {notification.target_role.charAt(0).toUpperCase() + notification.target_role.slice(1)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Created At
                  </Typography>
                  <Typography variant="body1">
                    {format(new Date(notification.created_at), 'PPP p')}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Expires At
                  </Typography>
                  <Typography variant="body1">
                    {format(new Date(notification.expires_at), 'PPP p')}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          {notification.actions.length > 0 && (
            <Card sx={{ mb: 3 }} elevation={2}>
              <CardHeader 
                title="Available Actions" 
                avatar={<StartIcon color="primary" />}
              />
              <CardContent>
                <Grid container spacing={2}>
                  {notification.actions.map((action, index) => (
                    <Grid item xs={12} sm={6} key={index}>
                      <Button
                        fullWidth
                        variant={action.is_primary ? "contained" : "outlined"}
                        color={action.is_primary ? "primary" : "secondary"}
                        startIcon={action.action_type === 'view_customer' ? <ViewIcon /> : <EditIcon />}
                        onClick={() => handleActionClick(action.action_type)}
                        disabled={notification.is_read && !action.is_primary}
                      >
                        {action.label}
                      </Button>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* Customer Information Card */}
          <Card sx={{ mb: 3 }} elevation={2}>
            <CardHeader
              title="Customer Information"
              avatar={<PersonIcon color="primary" />}
              action={
                <Chip
                  label={notification.customer_data.priority_type}
                  color={
                    notification.customer_data.priority_type === 'Senior Citizen' ? 'primary' :
                    notification.customer_data.priority_type === 'Pregnant' ? 'secondary' :
                    notification.customer_data.priority_type === 'PWD' ? 'warning' : 'default'
                  }
                  size="small"
                />
              }
            />
            <CardContent>
              {loadingCustomer ? (
                <Box display="flex" justifyContent="center" p={2}>
                  <CircularProgress />
                </Box>
              ) : customerError ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  Failed to load customer details: {customerError}
                </Alert>
              ) : (
                <Box>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} sm={6}>
                      <List dense>
                        <ListItem disableGutters>
                          <ListItemIcon><PersonIcon /></ListItemIcon>
                          <ListItemText
                            primary={notification.customer_data.name}
                            secondary="Customer Name"
                          />
                        </ListItem>
                        <ListItem disableGutters>
                          <ListItemIcon><ReceiptIcon /></ListItemIcon>
                          <ListItemText
                            primary={notification.customer_data.or_number}
                            secondary="OR Number"
                          />
                        </ListItem>
                        <ListItem disableGutters>
                          <ListItemIcon><ScheduleIcon /></ListItemIcon>
                          <ListItemText
                            primary={`Token #${notification.customer_data.token_number}`}
                            secondary="Token Number"
                          />
                        </ListItem>
                      </List>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <List dense>
                        {notification.customer_data.contact_number && (
                          <ListItem disableGutters>
                            <ListItemIcon><PhoneIcon /></ListItemIcon>
                            <ListItemText
                              primary={notification.customer_data.contact_number}
                              secondary="Contact Number"
                            />
                          </ListItem>
                        )}
                        <ListItem disableGutters>
                          <ListItemIcon><PaymentIcon /></ListItemIcon>
                          <ListItemText
                            primary={`₱${notification.customer_data.payment_amount} (${notification.customer_data.payment_mode})`}
                            secondary="Payment Info"
                          />
                        </ListItem>
                        <ListItem disableGutters>
                          <ListItemIcon><WarningIcon /></ListItemIcon>
                          <ListItemText
                            primary={formatPriorityFlags(notification.customer_data.priority_flags)}
                            secondary="Priority Status"
                          />
                        </ListItem>
                      </List>
                    </Grid>
                  </Grid>

                  {/* Customer Details Accordions */}
                  {customerDetails && (
                    <Box>
                      <Accordion 
                        expanded={expandedAccordion === 'basic'} 
                        onChange={handleAccordionChange('basic')}
                      >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="subtitle2">Basic Information</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Grid container spacing={2}>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="textSecondary">Age</Typography>
                              <Typography variant="body1">{customerDetails.age}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="textSecondary">Email</Typography>
                              <Typography variant="body1">{customerDetails.email || 'Not provided'}</Typography>
                            </Grid>
                            <Grid item xs={12}>
                              <Typography variant="body2" color="textSecondary">Address</Typography>
                              <Typography variant="body1">{customerDetails.address}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="textSecondary">Occupation</Typography>
                              <Typography variant="body1">{customerDetails.occupation || 'Not specified'}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="textSecondary">Doctor Assigned</Typography>
                              <Typography variant="body1">{customerDetails.doctor_assigned || 'Not assigned'}</Typography>
                            </Grid>
                          </Grid>
                        </AccordionDetails>
                      </Accordion>

                      <Accordion 
                        expanded={expandedAccordion === 'prescription'} 
                        onChange={handleAccordionChange('prescription')}
                      >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="subtitle2">Prescription Details</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Grid container spacing={2}>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="textSecondary">OD (Right Eye)</Typography>
                              <Typography variant="body1">{customerDetails.prescription.od}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="textSecondary">OS (Left Eye)</Typography>
                              <Typography variant="body1">{customerDetails.prescription.os}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="textSecondary">OU (Both Eyes)</Typography>
                              <Typography variant="body1">{customerDetails.prescription.ou}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="textSecondary">PD (Pupillary Distance)</Typography>
                              <Typography variant="body1">{customerDetails.prescription.pd}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="textSecondary">ADD (Addition)</Typography>
                              <Typography variant="body1">{customerDetails.prescription.add}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="textSecondary">Grade Type</Typography>
                              <Typography variant="body1">{customerDetails.grade_type}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="textSecondary">Lens Type</Typography>
                              <Typography variant="body1">{customerDetails.lens_type}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="textSecondary">Frame Code</Typography>
                              <Typography variant="body1">{customerDetails.frame_code}</Typography>
                            </Grid>
                          </Grid>
                        </AccordionDetails>
                      </Accordion>

                      <Accordion 
                        expanded={expandedAccordion === 'status'} 
                        onChange={handleAccordionChange('status')}
                      >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography variant="subtitle2">Queue & Payment Status</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Grid container spacing={2}>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="textSecondary">Queue Status</Typography>
                              <Chip label={customerDetails.queue_status} size="small" color="primary" />
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="textSecondary">Estimated Time</Typography>
                              <Typography variant="body1">{customerDetails.estimated_time} minutes</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="textSecondary">Payment Method</Typography>
                              <Typography variant="body1">{customerDetails.payment_info.mode}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2" color="textSecondary">Payment Amount</Typography>
                              <Typography variant="body1">₱{customerDetails.payment_info.amount}</Typography>
                            </Grid>
                            {customerDetails.remarks && (
                              <Grid item xs={12}>
                                <Typography variant="body2" color="textSecondary">Remarks</Typography>
                                <Typography variant="body1">{customerDetails.remarks}</Typography>
                              </Grid>
                            )}
                          </Grid>
                        </AccordionDetails>
                      </Accordion>
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Transaction Information */}
          {notification.transaction_id && (
            <Card sx={{ mb: 3 }} elevation={2}>
              <CardHeader
                title="Linked Transaction"
                avatar={<ReceiptIcon color="success" />}
                action={
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ViewIcon />}
                    onClick={() => window.open(`/transactions/${notification.transaction_id}`, '_blank')}
                  >
                    View Transaction
                  </Button>
                }
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Transaction ID</Typography>
                    <Typography variant="body1">#{notification.transaction_id}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Amount</Typography>
                    <Typography variant="body1">₱{notification.transaction_amount}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="textSecondary">Status</Typography>
                    <Chip label={notification.transaction_status} size="small" color="success" />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* Raw JSON Data (Collapsible) */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Raw Notification Data (JSON)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Paper variant="outlined" sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
                <ReactJson
                  src={notification}
                  theme="rjv-default"
                  collapsed={1}
                  displayDataTypes={false}
                  displayObjectSize={false}
                  enableClipboard={true}
                  name="notification"
                />
              </Paper>
            </AccordionDetails>
          </Accordion>
        </Box>

        {/* Footer Actions */}
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Button
                fullWidth
                variant="outlined"
                onClick={onClose}
              >
                Close
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<ViewIcon />}
                onClick={() => window.open(`/customers/${notification.customer_data.id}`, '_blank')}
              >
                View Customer
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </Drawer>
  );
};

export default NotificationDetailDrawer;
