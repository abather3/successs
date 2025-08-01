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
    accessTokenExpiry: number;
    refreshTokenExpiry: number;
    warningTime: number;
    urgentWarningTime: number;
    autoExtendOnActivity: boolean;
    maxSessionExtensions: number;
    soundNotifications: boolean;
}
export declare class SettingsService {
    /**
     * Get all system settings
     */
    static getAllSettings(): Promise<SystemSetting[]>;
    /**
     * Get settings by category
     */
    static getSettingsByCategory(category: string): Promise<SystemSetting[]>;
    /**
     * Get a specific setting by key
     */
    static getSetting(key: string): Promise<SystemSetting | null>;
    /**
     * Get public settings (can be accessed by non-admin users)
     */
    static getPublicSettings(): Promise<SystemSetting[]>;
    /**
     * Update a setting
     */
    static updateSetting(key: string, value: string): Promise<SystemSetting>;
    /**
     * Create a new setting
     */
    static createSetting(setting: Omit<SystemSetting, 'id' | 'created_at' | 'updated_at'>): Promise<SystemSetting>;
    /**
     * Delete a setting
     */
    static deleteSetting(key: string): Promise<void>;
    /**
     * Get session timeout settings with defaults
     */
    static getSessionTimeoutSettings(): Promise<SessionTimeoutSettings>;
    /**
     * Update session timeout settings
     */
    static updateSessionTimeoutSettings(settings: Partial<SessionTimeoutSettings>): Promise<void>;
    /**
     * Initialize default settings
     */
    static initializeDefaultSettings(): Promise<void>;
}
export default SettingsService;
//# sourceMappingURL=settings.d.ts.map