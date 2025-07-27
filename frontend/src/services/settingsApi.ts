import api from './authService';

export interface SystemSetting {
  id: number;
  key: string;
  value: string;
  description: string;
  category: string;
  data_type: 'string' | 'number' | 'boolean' | 'json';
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface SessionTimeoutSettings {
  accessTokenExpiry: number; // in minutes
  refreshTokenExpiry: number; // in days
  warningTime: number; // in minutes before expiry to show warning
  urgentWarningTime: number; // in minutes before expiry to show urgent warning
  autoExtendOnActivity: boolean;
  maxSessionExtensions: number;
  soundNotifications: boolean;
}

export class SettingsApi {
  /**
   * Get all system settings (admin only)
   */
  static async getAllSettings(): Promise<SystemSetting[]> {
    const response = await api.get('/settings');
    return response.data;
  }

  /**
   * Get settings by category (admin only)
   */
  static async getSettingsByCategory(category: string): Promise<SystemSetting[]> {
    const response = await api.get(`/settings/category/${category}`);
    return response.data;
  }

  /**
   * Get public settings (accessible to all authenticated users)
   */
  static async getPublicSettings(): Promise<SystemSetting[]> {
    const response = await api.get('/settings/public');
    return response.data;
  }

  /**
   * Get a specific setting by key
   */
  static async getSetting(key: string): Promise<SystemSetting> {
    const response = await api.get(`/settings/${key}`);
    return response.data;
  }

  /**
   * Update a setting
   */
  static async updateSetting(key: string, value: string): Promise<SystemSetting> {
    const response = await api.put(`/settings/${key}`, { value });
    return response.data;
  }

  /**
   * Create a new setting
   */
  static async createSetting(setting: Omit<SystemSetting, 'id' | 'created_at' | 'updated_at'>): Promise<SystemSetting> {
    const response = await api.post('/settings', setting);
    return response.data;
  }

  /**
   * Delete a setting
   */
  static async deleteSetting(key: string): Promise<void> {
    await api.delete(`/settings/${key}`);
  }

  /**
   * Get session timeout settings
   */
  static async getSessionTimeoutSettings(): Promise<SessionTimeoutSettings> {
    const response = await api.get('/settings/session/timeout');
    return response.data;
  }

  /**
   * Update session timeout settings
   */
  static async updateSessionTimeoutSettings(settings: Partial<SessionTimeoutSettings>): Promise<SessionTimeoutSettings> {
    const response = await api.put('/settings/session/timeout', settings);
    return response.data;
  }
}

export default SettingsApi;
