import React from 'react';
import {
  Box,
  List,
  Typography,
  Divider,
  Button
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { NotificationItem } from './NotificationItem';
import { CustomerRegistrationNotification } from './CustomerRegistrationToast';

interface NotificationDropdownProps {
  notifications: CustomerRegistrationNotification[];
  onNotificationClick: (notificationId: string, customerId: number) => void;
  onClose: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  notifications,
  onNotificationClick,
  onClose
}) => {
  if (notifications.length === 0) {
    return (
      <Box 
        sx={{ 
          p: 4, 
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2
        }}
      >
        <PersonAddIcon 
          sx={{ 
            fontSize: 48, 
            color: 'text.disabled',
            opacity: 0.5
          }} 
        />
        <Typography 
          variant="body2" 
          color="text.secondary"
          sx={{ fontWeight: 500 }}
        >
          No new notifications
        </Typography>
        <Typography 
          variant="caption" 
          color="text.disabled"
          sx={{ maxWidth: 250, lineHeight: 1.4 }}
        >
          You'll see customer registration notifications here when new customers are added to the system.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxHeight: 400, overflow: 'hidden' }}>
      <List 
        sx={{ 
          p: 0,
          maxHeight: 400,
          overflow: 'auto',
          '&::-webkit-scrollbar': {
            width: '6px'
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent'
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.2)',
            borderRadius: '3px'
          }
        }}
      >
        {notifications.map((notification, index) => (
          <React.Fragment key={notification.notification_id}>
            <NotificationItem
              notification={notification}
              onClick={() => onNotificationClick(
                notification.notification_id,
                notification.customer_data.id
              )}
            />
            {index < notifications.length - 1 && (
              <Divider sx={{ borderColor: 'rgba(0,0,0,0.06)' }} />
            )}
          </React.Fragment>
        ))}
      </List>

      {/* Footer with view all option */}
      {notifications.length >= 10 && (
        <>
          <Divider />
          <Box sx={{ p: 1, textAlign: 'center' }}>
            <Button
              fullWidth
              size="small"
              sx={{
                textTransform: 'none',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'primary.main',
                py: 1.5,
                '&:hover': {
                  backgroundColor: 'primary.50'
                }
              }}
              onClick={() => {
                // Navigate to notifications page or customer list
                window.location.href = '/customers';
                onClose();
              }}
            >
              View All Customers
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
};

export default NotificationDropdown;
