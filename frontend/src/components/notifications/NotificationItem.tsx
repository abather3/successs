import React from 'react';
import {
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Box,
  Typography,
  Chip,
  IconButton
} from '@mui/material';
import {
  Person as PersonIcon,
  Star as StarIcon,
  AccessTime as TimeIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { CustomerRegistrationNotification } from './CustomerRegistrationToast';

interface NotificationItemProps {
  notification: CustomerRegistrationNotification;
  onClick: () => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onClick
}) => {
  const { customer_data, created_at } = notification;

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const notificationTime = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - notificationTime.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  // Get priority color
  const getPriorityColor = (priorityType: string) => {
    switch (priorityType?.toLowerCase()) {
      case 'priority':
      case 'senior citizen':
      case 'pwd':
        return 'error';
      case 'regular':
        return 'default';
      default:
        return 'default';
    }
  };

  // Get customer initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <ListItem
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        px: 2,
        py: 1.5,
        transition: 'all 0.2s ease',
        '&:hover': {
          backgroundColor: 'rgba(25, 118, 210, 0.04)',
          '& .notification-close': {
            opacity: 1
          }
        },
        '&:active': {
          backgroundColor: 'rgba(25, 118, 210, 0.08)'
        }
      }}
    >
      <ListItemAvatar>
        <Box sx={{ position: 'relative' }}>
          <Avatar
            sx={{
              width: 40,
              height: 40,
              backgroundColor: 'primary.main',
              fontSize: '0.875rem',
              fontWeight: 600
            }}
          >
            {getInitials(customer_data.name)}
          </Avatar>
          
          {/* Priority indicator */}
          {customer_data.priority_type !== 'Regular Customer' && (
            <Box
              sx={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 16,
                height: 16,
                borderRadius: '50%',
                backgroundColor: 'error.main',
                border: '2px solid white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <StarIcon sx={{ fontSize: 8, color: 'white' }} />
            </Box>
          )}
        </Box>
      </ListItemAvatar>

      <ListItemText
        sx={{ pr: 1 }}
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                color: 'text.primary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1
              }}
            >
              {customer_data.name}
            </Typography>
            <Chip
              size="small"
              label={customer_data.priority_type}
              color={getPriorityColor(customer_data.priority_type) as any}
              sx={{
                height: 20,
                fontSize: '0.675rem',
                fontWeight: 500,
                '& .MuiChip-label': {
                  px: 1
                }
              }}
            />
          </Box>
        }
        secondary={
          <Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontSize: '0.8rem',
                mb: 0.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              New customer registration
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <TimeIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{ fontSize: '0.7rem' }}
                >
                  {formatTimeAgo(created_at)}
                </Typography>
              </Box>
              
              {customer_data.or_number && (
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.7rem',
                    color: 'primary.main',
                    fontWeight: 500,
                    backgroundColor: 'primary.50',
                    px: 0.5,
                    py: 0.25,
                    borderRadius: 0.5
                  }}
                >
                  #{customer_data.or_number}
                </Typography>
              )}
            </Box>
          </Box>
        }
      />

      {/* New notification indicator */}
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: 'primary.main',
          flexShrink: 0,
          ml: 1
        }}
      />
    </ListItem>
  );
};

export default NotificationItem;
