import React from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';

interface RegistrationNotificationProps {
  open: boolean;
  onClose: () => void;
  message: string;
  severity: AlertColor;
}

const RegistrationNotification: React.FC<RegistrationNotificationProps> = ({ open, onClose, message, severity }) => {
  return (
    <Snackbar open={open} autoHideDuration={6000} onClose={onClose}>
      <Alert onClose={onClose} severity={severity} sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  );
};

export default RegistrationNotification;
