import React from 'react';
import { Button, Box, Typography, Card, CardContent } from '@mui/material';
import { useNotification } from '../../contexts/NotificationContext';

export const NotificationExample: React.FC = () => {
  const { notify, info, warn, error, success } = useNotification();

  const handleShowInfo = () => {
    info('This is an info notification');
  };

  const handleShowWarning = () => {
    warn('This is a warning notification');
  };

  const handleShowError = () => {
    error('This is an error notification');
  };

  const handleShowSuccess = () => {
    success('Operation completed successfully!');
  };

  const handleShowCustom = () => {
    notify('Custom notification with long duration', 'info', 10000);
  };

  return (
    <Card sx={{ maxWidth: 400, margin: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Notification System Demo
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Test the global notification system with different types of messages:
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button variant="outlined" color="info" onClick={handleShowInfo}>
            Show Info
          </Button>
          <Button variant="outlined" color="warning" onClick={handleShowWarning}>
            Show Warning
          </Button>
          <Button variant="outlined" color="error" onClick={handleShowError}>
            Show Error
          </Button>
          <Button variant="outlined" color="success" onClick={handleShowSuccess}>
            Show Success
          </Button>
          <Button variant="outlined" color="primary" onClick={handleShowCustom}>
            Show Custom (10s)
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default NotificationExample;
