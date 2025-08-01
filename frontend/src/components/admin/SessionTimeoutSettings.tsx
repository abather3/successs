import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  TextField,
  FormControlLabel,
  Switch,
  Button,
  Typography,
  Alert,
  Divider,
  InputAdornment,
  CircularProgress,
  Snackbar
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Timer as TimerIcon,
  Security as SecurityIcon,
  VolumeUp as VolumeUpIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { SettingsApi, SessionTimeoutSettings } from '../../services/settingsApi';

export const SessionTimeoutSettingsComponent: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SessionTimeoutSettings>({
    accessTokenExpiry: 30,
    refreshTokenExpiry: 7,
    warningTime: 5,
    urgentWarningTime: 1,
    autoExtendOnActivity: true,
    maxSessionExtensions: 5,
    soundNotifications: true
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSettingsCallback = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await SettingsApi.getSessionTimeoutSettings();
      setSettings(data);
    } catch (err) {
      setError('Failed to load session timeout settings');
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load settings on component mount
  useEffect(() => {
    loadSettingsCallback();
  }, [loadSettingsCallback]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await SettingsApi.getSessionTimeoutSettings();
      setSettings(data);
    } catch (err) {
      setError('Failed to load session timeout settings');
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      // Validate settings
      if (settings.accessTokenExpiry < 1 || settings.accessTokenExpiry > 1440) {
        setError('Access token expiry must be between 1 and 1440 minutes');
        return;
      }
      
      if (settings.refreshTokenExpiry < 1 || settings.refreshTokenExpiry > 365) {
        setError('Refresh token expiry must be between 1 and 365 days');
        return;
      }
      
      if (settings.warningTime < 1 || settings.warningTime > 60) {
        setError('Warning time must be between 1 and 60 minutes');
        return;
      }
      
      if (settings.urgentWarningTime < 1 || settings.urgentWarningTime > 10) {
        setError('Urgent warning time must be between 1 and 10 minutes');
        return;
      }
      
      if (settings.warningTime <= settings.urgentWarningTime) {
        setError('Warning time must be greater than urgent warning time');
        return;
      }

      await SettingsApi.updateSessionTimeoutSettings(settings);
      setSuccess('Session timeout settings updated successfully');
      
      // Reload settings to ensure consistency
      await loadSettings();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : (err as any)?.response?.data?.error || 'Failed to save settings';
      setError(errorMessage);
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    loadSettings();
  };

  const handleSettingChange = (key: keyof SessionTimeoutSettings, value: string | number | boolean) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (!user || user.role !== 'admin') {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Access denied. Only administrators can access session timeout settings.
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Card>
        <CardHeader
          title={
            <Box display="flex" alignItems="center" gap={1}>
              <SecurityIcon color="primary" />
              <Typography variant="h5">Session Timeout Settings</Typography>
            </Box>
          }
          subheader="Configure session timeout behavior and security settings"
        />
        
        <CardContent>
          {loading && (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress />
            </Box>
          )}
          
          {!loading && (
            <>
              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Token Expiry Settings */}
                <Box>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <TimerIcon color="action" />
                    <Typography variant="h6">Token Expiry</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ flex: 1, minWidth: 280 }}>
                      <TextField
                        fullWidth
                        label="Access Token Expiry"
                        type="number"
                        value={settings.accessTokenExpiry}
                        onChange={(e) => handleSettingChange('accessTokenExpiry', parseInt(e.target.value))}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">minutes</InputAdornment>
                        }}
                        helperText="How long access tokens remain valid (1-1440 minutes)"
                        inputProps={{ min: 1, max: 1440 }}
                      />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 280 }}>
                      <TextField
                        fullWidth
                        label="Refresh Token Expiry"
                        type="number"
                        value={settings.refreshTokenExpiry}
                        onChange={(e) => handleSettingChange('refreshTokenExpiry', parseInt(e.target.value))}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">days</InputAdornment>
                        }}
                        helperText="How long refresh tokens remain valid (1-365 days)"
                        inputProps={{ min: 1, max: 365 }}
                      />
                    </Box>
                  </Box>
                </Box>
                
                {/* Warning Settings */}
                <Box>
                  <Divider sx={{ my: 2 }} />
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <WarningIcon color="action" />
                    <Typography variant="h6">Warning Settings</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ flex: 1, minWidth: 280 }}>
                      <TextField
                        fullWidth
                        label="Warning Time"
                        type="number"
                        value={settings.warningTime}
                        onChange={(e) => handleSettingChange('warningTime', parseInt(e.target.value))}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">minutes</InputAdornment>
                        }}
                        helperText="When to show subtle warning before expiry (1-60 minutes)"
                        inputProps={{ min: 1, max: 60 }}
                      />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 280 }}>
                      <TextField
                        fullWidth
                        label="Urgent Warning Time"
                        type="number"
                        value={settings.urgentWarningTime}
                        onChange={(e) => handleSettingChange('urgentWarningTime', parseInt(e.target.value))}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">minutes</InputAdornment>
                        }}
                        helperText="When to show urgent warning before expiry (1-10 minutes)"
                        inputProps={{ min: 1, max: 10 }}
                      />
                    </Box>
                  </Box>
                </Box>
                
                {/* Behavior Settings */}
                <Box>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" gutterBottom>Behavior Settings</Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ flex: 1, minWidth: 280 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.autoExtendOnActivity}
                            onChange={(e) => handleSettingChange('autoExtendOnActivity', e.target.checked)}
                          />
                        }
                        label="Auto-extend on Activity"
                      />
                      <Typography variant="body2" color="text.secondary">
                        Automatically extend session when user is active
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 280 }}>
                      <TextField
                        fullWidth
                        label="Max Session Extensions"
                        type="number"
                        value={settings.maxSessionExtensions}
                        onChange={(e) => handleSettingChange('maxSessionExtensions', parseInt(e.target.value))}
                        helperText="Maximum number of session extensions allowed"
                        inputProps={{ min: 1, max: 20 }}
                      />
                    </Box>
                  </Box>
                  <Box sx={{ mt: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.soundNotifications}
                          onChange={(e) => handleSettingChange('soundNotifications', e.target.checked)}
                        />
                      }
                      label={
                        <Box display="flex" alignItems="center" gap={1}>
                          <VolumeUpIcon fontSize="small" />
                          Sound Notifications
                        </Box>
                      }
                    />
                    <Typography variant="body2" color="text.secondary">
                      Enable sound alerts for session warnings
                    </Typography>
                  </Box>
                </Box>
                
                {/* Action Buttons */}
                <Box>
                  <Divider sx={{ my: 2 }} />
                  <Box display="flex" gap={2}>
                    <Button
                      variant="contained"
                      startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    
                    <Button
                      variant="outlined"
                      startIcon={<RefreshIcon />}
                      onClick={handleReset}
                      disabled={saving}
                    >
                      Reset
                    </Button>
                  </Box>
                </Box>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Success Snackbar */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SessionTimeoutSettingsComponent;
