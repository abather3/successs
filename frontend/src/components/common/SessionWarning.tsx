import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Snackbar,
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Collapse
} from '@mui/material';
import {
  Warning as WarningIcon,
  Close as CloseIcon,
  Schedule as ScheduleIcon,
  ExitToApp as LogoutIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

interface SessionWarningProps {
  warningStage: 'none' | 'subtle' | 'urgent';
  timeRemaining: number; // in seconds
  onExtend: () => void;
  onLogout: () => void;
  onDismiss: () => void;
}

export const SessionWarning: React.FC<SessionWarningProps> = ({
  warningStage,
  timeRemaining,
  onExtend,
  onLogout,
  onDismiss
}) => {
  const [isExtending, setIsExtending] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);

  useEffect(() => {
    if (warningStage === 'subtle') {
      setShowSnackbar(true);
    }
  }, [warningStage]);

  const handleExtend = async () => {
    setIsExtending(true);
    try {
      await onExtend();
      setShowSnackbar(false);
    } catch (error) {
      console.error('Failed to extend session:', error);
    } finally {
      setIsExtending(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  // Subtle warning - Snackbar notification
  const renderSubtleWarning = () => (
    <Snackbar
      open={showSnackbar && warningStage === 'subtle'}
      autoHideDuration={10000}
      onClose={() => setShowSnackbar(false)}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <Alert
        severity="warning"
        variant="filled"
        sx={{
          width: '100%',
          '& .MuiAlert-action': {
            alignItems: 'center',
            gap: 1
          }
        }}
        action={
          <Box display="flex" gap={1}>
            <Button
              color="inherit"
              size="small"
              onClick={handleExtend}
              disabled={isExtending}
              startIcon={isExtending ? <CircularProgress size={14} /> : <RefreshIcon />}
            >
              {isExtending ? 'Extending...' : 'Extend'}
            </Button>
            <IconButton
              size="small"
              color="inherit"
              onClick={onDismiss}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        }
      >
        <Box display="flex" alignItems="center" gap={1}>
          <ScheduleIcon fontSize="small" />
          <Typography variant="body2">
            Session expires in {formatTime(timeRemaining)}
          </Typography>
        </Box>
      </Alert>
    </Snackbar>
  );

  // Urgent warning - Modal dialog
  const renderUrgentWarning = () => (
    <Dialog
      open={warningStage === 'urgent'}
      disableEscapeKeyDown
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: 24
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        color: 'warning.main',
        backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'warning.dark' : 'warning.light'
      }}>
        <WarningIcon />
        <Typography variant="h6" component="div">
          Session Expiring Soon
        </Typography>
      </DialogTitle>
      
      <DialogContent sx={{ pt: 3 }}>
        <Box textAlign="center" mb={2}>
          <Typography variant="body1" color="text.primary" gutterBottom>
            Your session will expire in:
          </Typography>
          
          <Box 
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 1,
              borderRadius: 1,
              backgroundColor: 'error.light',
              color: 'error.contrastText',
              fontWeight: 'bold',
              fontSize: '1.2rem'
            }}
          >
            <ScheduleIcon />
            {formatTime(timeRemaining)}
          </Box>
        </Box>
        
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Choose an option to continue or you'll be automatically logged out.
        </Typography>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button
          onClick={onLogout}
          variant="outlined"
          color="error"
          startIcon={<LogoutIcon />}
          sx={{ minWidth: 120 }}
        >
          Logout
        </Button>
        
        <Button
          onClick={handleExtend}
          variant="contained"
          color="primary"
          disabled={isExtending}
          startIcon={isExtending ? <CircularProgress size={16} /> : <RefreshIcon />}
          sx={{ minWidth: 120 }}
        >
          {isExtending ? 'Extending...' : 'Extend Session'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <>
      {renderSubtleWarning()}
      {renderUrgentWarning()}
    </>
  );
};

export default SessionWarning;
