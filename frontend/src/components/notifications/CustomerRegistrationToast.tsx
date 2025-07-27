// ISOLATED: Facebook-style Customer Registration Notification Toast
// This component is completely separate from queue management notifications

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Button,
  Avatar,
  IconButton,
  Chip,
  Fade,
  Slide,
  useTheme,
  alpha
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Close as CloseIcon,
  Visibility as ViewIcon,
  CreditCard as TransactionIcon,
  PriorityHigh as PriorityIcon
} from '@mui/icons-material';

export interface CustomerRegistrationNotification {
  notification_id: string;
  type: 'customer_registration';
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
  expires_at: string;
  created_at: string;
  actions: Array<{
    action_type: string;
    label: string;
    is_primary: boolean;
  }>;
}

interface CustomerRegistrationToastProps {
  notification: CustomerRegistrationNotification;
  onAction: (actionType: string, customerId: number, notificationId: string) => void;
  onDismiss: (notificationId: string) => void;
  index: number; // For stacking animation
}

export const CustomerRegistrationToast: React.FC<CustomerRegistrationToastProps> = ({
  notification,
  onAction,
  onDismiss,
  index
}) => {
  const theme = useTheme();
  const [isVisible, setIsVisible] = useState(true);
  
  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      onDismiss(notification.notification_id);
    }, 300);
  };

  const handleAction = (actionType: string) => {
    onAction(actionType, notification.customer_data.id, notification.notification_id);
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'view_customer':
        return <ViewIcon sx={{ fontSize: 18 }} />;
      case 'start_transaction':
        return <TransactionIcon sx={{ fontSize: 18 }} />;
      default:
        return null;
    }
  };

  const getActionColor = (actionType: string, isPrimary: boolean) => {
    if (isPrimary) return 'primary';
    
    switch (actionType) {
      case 'view_customer':
        return 'info';
      case 'start_transaction':
        return 'success';
      default:
        return 'inherit';
    }
  };

  const isPriorityCustomer = notification.customer_data.priority_flags?.senior_citizen ||
                            notification.customer_data.priority_flags?.pregnant ||
                            notification.customer_data.priority_flags?.pwd;

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  };

  return (
    <Fade in={isVisible} timeout={300}>
      <Slide direction="left" in={isVisible} timeout={500}>
        <Card 
          sx={{
            position: 'fixed',
            top: 20 + (index * 10), // Stack notifications
            right: 20,
            width: 380,
            maxWidth: 'calc(100vw - 40px)',
            zIndex: 9999 - index, // Higher notifications on top
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            border: isPriorityCustomer 
              ? `2px solid ${theme.palette.error.main}`
              : `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
            borderRadius: 3,
            overflow: 'hidden',
            animation: isPriorityCustomer ? 'pulse 2s ease-in-out infinite' : 'none',
            background: isPriorityCustomer
              ? `linear-gradient(135deg, ${alpha(theme.palette.error.light, 0.05)} 0%, ${alpha(theme.palette.error.main, 0.05)} 100%)`
              : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.05)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
            '@keyframes pulse': {
              '0%': { transform: 'scale(1)' },
              '50%': { transform: 'scale(1.02)' },
              '100%': { transform: 'scale(1)' }
            }
          }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Box display="flex" alignItems="flex-start" gap={2}>
              {/* Avatar with priority indicator */}
              <Box position="relative">
                <Avatar 
                  sx={{ 
                    bgcolor: isPriorityCustomer ? 'error.main' : 'primary.main',
                    width: 48,
                    height: 48
                  }}
                >
                  <PersonAddIcon sx={{ fontSize: 28 }} />
                </Avatar>
                {isPriorityCustomer && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      width: 16,
                      height: 16,
                      bgcolor: 'warning.main',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <PriorityIcon sx={{ fontSize: 10, color: 'white' }} />
                  </Box>
                )}
              </Box>

              <Box flex={1} minWidth={0}>
                {/* Header */}
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                  <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
                    👥 New Customer Registration
                  </Typography>
                  <IconButton 
                    size="small" 
                    onClick={handleDismiss}
                    sx={{ 
                      ml: 1,
                      '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.1) }
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>

                {/* Customer Info */}
                <Box mb={2}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {notification.customer_data.name}
                  </Typography>
                  
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Typography variant="body2" color="text.secondary">
                      Token #{notification.customer_data.token_number.toString().padStart(3, '0')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      •
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {notification.customer_data.or_number}
                    </Typography>
                  </Box>

                  <Box display="flex" alignItems="center" gap={1} mb={1.5}>
                    <Chip 
                      label={notification.customer_data.priority_type}
                      size="small"
                      color={isPriorityCustomer ? 'error' : 'default'}
                      variant={isPriorityCustomer ? 'filled' : 'outlined'}
                      sx={{ 
                        height: 20,
                        fontSize: '0.7rem',
                        fontWeight: 600
                      }}
                    />
                    <Chip 
                      label={formatCurrency(notification.customer_data.payment_amount)}
                      size="small"
                      color="success"
                      variant="outlined"
                      sx={{ 
                        height: 20,
                        fontSize: '0.7rem',
                        fontWeight: 600
                      }}
                    />
                  </Box>

                  <Typography variant="body2" color="text.secondary">
                    Registered by <strong>{notification.created_by_name}</strong> ({notification.created_by_role})
                  </Typography>
                </Box>

                {/* Action Buttons */}
                <Box display="flex" gap={1} flexWrap="wrap">
                  {notification.actions
                    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
                    .map((action) => (
                    <Button
                      key={action.action_type}
                      variant={action.is_primary ? 'contained' : 'outlined'}
                      size="small"
                      startIcon={getActionIcon(action.action_type)}
                      onClick={() => handleAction(action.action_type)}
                      color={getActionColor(action.action_type, action.is_primary) as any}
                      sx={{ 
                        height: 32,
                        minWidth: 'auto',
                        fontSize: '0.75rem',
                        px: 1.5,
                        borderRadius: 2,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          transform: 'translateY(-1px)',
                          boxShadow: 2
                        }
                      }}
                    >
                      {action.label}
                    </Button>
                  ))}
                </Box>

                {/* Time indicator */}
                <Typography 
                  variant="caption" 
                  color="text.disabled" 
                  sx={{ 
                    display: 'block',
                    mt: 1.5,
                    fontSize: '0.7rem'
                  }}
                >
                  {new Date(notification.created_at).toLocaleTimeString()} • 
                  Expires {new Date(notification.expires_at).toLocaleTimeString()}
                </Typography>
              </Box>
            </Box>
          </CardContent>

          {/* Priority indicator bar */}
          {isPriorityCustomer && (
            <Box
              sx={{
                height: 4,
                background: `linear-gradient(90deg, ${theme.palette.error.main} 0%, ${theme.palette.warning.main} 100%)`,
                animation: 'shimmer 2s ease-in-out infinite alternate',
                '@keyframes shimmer': {
                  '0%': { opacity: 0.5 },
                  '100%': { opacity: 1 }
                }
              }}
            />
          )}
        </Card>
      </Slide>
    </Fade>
  );
};

export default CustomerRegistrationToast;
