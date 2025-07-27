import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Pagination,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  IconButton,
  Tabs,
  Tab
} from '@mui/material';
import {
  Edit as EditIcon,
  Refresh as RefreshIcon,
  Cached as RetryIcon,
  Message as MessageIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';

interface SMSTemplate {
  id: number;
  templateName: string;
  templateContent: string;
  variables: string[];
  isActive: boolean;
}

interface SMSNotification {
  id: number;
  customerId: number;
  phoneNumber: string;
  message: string;
  notificationType: 'queue_position' | 'ready_to_serve' | 'delay_notification';
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  deliveryStatus?: string;
  queuePosition?: number;
  estimatedWaitMinutes?: number;
  sentAt?: string;
  deliveredAt?: string;
  created_at: string;
}

interface SMSStats {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  deliveryRate: number;
  todaySent: number;
  weekSent: number;
  monthSent: number;
}

const EnhancedSMSManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [notifications, setNotifications] = useState<SMSNotification[]>([]);
  const [stats, setStats] = useState<SMSStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    template: SMSTemplate | null;
  }>({ open: false, template: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await fetch('/api/analytics/sms-templates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/analytics/sms-notifications?page=${currentPage}&limit=20`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications);
        setTotalPages(data.totalPages);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/analytics/sms-stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchStats();
    if (activeTab === 1) {
      fetchNotifications();
    }
  }, [activeTab, currentPage, fetchTemplates, fetchStats, fetchNotifications]);

  const handleEditTemplate = (template: SMSTemplate) => {
    setEditDialog({ open: true, template });
  };

  const handleSaveTemplate = async () => {
    if (!editDialog.template) return;

    try {
      const response = await fetch(`/api/analytics/sms-templates/${editDialog.template.templateName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          templateContent: editDialog.template.templateContent
        })
      });

      if (response.ok) {
        setSnackbar({
          open: true,
          message: 'Template updated successfully',
          severity: 'success'
        });
        setEditDialog({ open: false, template: null });
        fetchTemplates();
      } else {
        throw new Error('Failed to update template');
      }
    } catch (error) {
      console.error('Error updating template:', error);
      setSnackbar({
        open: true,
        message: 'Failed to update template',
        severity: 'error'
      });
    }
  };

  const handleRetryFailed = async () => {
    try {
      const response = await fetch('/api/analytics/sms-notifications/retry-failed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ maxRetries: 5 })
      });

      if (response.ok) {
        const data = await response.json();
        setSnackbar({
          open: true,
          message: data.message,
          severity: 'success'
        });
        fetchNotifications();
        fetchStats();
      } else {
        throw new Error('Failed to retry notifications');
      }
    } catch (error) {
      console.error('Error retrying notifications:', error);
      setSnackbar({
        open: true,
        message: 'Failed to retry notifications',
        severity: 'error'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'success';
      case 'sent': return 'info';
      case 'pending': return 'warning';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case 'queue_position': return 'Queue Position';
      case 'ready_to_serve': return 'Ready to Serve';
      case 'delay_notification': return 'Delay Notice';
      default: return type;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">SMS Management</Typography>
        <Box display="flex" gap={2}>
          <Button
            startIcon={<RetryIcon />}
            onClick={handleRetryFailed}
            variant="outlined"
            color="warning"
          >
            Retry Failed
          </Button>
          <Tooltip title="Refresh Data">
            <IconButton onClick={() => {
              fetchTemplates();
              fetchStats();
              if (activeTab === 1) fetchNotifications();
            }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* SMS Statistics */}
      {stats && (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 3 }}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <MessageIcon color="primary" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">{stats.totalSent}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Sent
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <TrendingUpIcon color="success" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">{stats.deliveryRate}%</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Delivery Rate
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stats.totalDelivered} delivered
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <ScheduleIcon color="info" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">{stats.todaySent}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Sent Today
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stats.weekSent} this week
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {stats.totalFailed > 0 && (
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Box>
                    <Typography variant="h4" color="error">{stats.totalFailed}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Failed
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}
        </Box>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
          <Tab label="SMS Templates" />
          <Tab label="SMS History" />
        </Tabs>
      </Box>

      {/* SMS Templates Tab */}
      {activeTab === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>SMS Templates</Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Manage SMS message templates. Use variables like [CustomerName], [QueuePosition], [EstimatedWait], [TokenNumber], and [CounterName].
            </Typography>
            
            <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
              {templates.map((template) => (
                <Card key={template.templateName} variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                      <Box>
                        <Typography variant="h6" color="primary">
                          {template.templateName.replace('_', ' ').toUpperCase()}
                        </Typography>
                        <Box display="flex" gap={1} mt={1}>
                          {template.variables.map((variable) => (
                            <Chip 
                              key={variable} 
                              label={`[${variable}]`} 
                              size="small" 
                              variant="outlined" 
                            />
                          ))}
                        </Box>
                      </Box>
                      <Button
                        startIcon={<EditIcon />}
                        onClick={() => handleEditTemplate(template)}
                        size="small"
                      >
                        Edit
                      </Button>
                    </Box>
                    <Paper sx={{ 
                      p: 2, 
                      bgcolor: (theme) => theme.palette.mode === 'dark' 
                        ? 'grey.800' 
                        : 'grey.50',
                      border: (theme) => theme.palette.mode === 'dark'
                        ? '1px solid rgba(255, 255, 255, 0.12)'
                        : '1px solid rgba(0, 0, 0, 0.12)'
                    }}>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {template.templateContent}
                      </Typography>
                    </Paper>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* SMS History Tab */}
      {activeTab === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>SMS Notification History</Typography>
            
            {loading ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <TableContainer component={Paper} elevation={0}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date/Time</TableCell>
                        <TableCell>Phone</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Message Preview</TableCell>
                        <TableCell>Queue Info</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {notifications.map((notification) => (
                        <TableRow key={notification.id} hover>
                          <TableCell>
                            <Typography variant="body2">
                              {formatDate(notification.created_at)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">
                              {notification.phoneNumber}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getNotificationTypeLabel(notification.notificationType)}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={notification.status.toUpperCase()}
                              size="small"
                              color={getStatusColor(notification.status) as any}
                            />
                          </TableCell>
                          <TableCell sx={{ maxWidth: 300 }}>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {notification.message}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {notification.queuePosition && (
                              <Typography variant="caption" color="text.secondary">
                                Pos: {notification.queuePosition}
                                {notification.estimatedWaitMinutes && (
                                  <>, Wait: {notification.estimatedWaitMinutes}m</>
                                )}
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {totalPages > 1 && (
                  <Box display="flex" justifyContent="center" mt={3}>
                    <Pagination
                      count={totalPages}
                      page={currentPage}
                      onChange={(_, page) => setCurrentPage(page)}
                      color="primary"
                    />
                  </Box>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Template Dialog */}
      <Dialog 
        open={editDialog.open} 
        onClose={() => setEditDialog({ open: false, template: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Edit SMS Template: {editDialog.template?.templateName.replace('_', ' ').toUpperCase()}
        </DialogTitle>
        <DialogContent>
          <Box mb={2}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Available variables:
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
              {editDialog.template?.variables.map((variable) => (
                <Chip 
                  key={variable} 
                  label={`[${variable}]`} 
                  size="small" 
                  variant="outlined"
                  onClick={() => {
                    if (editDialog.template) {
                      const newContent = editDialog.template.templateContent + `[${variable}]`;
                      setEditDialog({
                        ...editDialog,
                        template: {
                          ...editDialog.template,
                          templateContent: newContent
                        }
                      });
                    }
                  }}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>
          <TextField
            fullWidth
            multiline
            rows={6}
            label="Template Content"
            value={editDialog.template?.templateContent || ''}
            onChange={(e) => {
              if (editDialog.template) {
                setEditDialog({
                  ...editDialog,
                  template: {
                    ...editDialog.template,
                    templateContent: e.target.value
                  }
                });
              }
            }}
            helperText="Click on variable chips above to insert them into the template"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog({ open: false, template: null })}>
            Cancel
          </Button>
          <Button onClick={handleSaveTemplate} variant="contained">
            Save Template
          </Button>
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

export default EnhancedSMSManagement;
