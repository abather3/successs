import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Box, Card, CardContent, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Stack, Snackbar, Alert, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button, FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel, Slider, useTheme, useMediaQuery, TextField } from '@mui/material';
import { PlayArrow as ServeIcon, Check as CompleteIcon, Star as PriorityIcon, Queue as QueueIcon, Sms as SmsIcon, Refresh as RefreshIcon, DragIndicator as DragIcon, VolumeUp as VolumeIcon, VolumeOff as VolumeOffIcon, Cancel as CancelIcon, RestartAlt as ResetIcon } from '@mui/icons-material';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../../contexts/AuthContext';
import { formatEstimatedTime, minutesToEstimatedTime } from '../../utils/formatters';
import { notificationSound } from '../../utils/notificationSound';
import { formatTokenNumberWithHash } from '../../utils/tokenFormatter';
import io from 'socket.io-client';

const SortableTableRow = ({ customer, onServe, onComplete, onProcessing, onSendSMS, onCancel }: { customer: any; onServe: (id: number) => void; onComplete: (id: number) => void; onProcessing: (id: number) => void; onSendSMS: (customer: any) => void; onCancel: (customer: any) => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: customer.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getPriorityLabel = (flags: any) => {
    if (flags.senior_citizen) return 'Senior Citizen';
    if (flags.pregnant) return 'Pregnant';
    if (flags.pwd) return 'PWD';
    return 'Regular';
  };

  const getPriorityColor = (flags: any) => {
    if (flags.senior_citizen || flags.pregnant || flags.pwd) return 'error';
    return 'default';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'warning';
      case 'serving': return 'info';
      case 'processing': return 'secondary';
      case 'completed': return 'success';
      default: return 'default';
    }
  };

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes}>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" color="primary">
            {formatTokenNumberWithHash(customer.token_number)}
          </Typography>
          <DragIcon color="action" {...listeners} sx={{ cursor: 'grab' }} />
        </Box>
      </TableCell>
      <TableCell>{customer.name}</TableCell>
      <TableCell>{customer.or_number}</TableCell>
      <TableCell>
        <Chip 
          label={getPriorityLabel(customer.priority_flags)}
          color={getPriorityColor(customer.priority_flags)}
          size="small"
        />
      </TableCell>
      <TableCell>
        <Chip 
          label={customer.queue_status.toUpperCase()}
          color={getStatusColor(customer.queue_status)}
          size="small"
        />
      </TableCell>
      <TableCell>{formatEstimatedTime(minutesToEstimatedTime(customer.estimated_time))}</TableCell>
      <TableCell>{customer.contact_number}</TableCell>
      <TableCell>
        <Stack direction="row" spacing={1}>
          {customer.queue_status === 'waiting' && (
            <Tooltip title="Call Customer - Click to call this customer to a counter" arrow>
              <IconButton 
                size="small" 
                color="primary"
                onClick={() => onServe(customer.id)}
                sx={{
                  '&:hover': {
                    transform: 'scale(1.1)',
                    transition: 'transform 0.2s ease'
                  }
                }}
              >
                <ServeIcon />
              </IconButton>
            </Tooltip>
          )}
          {customer.queue_status === 'serving' && (
            <Tooltip title="Mark as Processing - Move to processing status" arrow>
              <IconButton 
                size="small" 
                color="secondary"
                onClick={() => onProcessing(customer.id)}
                sx={{
                  '&:hover': {
                    transform: 'scale(1.1)',
                    transition: 'transform 0.2s ease'
                  }
                }}
              >
                <QueueIcon />
              </IconButton>
            </Tooltip>
          )}
          {customer.queue_status === 'processing' && (
            <Tooltip title="Complete Service - Mark customer as completed" arrow>
              <IconButton 
                size="small" 
                color="success"
                onClick={() => onComplete(customer.id)}
                sx={{
                  '&:hover': {
                    transform: 'scale(1.1)',
                    transition: 'transform 0.2s ease'
                  }
                }}
              >
                <CompleteIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Send SMS - Send notification to customer" arrow>
            <IconButton 
              size="small" 
              color="secondary"
              onClick={() => onSendSMS(customer)}
              sx={{
                '&:hover': {
                  transform: 'scale(1.1)',
                  transition: 'transform 0.2s ease'
                }
              }}
            >
              <SmsIcon />
            </IconButton>
          </Tooltip>
          {(customer.queue_status === 'waiting' || customer.queue_status === 'serving' || customer.queue_status === 'processing') && (
            <Tooltip title="Cancel Customer - Remove customer from queue" arrow>
              <IconButton 
                size="small" 
                color="error"
                onClick={() => onCancel(customer)}
                sx={{
                  '&:hover': {
                    transform: 'scale(1.1)',
                    transition: 'transform 0.2s ease'
                  }
                }}
              >
                <CancelIcon />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </TableCell>
    </TableRow>
  );
};

// Mobile-friendly queue card component
const SortableQueueCard = ({ customer, onServe, onComplete, onProcessing, onSendSMS, onCancel }: { customer: any; onServe: (id: number) => void; onComplete: (id: number) => void; onProcessing: (id: number) => void; onSendSMS: (customer: any) => void; onCancel: (customer: any) => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: customer.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getPriorityLabel = (flags: any) => {
    if (flags.senior_citizen) return 'Senior Citizen';
    if (flags.pregnant) return 'Pregnant';
    if (flags.pwd) return 'PWD';
    return 'Regular';
  };

  const getPriorityColor = (flags: any) => {
    if (flags.senior_citizen || flags.pregnant || flags.pwd) return 'error';
    return 'default';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'warning';
      case 'serving': return 'info';
      case 'processing': return 'secondary';
      case 'completed': return 'success';
      default: return 'default';
    }
  };

  return (
    <Card ref={setNodeRef} style={style} {...attributes} sx={{ mb: 2, position: 'relative' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h5" color="primary" sx={{ fontWeight: 'bold' }}>
              {formatTokenNumberWithHash(customer.token_number)}
            </Typography>
            <DragIcon color="action" {...listeners} sx={{ cursor: 'grab' }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip 
              label={customer.queue_status.toUpperCase()}
              color={getStatusColor(customer.queue_status)}
              size="small"
            />
            <Chip 
              label={getPriorityLabel(customer.priority_flags)}
              color={getPriorityColor(customer.priority_flags)}
              size="small"
            />
          </Box>
        </Box>
        
        <Stack spacing={1} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Customer Name</Typography>
            <Typography variant="body1" sx={{ fontWeight: 'medium' }}>{customer.name}</Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box sx={{ flex: 1, mr: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">OR Number</Typography>
              <Typography variant="body2">{customer.or_number}</Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">Contact</Typography>
              <Typography variant="body2">{customer.contact_number}</Typography>
            </Box>
          </Box>
          
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Estimated Time</Typography>
            <Typography variant="body2">{formatEstimatedTime(minutesToEstimatedTime(customer.estimated_time))}</Typography>
          </Box>
        </Stack>
        
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {customer.queue_status === 'waiting' && (
            <Button 
              variant="contained" 
              color="primary"
              startIcon={<ServeIcon />}
              onClick={() => onServe(customer.id)}
              size="small"
              sx={{ flex: 1, minWidth: 120 }}
            >
              Call
            </Button>
          )}
          {customer.queue_status === 'serving' && (
            <Button 
              variant="contained" 
              color="secondary"
              startIcon={<QueueIcon />}
              onClick={() => onProcessing(customer.id)}
              size="small"
              sx={{ flex: 1, minWidth: 120 }}
            >
              Processing
            </Button>
          )}
          {customer.queue_status === 'processing' && (
            <Button 
              variant="contained" 
              color="success"
              startIcon={<CompleteIcon />}
              onClick={() => onComplete(customer.id)}
              size="small"
              sx={{ flex: 1, minWidth: 120 }}
            >
              Complete
            </Button>
          )}
          <Button 
            variant="outlined" 
            color="secondary"
            startIcon={<SmsIcon />}
            onClick={() => onSendSMS(customer)}
            size="small"
            sx={{ flex: 1, minWidth: 120 }}
          >
            SMS
          </Button>
          {(customer.queue_status === 'waiting' || customer.queue_status === 'serving' || customer.queue_status === 'processing') && (
            <Button 
              variant="outlined" 
              color="error"
              startIcon={<CancelIcon />}
              onClick={() => onCancel(customer)}
              size="small"
              sx={{ flex: 1, minWidth: 120 }}
            >
              Cancel
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

const QueueManagement = () => {
  const { accessToken, user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [queueData, setQueueData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [socket] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [volume, setVolume] = useState(0.5);
  const [previousQueueData, setPreviousQueueData] = useState<any[]>([]);
  const [currentTestSound, setCurrentTestSound] = useState<'info' | 'customer_added' | 'customer_serving' | 'customer_completed' | 'priority_customer'>('info');

  // Function to check queue changes and play appropriate notifications
  const checkQueueChanges = useCallback((oldQueue: any[], newQueue: any[]) => {
    if (!soundsEnabled) return;

    // Check for new customers added to queue
    const newCustomers = newQueue.filter(newCustomer => 
      !oldQueue.some(oldCustomer => oldCustomer.id === newCustomer.id)
    );

    // Check for status changes
    const statusChanges = newQueue.filter(newCustomer => {
      const oldCustomer = oldQueue.find(old => old.id === newCustomer.id);
      return oldCustomer && oldCustomer.queue_status !== newCustomer.queue_status;
    });

    // Play notifications for new customers
    newCustomers.forEach(customer => {
      if (customer.priority_score > 0) {
        notificationSound.playQueueNotification('priority_customer');
      } else {
        notificationSound.playQueueNotification('customer_added');
      }
    });

    // Play notifications for status changes
    statusChanges.forEach(customer => {
      switch (customer.queue_status) {
        case 'serving':
          notificationSound.playQueueNotification('customer_serving');
          break;
        case 'completed':
          notificationSound.playQueueNotification('customer_completed');
          break;
      }
    });
  }, [soundsEnabled]);

  // Function to fetch queue data from backend
  const fetchQueueData = useCallback(async () => {
    if (!accessToken) {
      console.log('No access token available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching queue data with token:', accessToken ? 'present' : 'missing');
      
      const response = await fetch('/api/queue/all-statuses', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Queue fetch response status:', response.status);
      
      if (response.ok) {
        const queueItems = await response.json();
        console.log('Queue items received:', queueItems);
        
        const newQueueData = queueItems.map((item: any) => ({
          id: item.customer.id,
          or_number: item.customer.or_number,
          name: item.customer.name,
          token_number: item.customer.token_number || item.position,
          priority_score: item.priority_score,
          queue_status: item.customer.queue_status,
          priority_flags: item.customer.priority_flags,
          estimated_time: item.estimated_wait_time,
          contact_number: item.customer.contact_number,
          distribution_info: item.customer.distribution_info
        }));
        
        // Check for queue changes and play notifications
        setPreviousQueueData(prev => {
          if (prev.length > 0) {
            checkQueueChanges(prev, newQueueData);
          }
          return newQueueData;
        });
        
        setQueueData(newQueueData);
      } else {
        const errorText = await response.text();
        console.error('Queue fetch error:', response.status, errorText);
        throw new Error(`Failed to fetch queue data: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching queue:', error);
      
      // Enhanced error handling with specific messages
      let errorMessage = 'Failed to fetch queue data';
      if (error instanceof Error) {
        if (error.message === 'Request timeout') {
          console.error('[QueueManagement] API Request timeout - server may be slow or unresponsive');
          errorMessage = 'Request timeout. The server is taking too long to respond. Please check your connection and try again.';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          console.error('[QueueManagement] Authentication error (401) - user may need to log in again');
          errorMessage = 'Authentication required. Please log in again to access queue data.';
        } else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
          console.error('[QueueManagement] Server error (500) - backend service issue');
          errorMessage = 'Server error. The backend service is experiencing issues. Please try again later.';
        } else {
          console.error('[QueueManagement] Other API error:', error.message);
          errorMessage = `Failed to fetch queue data: ${error.message}`;
        }
      } else {
        console.error('[QueueManagement] Unknown error type:', error);
        errorMessage = 'An unexpected error occurred while fetching queue data.';
      }
      
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [accessToken, checkQueueChanges]);

  // Initialize notification settings
  useEffect(() => {
    notificationSound.loadSettings();
    setSoundsEnabled(notificationSound.getSoundsEnabled());
    setVolume(notificationSound.getVolume());
  }, []);

  // Handle sound settings changes
  const handleSoundToggle = (enabled: boolean) => {
    setSoundsEnabled(enabled);
    notificationSound.setSoundsEnabled(enabled);
    if (enabled) {
      notificationSound.playNotificationBeep('info');
    }
  };

  const handleVolumeChange = (newValue: number | number[]) => {
    const volumeValue = Array.isArray(newValue) ? newValue[0] : newValue;
    setVolume(volumeValue);
    notificationSound.setVolume(volumeValue);
  };

  const handleTestSound = () => {
    const sounds = ['info', 'customer_added', 'customer_serving', 'customer_completed', 'priority_customer'] as const;
    const currentIndex = sounds.indexOf(currentTestSound);
    const nextIndex = (currentIndex + 1) % sounds.length;
    const nextSound = sounds[nextIndex];
    
    setCurrentTestSound(nextSound);
    
    if (nextSound === 'info') {
      notificationSound.playNotificationBeep('info');
    } else {
      notificationSound.playQueueNotification(nextSound);
    }
  };

  const getSoundLabel = (sound: typeof currentTestSound) => {
    switch (sound) {
      case 'info': return 'Test Beep';
      case 'customer_added': return 'Customer Added';
      case 'customer_serving': return 'Customer Serving';
      case 'customer_completed': return 'Customer Completed';
      case 'priority_customer': return 'Priority Customer';
      default: return 'Test';
    }
  };

  // WebSocket connection and real-time updates
  useEffect(() => {
    if (accessToken) {
      const socketConnection = io('http://localhost:5000', {
        auth: {
          token: accessToken
        }
      });

      socketConnection.on('connect', () => {
        setIsConnected(true);
        console.log('Connected to WebSocket');
        socketConnection.emit('subscribe:queue');
      });

      socketConnection.on('disconnect', () => {
        setIsConnected(false);
        console.log('Disconnected from WebSocket');
      });

      socketConnection.on('queue:update', (data) => {
        console.log('Queue update received:', data);
        
        // Always refresh the queue data for real-time updates
        fetchQueueData();

        setSnackbar({
          open: true,
          message: 'Queue updated in real-time',
          severity: 'info'
        });
      });

      socketConnection.on('error', (error) => {
        console.error('WebSocket error:', error);
        setSnackbar({
          open: true,
          message: 'WebSocket connection error',
          severity: 'error'
        });
      });

      // setSocket(socketConnection);

      return () => {
        socketConnection.disconnect();
      };
    }
  }, [accessToken, fetchQueueData]);

  // Fetch initial queue data
  useEffect(() => {
    if (accessToken) {
      fetchQueueData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const newQueueData = queueData.slice();
      const oldIndex = newQueueData.findIndex((item) => item.id === active.id);
      const newIndex = newQueueData.findIndex((item) => item.id === over.id);
      
      const reorderedQueue = arrayMove(newQueueData, oldIndex, newIndex);
      
      // Update local state immediately for better UX
      setQueueData(reorderedQueue);
      
      // Send the new order to the backend
      try {
        const customerIds = reorderedQueue.map(customer => customer.id);
        const response = await fetch('/api/queue/reorder', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ customerIds })
        });
        
        if (response.ok) {
          setSnackbar({
            open: true,
            message: 'Queue order updated successfully',
            severity: 'success'
          });
        } else {
          throw new Error('Failed to update queue order');
        }
      } catch (error) {
        console.error('Error updating queue order:', error);
        setSnackbar({
          open: true,
          message: 'Failed to update queue order',
          severity: 'error'
        });
        // Revert the local state on error
        setQueueData(queueData);
      }
    }
  };

  const handleServeCustomer = async (id: number) => {
    try {
      const response = await fetch('/api/queue/call-customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ customerId: id, counterId: 1 }) // Call specific customer
      });
      
      if (response.ok) {
        const customer = await response.json();
        
        // Refresh the queue data to get the latest state
        fetchQueueData();
        
        // Play notification sound
        if (soundsEnabled) {
          notificationSound.playQueueNotification('customer_serving');
        }
        
        setSnackbar({
          open: true,
          message: `Customer ${customer.name} is now being served`,
          severity: 'info'
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to serve customer');
      }
    } catch (error) {
      console.error('Error serving customer:', error);
      setSnackbar({
        open: true,
        message: (error as Error).message || 'Failed to serve customer',
        severity: 'error'
      });
    }
  };

  const handleCompleteService = async (id: number) => {
    try {
      const response = await fetch('/api/queue/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ customerId: id, counterId: 1 }) // Default counter ID - should be dynamic
      });
      
      if (response.ok) {
        const customer = await response.json();
        
        // Refresh the queue data to get the latest state
        fetchQueueData();

        // Play notification sound
        if (soundsEnabled) {
          notificationSound.playQueueNotification('customer_completed');
        }

        setSnackbar({
          open: true,
          message: `Service completed for ${customer.name}`,
          severity: 'success'
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to complete service');
      }
    } catch (error) {
      console.error('Error completing service:', error);
      setSnackbar({
        open: true,
        message: (error as Error).message || 'Failed to complete service',
        severity: 'error'
      });
    }
  };

  const handleProcessingStatus = async (id: number) => {
    try {
      const response = await fetch(`/api/queue/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ status: 'processing' })
      });
      
      if (response.ok) {
        const customer = await response.json();
        
        // Refresh the queue data to get the latest state
        fetchQueueData();

        setSnackbar({
          open: true,
          message: `Customer ${customer.name} is now processing`,
          severity: 'info'
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to set processing status');
      }
    } catch (error) {
      console.error('Error setting processing status:', error);
      setSnackbar({
        open: true,
        message: (error as Error).message || 'Failed to set processing status',
        severity: 'error'
      });
    }
  };

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [currentCustomer, setCurrentCustomer] = useState<any>(null);
  const [availableTemplates, setAvailableTemplates] = useState<{ value: string; label: string }[]>([]);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [customerToCancel, setCustomerToCancel] = useState<any>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetReason, setResetReason] = useState('');

  const getAvailableTemplates = (customerStatus: string, distributionMethod?: string) => {
    switch (customerStatus) {
      case 'waiting':
        return [
          { value: 'queue_position', label: 'Queue Position Update' },
          { value: 'delay_notification', label: 'Delay Notification' }
        ];
      case 'serving':
        return [
          { value: 'ready_to_serve', label: 'Ready to Serve' },
          { value: 'delay_notification', label: 'Service Delay' }
        ];
      case 'completed':
        // Different templates based on distribution method
        if (distributionMethod === 'pickup') {
          return [
            { value: 'customer_ready', label: 'Order Ready for Pickup' },
            { value: 'pickup_reminder', label: 'Pickup Reminder' }
          ];
        }
        // For delivery orders (lalamove, lbc)
        return [
          { value: 'pickup_reminder', label: 'Pickup Reminder' },
          { value: 'delivery_ready', label: 'Order Ready for Delivery' }
        ];
      default:
        return [];
    }
  };

  const handleOpenTemplateDialog = (customer: any) => {
    setCurrentCustomer(customer);
    const templates = getAvailableTemplates(customer.queue_status, customer.distribution_info);
    setAvailableTemplates(templates);
    setSelectedTemplate(''); // Reset selection
    
    // Check if no templates available (e.g., pickup customers when completed)
    if (templates.length === 0) {
      const distributionLabel = customer.distribution_info === 'pickup' ? 'Pickup' : 
                               customer.distribution_info === 'lalamove' ? 'Lalamove' : 
                               customer.distribution_info === 'lbc' ? 'LBC' : customer.distribution_info;
      setSnackbar({
        open: true,
        message: `No SMS notifications needed for ${distributionLabel} customers in ${customer.queue_status} status`,
        severity: 'info'
      });
      return;
    }
    
    setTemplateDialogOpen(true);
  };

  const getTemplateDescription = (template: string) => {
    switch (template) {
      case 'queue_position':
        return 'Notifies customer about their current position in the queue';
      case 'ready_to_serve':
        return 'Notifies customer that their service is ready/completed';
      case 'customer_ready':
        return 'Notifies pickup customers that their order is ready for collection';
      case 'delay_notification':
        return 'Informs customer about delays in service';
      case 'pickup_reminder':
        return 'Reminds customer to pick up their completed order';
      case 'delivery_ready':
        return 'Notifies customer that their order is ready for delivery';
      default:
        return '';
    }
  };

  const handleSendWithTemplate = async () => {
    if (!currentCustomer || !selectedTemplate) return;

    const { id, name, token_number, contact_number } = currentCustomer;
    await handleSendSMS(id, name, token_number, contact_number, selectedTemplate);
    setTemplateDialogOpen(false);
    setSelectedTemplate('');
  };

  const handleCancelCustomer = async (customer: any) => {
    // If called from dialog, use the current customer
    if (!customer && currentCustomer) {
      customer = currentCustomer;
    }
    
    if (!customer) return;

    try {
      const response = await fetch('/api/queue/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ customerId: customer.id, reason: cancelReason })
      });

      if (response.ok) {
        const cancelledCustomer = await response.json();

        // Refresh the queue data to get the latest state
        fetchQueueData();

        setSnackbar({
          open: true,
          message: `Customer ${cancelledCustomer.name} has been cancelled`,
          severity: 'success'
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel customer');
      }
    } catch (error) {
      console.error('Error cancelling customer:', error);
      setSnackbar({
        open: true,
        message: (error as Error).message || 'Failed to cancel customer',
        severity: 'error'
      });
    }
  };

  const handleOpenCancelDialog = (customer: any) => {
    setCurrentCustomer(customer);
    setCancelDialogOpen(true);
  };

  const handleResetQueue = async () => {
    try {
      const response = await fetch('/api/queue/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ reason: resetReason })
      });

      if (response.ok) {
        const result = await response.json();
        fetchQueueData();
        setSnackbar({
          open: true,
          message: result.message,
          severity: 'success'
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reset queue');
      }
    } catch (error) {
      console.error('Error resetting queue:', error);
      setSnackbar({
        open: true,
        message: (error as Error).message || 'Failed to reset queue',
        severity: 'error'
      });
    } finally {
      setResetDialogOpen(false);
      setResetReason('');
    }
  };

  const handleSendSMS = async (customerId: number, customerName: string, tokenNumber: number, phoneNumber: string, template: string) => {
    try {
      // Validate phone number
      if (!phoneNumber || phoneNumber.trim() === '') {
        throw new Error('Customer has no phone number');
      }
      
      // Format phone number for Philippines (ensure it starts with +63)
      let formattedPhone = phoneNumber.replace(/\D/g, ''); // Remove non-digits
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '63' + formattedPhone.substring(1);
      }
      if (!formattedPhone.startsWith('63')) {
        formattedPhone = '63' + formattedPhone;
      }
      formattedPhone = '+' + formattedPhone;
      
      console.log(`Sending SMS to ${customerName} at ${formattedPhone} using template ${template}`);
      
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ 
          customerId,
          customerName,
          tokenNumber,
          phoneNumber: formattedPhone,
          notificationType: template
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('SMS sent successfully:', result);
        setSnackbar({
          open: true,
          message: `📱 SMS sent to ${customerName} (${formattedPhone})`,
          severity: 'success'
        });
      } else {
        const errorData = await response.json();
        console.error('SMS API error:', errorData);
        throw new Error(errorData.error || errorData.details || 'Failed to send SMS');
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      setSnackbar({
        open: true,
        message: `Failed to send SMS: ${(error as Error).message}`,
        severity: 'error'
      });
    }
  };

  const waitingCustomers = queueData.filter(c => c.queue_status === 'waiting');
  const servingCustomers = queueData.filter(c => c.queue_status === 'serving');
  const processingCustomers = queueData.filter(c => c.queue_status === 'processing');
  const completedCustomers = queueData.filter(c => c.queue_status === 'completed');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <Box sx={{ p: 2 }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: { xs: 'flex-start', sm: 'center' }, 
          mb: 2,
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1
        }}>
          <Typography 
            variant="h4" 
            gutterBottom
            sx={{ 
              fontSize: { xs: '1.5rem', sm: '2.125rem' },
              fontWeight: 400,
              lineHeight: 1.235
            }}
          >
            Queue Management
          </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box 
            sx={{ 
              width: 10, 
              height: 10, 
              borderRadius: '50%', 
              backgroundColor: isConnected ? 'success.main' : 'error.main' 
            }} 
          />
          <Typography variant="caption" color={isConnected ? 'success.main' : 'error.main'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Typography>
        </Box>
      </Box>
      
      {/* Statistics Cards */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, 
        gap: 2, 
        mb: 3 
      }}>
        <Card sx={{ minWidth: 0 }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography 
                  variant="h4" 
                  color="warning.main"
                  sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}
                >
                  {waitingCustomers.length}
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  noWrap
                  sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                >
                  Waiting
                </Typography>
              </Box>
              <QueueIcon sx={{ fontSize: { xs: 32, sm: 40 }, color: 'warning.main' }} />
            </Box>
          </CardContent>
        </Card>
        
        <Card sx={{ minWidth: 0 }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography 
                  variant="h4" 
                  color="info.main"
                  sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}
                >
                  {servingCustomers.length}
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  noWrap
                  sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                >
                  Serving
                </Typography>
              </Box>
              <ServeIcon sx={{ fontSize: { xs: 32, sm: 40 }, color: 'info.main' }} />
            </Box>
          </CardContent>
        </Card>
        
        <Card sx={{ minWidth: 0 }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography 
                  variant="h4" 
                  color="secondary.main"
                  sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}
                >
                  {processingCustomers.length}
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  noWrap
                  sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                >
                  Processing
                </Typography>
              </Box>
              <QueueIcon sx={{ fontSize: { xs: 32, sm: 40 }, color: 'secondary.main' }} />
            </Box>
          </CardContent>
        </Card>
        
        <Card sx={{ minWidth: 0 }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography 
                  variant="h4" 
                  color="error.main"
                  sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}
                >
                  {queueData.filter(c => c.priority_score > 0).length}
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  noWrap
                  sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                >
                  Priority
                </Typography>
              </Box>
              <PriorityIcon sx={{ fontSize: { xs: 32, sm: 40 }, color: 'error.main' }} />
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ minWidth: 0 }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography 
                  variant="h4" 
                  color="success.main"
                  sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}
                >
                  {completedCustomers.length}
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  noWrap
                  sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                >
                  Completed
                </Typography>
              </Box>
              <CompleteIcon sx={{ fontSize: { xs: 32, sm: 40 }, color: 'success.main' }} />
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Queue Management Controls */}
      <Box sx={{ mb: 3 }}>
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          spacing={2} 
          alignItems={{ xs: 'stretch', sm: 'center' }}
        >
          <Tooltip title="Refresh Queue Data" arrow>
            <IconButton 
              onClick={() => fetchQueueData()}
              color="primary"
              sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          {/* Sound Settings */}
          <Card sx={{ 
            p: 2, 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2,
            flexDirection: { xs: 'column', sm: 'row' },
            width: { xs: '100%', sm: 'auto' }
          }}>
            <FormControlLabel
              control={
                <Switch
                  checked={soundsEnabled}
                  onChange={(e) => handleSoundToggle(e.target.checked)}
                  color="primary"
                />
              }
              label="Notification Sounds"
              sx={{ mb: { xs: 1, sm: 0 } }}
            />
            
            {soundsEnabled && (
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2,
                flexDirection: { xs: 'column', sm: 'row' },
                width: { xs: '100%', sm: 'auto' }
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: { xs: '100%', sm: 120 } }}>
                  <VolumeOffIcon fontSize="small" />
                  <Slider
                    size="small"
                    value={volume}
                    onChange={(_, value) => handleVolumeChange(value)}
                    min={0}
                    max={1}
                    step={0.1}
                    sx={{ flex: 1, minWidth: 80 }}
                  />
                  <VolumeIcon fontSize="small" />
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleTestSound}
                  sx={{ minWidth: { xs: '100%', sm: 120 } }}
                >
                  {getSoundLabel(currentTestSound)}
                </Button>
              </Box>
            )}
          </Card>
        </Stack>
      </Box>

      {/* Queue Table */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Customer Queue (Drag to reorder)
            </Typography>
            {user?.role === 'admin' && queueData.length > 0 && (
              <Button
                variant="outlined"
                color="error"
                onClick={() => setResetDialogOpen(true)}
                startIcon={<ResetIcon />}
                size="small"
              >
                Reset Queue
              </Button>
            )}
          </Box>
          
          <DndContext 
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={queueData.map(customer => customer.id)}
              strategy={verticalListSortingStrategy}
            >
              {/* Mobile View - Cards */}
              {isMobile ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {queueData.map((customer) => (
                    <SortableQueueCard 
                      key={customer.id}
                      customer={customer}
                      onServe={handleServeCustomer}
                      onComplete={handleCompleteService}
                      onProcessing={handleProcessingStatus}
                      onSendSMS={handleOpenTemplateDialog}
                      onCancel={handleOpenCancelDialog}
                    />
                  ))}
                </Box>
              ) : (
                /* Desktop View - Table */
                <TableContainer component={Paper} elevation={0}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Token #</TableCell>
                        <TableCell>Customer Name</TableCell>
                        <TableCell>OR Number</TableCell>
                        <TableCell>Priority</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Est. Time</TableCell>
                        <TableCell>Contact</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {queueData.map((customer) => (
                        <SortableTableRow 
                          key={customer.id}
                          customer={customer}
                          onServe={handleServeCustomer}
                          onComplete={handleCompleteService}
                          onProcessing={handleProcessingStatus}
                          onSendSMS={handleOpenTemplateDialog}
                          onCancel={handleOpenCancelDialog}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </SortableContext>
          </DndContext>
          
          {loading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary">
                Loading queue data...
              </Typography>
            </Box>
          ) : queueData.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <QueueIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No customers in queue
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Queue will appear here when customers are registered
              </Typography>
              {!user && (
                <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                  Please log in to view the queue
                </Typography>
              )}
            </Box>
          ) : null}
        </CardContent>
      </Card>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)}>
        <DialogTitle>Select SMS Template</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Customer: <strong>{currentCustomer?.name}</strong> | Status: <strong>{currentCustomer?.queue_status?.toUpperCase()}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Distribution Method: <strong>{currentCustomer?.distribution_info === 'pickup' ? 'Store Pickup' : currentCustomer?.distribution_info === 'lalamove' ? 'Lalamove Delivery' : currentCustomer?.distribution_info === 'lbc' ? 'LBC Delivery' : currentCustomer?.distribution_info}</strong>
          </Typography>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Template</InputLabel>
            <Select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value as string)}
            >
              {availableTemplates.map((template) => (
                <MenuItem key={template.value} value={template.value}>
                  {template.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedTemplate && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {getTemplateDescription(selectedTemplate)}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button 
            onClick={handleSendWithTemplate} 
            color="primary" 
            variant="contained"
            disabled={!selectedTemplate}
          >
            Send SMS
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel Customer Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
        <DialogTitle>Cancel Customer</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Are you sure you want to cancel this customer from the queue?
          </Typography>
          <Typography variant="body2" gutterBottom>
            Customer: <strong>{currentCustomer?.name}</strong>
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Reason for cancellation"
            fullWidth
            variant="outlined"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Enter reason for cancellation"
            multiline
            rows={3}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button 
            onClick={async () => {
              if (currentCustomer) {
                await handleCancelCustomer(currentCustomer);
                setCancelDialogOpen(false);
                setCancelReason('');
              }
            }}
            color="error" 
            variant="contained"
          >
            Cancel Customer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Queue Dialog */}
      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)}>
        <DialogTitle>Reset Queue</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Are you sure you want to reset the entire queue? This will:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 2, mt: 1 }}>
            <li>Cancel all waiting customers</li>
            <li>Mark all being served customers as completed</li>
            <li>Reset all queue counters</li>
            <li>Clear the queue completely</li>
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 2, fontWeight: 'bold' }}>
            This action cannot be undone!
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Reason for queue reset"
            fullWidth
            variant="outlined"
            value={resetReason}
            onChange={(e) => setResetReason(e.target.value)}
            placeholder="Enter reason for queue reset"
            multiline
            rows={3}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button 
            onClick={async () => {
              await handleResetQueue();
              setResetDialogOpen(false);
              setResetReason('');
            }}
            color="error" 
            variant="contained"
          >
            Reset Queue
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </div>
  );
};

export default QueueManagement;
