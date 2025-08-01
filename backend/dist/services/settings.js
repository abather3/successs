"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
const database_1 = require("../config/database");
class SettingsService {
    /**
     * Get all system settings
     */
    static async getAllSettings() {
        const query = `
      SELECT * FROM system_settings 
      ORDER BY category, key
    `;
        const result = await database_1.pool.query(query);
        return result.rows;
    }
    /**
     * Get settings by category
     */
    static async getSettingsByCategory(category) {
        const query = `
      SELECT * FROM system_settings 
      WHERE category = $1
      ORDER BY key
    `;
        const result = await database_1.pool.query(query, [category]);
        return result.rows;
    }
    /**
     * Get a specific setting by key
     */
    static async getSetting(key) {
        const query = `
      SELECT * FROM system_settings 
      WHERE key = $1
    `;
        const result = await database_1.pool.query(query, [key]);
        return result.rows[0] || null;
    }
    /**
     * Get public settings (can be accessed by non-admin users)
     */
    static async getPublicSettings() {
        const query = `
      SELECT * FROM system_settings 
      WHERE is_public = true
      ORDER BY category, key
    `;
        const result = await database_1.pool.query(query);
        return result.rows;
    }
    /**
     * Update a setting
     */
    static async updateSetting(key, value) {
        const query = `
      UPDATE system_settings 
      SET value = $2, updated_at = CURRENT_TIMESTAMP
      WHERE key = $1
      RETURNING *
    `;
        const result = await database_1.pool.query(query, [key, value]);
        if (result.rows.length === 0) {
            throw new Error(`Setting with key '${key}' not found`);
        }
        return result.rows[0];
    }
    /**
     * Create a new setting
     */
    static async createSetting(setting) {
        const query = `
      INSERT INTO system_settings (key, value, description, category, data_type, is_public)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
        const result = await database_1.pool.query(query, [
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
    static async deleteSetting(key) {
        const query = `
      DELETE FROM system_settings 
      WHERE key = $1
    `;
        const result = await database_1.pool.query(query, [key]);
        if (result.rowCount === 0) {
            throw new Error(`Setting with key '${key}' not found`);
        }
    }
    /**
     * Get session timeout settings with defaults
     */
    static async getSessionTimeoutSettings() {
        const settings = await this.getSettingsByCategory('session');
        const defaults = {
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
            const key = setting.key.replace('session.', '');
            if (key in result) {
                switch (setting.data_type) {
                    case 'number':
                        result[key] = parseInt(setting.value, 10);
                        break;
                    case 'boolean':
                        result[key] = setting.value === 'true';
                        break;
                    default:
                        result[key] = setting.value;
                }
            }
        });
        return result;
    }
    /**
     * Update session timeout settings
     */
    static async updateSessionTimeoutSettings(settings) {
        for (const [key, value] of Object.entries(settings)) {
            const settingKey = `session.${key}`;
            try {
                await this.updateSetting(settingKey, value.toString());
            }
            catch (error) {
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
    static async initializeDefaultSettings() {
        const defaultSettings = [
            {
                key: 'session.accessTokenExpiry',
                value: '30',
                description: 'Access token expiry time in minutes',
                category: 'session',
                data_type: 'number',
                is_public: true
            },
            {
                key: 'session.refreshTokenExpiry',
                value: '7',
                description: 'Refresh token expiry time in days',
                category: 'session',
                data_type: 'number',
                is_public: true
            },
            {
                key: 'session.warningTime',
                value: '5',
                description: 'Time in minutes before expiry to show warning',
                category: 'session',
                data_type: 'number',
                is_public: true
            },
            {
                key: 'session.urgentWarningTime',
                value: '1',
                description: 'Time in minutes before expiry to show urgent warning',
                category: 'session',
                data_type: 'number',
                is_public: true
            },
            {
                key: 'session.autoExtendOnActivity',
                value: 'true',
                description: 'Automatically extend session on user activity',
                category: 'session',
                data_type: 'boolean',
                is_public: true
            },
            {
                key: 'session.maxSessionExtensions',
                value: '5',
                description: 'Maximum number of session extensions allowed',
                category: 'session',
                data_type: 'number',
                is_public: true
            },
            {
                key: 'session.soundNotifications',
                value: 'true',
                description: 'Enable sound notifications for session warnings',
                category: 'session',
                data_type: 'boolean',
                is_public: true
            },
            {
                key: 'app.name',
                value: 'ESCA SHOP',
                description: 'Application name',
                category: 'app',
                data_type: 'string',
                is_public: true
            },
            {
                key: 'app.version',
                value: '1.0.0',
                description: 'Application version',
                category: 'app',
                data_type: 'string',
                is_public: true
            },
            {
                key: 'security.passwordMinLength',
                value: '8',
                description: 'Minimum password length',
                category: 'security',
                data_type: 'number',
                is_public: false
            }
        ];
        for (const setting of defaultSettings) {
            try {
                const existing = await this.getSetting(setting.key);
                if (!existing) {
                    await this.createSetting(setting);
                }
            }
            catch (error) {
                console.error(`Failed to initialize setting ${setting.key}:`, error);
            }
        }
    }
}
exports.SettingsService = SettingsService;
exports.default = SettingsService;
//# sourceMappingURL=settings.js.map