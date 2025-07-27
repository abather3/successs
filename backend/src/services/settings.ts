import { pool } from '../config/database';

export interface SystemSetting {
  id: number;
  key: string;
  value: string;
  description: string;
  category: string;
  data_type: 'string' | 'number' | 'boolean' | 'json';
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
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

export class SettingsService {
  /**
   * Get all system settings
   */
  static async getAllSettings(): Promise<SystemSetting[]> {
    const query = `
      SELECT * FROM system_settings 
      ORDER BY category, key
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Get settings by category
   */
  static async getSettingsByCategory(category: string): Promise<SystemSetting[]> {
    const query = `
      SELECT * FROM system_settings 
      WHERE category = $1
      ORDER BY key
    `;
    
    const result = await pool.query(query, [category]);
    return result.rows;
  }

  /**
   * Get a specific setting by key
   */
  static async getSetting(key: string): Promise<SystemSetting | null> {
    const query = `
      SELECT * FROM system_settings 
      WHERE key = $1
    `;
    
    const result = await pool.query(query, [key]);
    return result.rows[0] || null;
  }

  /**
   * Get public settings (can be accessed by non-admin users)
   */
  static async getPublicSettings(): Promise<SystemSetting[]> {
    const query = `
      SELECT * FROM system_settings 
      WHERE is_public = true
      ORDER BY category, key
    `;
    
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Update a setting
   */
  static async updateSetting(key: string, value: string): Promise<SystemSetting> {
    const query = `
      UPDATE system_settings 
      SET value = $2, updated_at = CURRENT_TIMESTAMP
      WHERE key = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [key, value]);
    if (result.rows.length === 0) {
      throw new Error(`Setting with key '${key}' not found`);
    }
    
    return result.rows[0];
  }

  /**
   * Create a new setting
   */
  static async createSetting(setting: Omit<SystemSetting, 'id' | 'created_at' | 'updated_at'>): Promise<SystemSetting> {
    const query = `
      INSERT INTO system_settings (key, value, description, category, data_type, is_public)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      setting.key,
      setting.value,
      setting.description,
      setting.category,
      setting.data_type,
      setting.is_public
    ]);
    
    return result.rows[0];
  }

  /**
   * Delete a setting
   */
  static async deleteSetting(key: string): Promise<void> {
    const query = `
      DELETE FROM system_settings 
      WHERE key = $1
    `;
    
    const result = await pool.query(query, [key]);
    if (result.rowCount === 0) {
      throw new Error(`Setting with key '${key}' not found`);
    }
  }

  /**
   * Get session timeout settings with defaults
   */
  static async getSessionTimeoutSettings(): Promise<SessionTimeoutSettings> {
    const settings = await this.getSettingsByCategory('session');
    
    const defaults: SessionTimeoutSettings = {
      accessTokenExpiry: 30, // 30 minutes
      refreshTokenExpiry: 7, // 7 days
      warningTime: 5, // 5 minutes before expiry
      urgentWarningTime: 1, // 1 minute before expiry
      autoExtendOnActivity: true,
      maxSessionExtensions: 5,
      soundNotifications: true
    };

    const result = { ...defaults };
    
    settings.forEach(setting => {
      const key = setting.key.replace('session.', '') as keyof SessionTimeoutSettings;
      if (key in result) {
        switch (setting.data_type) {
          case 'number':
            (result as any)[key] = parseInt(setting.value, 10);
            break;
          case 'boolean':
            (result as any)[key] = setting.value === 'true';
            break;
          default:
            (result as any)[key] = setting.value;
        }
      }
    });

    return result;
  }

  /**
   * Update session timeout settings
   */
  static async updateSessionTimeoutSettings(settings: Partial<SessionTimeoutSettings>): Promise<void> {
    for (const [key, value] of Object.entries(settings)) {
      const settingKey = `session.${key}`;
      try {
        await this.updateSetting(settingKey, value.toString());
      } catch (error) {
        // If setting doesn't exist, create it
        const dataType = typeof value === 'number' ? 'number' : 
                        typeof value === 'boolean' ? 'boolean' : 'string';
        
        await this.createSetting({
          key: settingKey,
          value: value.toString(),
          description: `Session timeout setting: ${key}`,
          category: 'session',
          data_type: dataType,
          is_public: true
        });
      }
    }
  }

  /**
   * Initialize default settings
   */
  static async initializeDefaultSettings(): Promise<void> {
    const defaultSettings = [
      {
        key: 'session.accessTokenExpiry',
        value: '30',
        description: 'Access token expiry time in minutes',
        category: 'session',
        data_type: 'number' as const,
        is_public: true
      },
      {
        key: 'session.refreshTokenExpiry',
        value: '7',
        description: 'Refresh token expiry time in days',
        category: 'session',
        data_type: 'number' as const,
        is_public: true
      },
      {
        key: 'session.warningTime',
        value: '5',
        description: 'Time in minutes before expiry to show warning',
        category: 'session',
        data_type: 'number' as const,
        is_public: true
      },
      {
        key: 'session.urgentWarningTime',
        value: '1',
        description: 'Time in minutes before expiry to show urgent warning',
        category: 'session',
        data_type: 'number' as const,
        is_public: true
      },
      {
        key: 'session.autoExtendOnActivity',
        value: 'true',
        description: 'Automatically extend session on user activity',
        category: 'session',
        data_type: 'boolean' as const,
        is_public: true
      },
      {
        key: 'session.maxSessionExtensions',
        value: '5',
        description: 'Maximum number of session extensions allowed',
        category: 'session',
        data_type: 'number' as const,
        is_public: true
      },
      {
        key: 'session.soundNotifications',
        value: 'true',
        description: 'Enable sound notifications for session warnings',
        category: 'session',
        data_type: 'boolean' as const,
        is_public: true
      },
      {
        key: 'app.name',
        value: 'ESCA SHOP',
        description: 'Application name',
        category: 'app',
        data_type: 'string' as const,
        is_public: true
      },
      {
        key: 'app.version',
        value: '1.0.0',
        description: 'Application version',
        category: 'app',
        data_type: 'string' as const,
        is_public: true
      },
      {
        key: 'security.passwordMinLength',
        value: '8',
        description: 'Minimum password length',
        category: 'security',
        data_type: 'number' as const,
        is_public: false
      }
    ];

    for (const setting of defaultSettings) {
      try {
        const existing = await this.getSetting(setting.key);
        if (!existing) {
          await this.createSetting(setting);
        }
      } catch (error) {
        console.error(`Failed to initialize setting ${setting.key}:`, error);
      }
    }
  }
}

export default SettingsService;
