export declare class SecretsManager {
    private providers;
    private cache;
    private cacheTimeout;
    private cacheTimestamps;
    constructor();
    private initializeProviders;
    initialize(): Promise<void>;
    getSecret(key: string): Promise<string | null>;
    private getCachedSecret;
    private setCachedSecret;
    getRequiredSecret(key: string): Promise<string>;
    refreshSecret(key: string): Promise<string | null>;
    clearCache(): void;
}
export declare const secretsManager: SecretsManager;
export declare function getDBConnectionString(): Promise<string>;
export declare function getJWTSecret(): Promise<string>;
export declare function getJWTRefreshSecret(): Promise<string>;
export declare function getSMSAPIKey(): Promise<string>;
export declare function getEmailPassword(): Promise<string>;
export declare function getTwilioAuthToken(): Promise<string>;
export declare function getClicksendAPIKey(): Promise<string>;
export declare function getVonageAPISecret(): Promise<string>;
export declare function getGoogleSheetsAPIKey(): Promise<string>;
//# sourceMappingURL=secretsManager.d.ts.map