import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

interface SessionExpiredDialogProps {
  open: boolean;
  onClose: () => void;
  onRelogin: () => void;
}

export const SessionExpiredDialog: React.FC<SessionExpiredDialogProps> = ({
  open,
  onClose,
  onRelogin,
}) => {
  const { logout } = useAuth();

  const handleRelogin = async () => {
    try {
      await logout();
      onRelogin();
    } catch (error) {
      console.error('Error during logout:', error);
      // Force redirect to login even if logout fails
      onRelogin();
    }
  };

  const handleDismiss = () => {
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        if (reason === 'backdropClick') {
          return;
        }
        handleDismiss();
      }}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          minHeight: 200,
        },
      }}
      // Prevent closing by clicking outside or pressing escape
      disableEscapeKeyDown
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" sx={{ fontSize: 28 }} />
          <Typography variant="h6" component="span" fontWeight="bold">
            Session Expired
          </Typography>
        </Box>
        <IconButton
          onClick={handleDismiss}
          size="small"
          sx={{
            color: 'text.secondary',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 2 }}>
        <Typography variant="body1" color="text.secondary" paragraph>
          Your session has expired for security reasons. Please log in again to continue using the application.
        </Typography>
        
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mt: 2,
            p: 2,
            backgroundColor: 'warning.light',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'warning.main',
          }}
        >
          <WarningIcon color="warning" fontSize="small" />
          <Typography variant="body2" color="warning.dark">
            <strong>Note:</strong> Any unsaved changes may be lost. Please save your work before proceeding.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button
          onClick={handleDismiss}
          variant="outlined"
          color="inherit"
          startIcon={<CloseIcon />}
          sx={{
            textTransform: 'none',
            fontWeight: 500,
            borderColor: 'grey.300',
            '&:hover': {
              borderColor: 'grey.400',
              backgroundColor: 'grey.50',
            },
          }}
        >
          Dismiss
        </Button>
        <Button
          onClick={handleRelogin}
          variant="contained"
          color="primary"
          startIcon={<RefreshIcon />}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            minWidth: 120,
            '&:hover': {
              backgroundColor: 'primary.dark',
            },
          }}
        >
          Re-login
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SessionExpiredDialog;
