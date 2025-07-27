import express, { Router, Request, Response } from 'express';
import { SettingsService } from '../services/settings';
import { requireAdmin } from '../middleware/auth';
import { ActivityService } from '../services/activity';
import { AuthRequest } from '../types';

const router: Router = express.Router();

// Get all settings (admin only)
router.get('/', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await SettingsService.getAllSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Get settings by category (admin only)
router.get('/category/:category', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category } = req.params;
    const settings = await SettingsService.getSettingsByCategory(category);
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings by category:', error);
    res.status(500).json({ error: 'Failed to fetch settings by category' });
  }
});

// Get public settings (accessible to all authenticated users)
router.get('/public', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await SettingsService.getPublicSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching public settings:', error);
    res.status(500).json({ error: 'Failed to fetch public settings' });
  }
});

// Get specific setting
router.get('/:key', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const setting = await SettingsService.getSetting(key);
    
    if (!setting) {
      res.status(404).json({ error: 'Setting not found' });
      return;
    }
    
    res.json(setting);
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

// Update setting
router.put('/:key', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      res.status(400).json({ error: 'Value is required' });
      return;
    }
    
    const setting = await SettingsService.updateSetting(key, value);
    
    // Log the activity
    await ActivityService.log({
      user_id: req.user!.id,
      action: 'setting_update',
      details: { key, value, previous_value: setting.value },
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });
    
    res.json(setting);
  } catch (error) {
    console.error('Error updating setting:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to update setting' });
    }
  }
});

// Create new setting
router.post('/', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { key, value, description, category, data_type, is_public } = req.body;
    
    if (!key || !value || !description || !category || !data_type) {
      res.status(400).json({ error: 'Key, value, description, category, and data_type are required' });
      return;
    }
    
    const setting = await SettingsService.createSetting({
      key,
      value,
      description,
      category,
      data_type,
      is_public: is_public || false
    });
    
    // Log the activity
    await ActivityService.log({
      user_id: req.user!.id,
      action: 'setting_create',
      details: { key, value, category },
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });
    
    res.status(201).json(setting);
  } catch (error) {
    console.error('Error creating setting:', error);
    res.status(500).json({ error: 'Failed to create setting' });
  }
});

// Delete setting
router.delete('/:key', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { key } = req.params;
    
    // Get the setting before deletion for logging
    const setting = await SettingsService.getSetting(key);
    
    await SettingsService.deleteSetting(key);
    
    // Log the activity
    await ActivityService.log({
      user_id: req.user!.id,
      action: 'setting_delete',
      details: { key, previous_value: setting?.value },
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });
    
    res.json({ message: 'Setting deleted successfully' });
  } catch (error) {
    console.error('Error deleting setting:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to delete setting' });
    }
  }
});

// Get session timeout settings
router.get('/session/timeout', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await SettingsService.getSessionTimeoutSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching session timeout settings:', error);
    res.status(500).json({ error: 'Failed to fetch session timeout settings' });
  }
});

// Update session timeout settings
router.put('/session/timeout', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings = req.body;
    
    // Validate the settings
    if (settings.accessTokenExpiry && (settings.accessTokenExpiry < 1 || settings.accessTokenExpiry > 1440)) {
      res.status(400).json({ error: 'Access token expiry must be between 1 and 1440 minutes' });
      return;
    }
    
    if (settings.refreshTokenExpiry && (settings.refreshTokenExpiry < 1 || settings.refreshTokenExpiry > 365)) {
      res.status(400).json({ error: 'Refresh token expiry must be between 1 and 365 days' });
      return;
    }
    
    if (settings.warningTime && (settings.warningTime < 1 || settings.warningTime > 60)) {
      res.status(400).json({ error: 'Warning time must be between 1 and 60 minutes' });
      return;
    }
    
    if (settings.urgentWarningTime && (settings.urgentWarningTime < 1 || settings.urgentWarningTime > 10)) {
      res.status(400).json({ error: 'Urgent warning time must be between 1 and 10 minutes' });
      return;
    }
    
    await SettingsService.updateSessionTimeoutSettings(settings);
    
    // Log the activity
    await ActivityService.log({
      user_id: req.user!.id,
      action: 'session_timeout_update',
      details: { settings },
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });
    
    const updatedSettings = await SettingsService.getSessionTimeoutSettings();
    res.json(updatedSettings);
  } catch (error) {
    console.error('Error updating session timeout settings:', error);
    res.status(500).json({ error: 'Failed to update session timeout settings' });
  }
});

export default router;
