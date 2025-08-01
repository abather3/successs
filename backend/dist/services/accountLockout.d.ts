export interface LockoutConfig {
    maxAttempts: number;
    lockoutDuration: number;
    progressiveBackoff: boolean;
    backoffMultiplier: number;
    resetTime: number;
}
export declare class AccountLockoutService {
    private static config;
    static recordFailedAttempt(email: string, ipAddress: string): Promise<void>;
    static checkAccountLockout(email: string): Promise<{
        isLocked: boolean;
        remainingTime: number;
        attemptCount: number;
        nextAttemptAllowed: Date | null;
    }>;
    static checkIpLockout(ipAddress: string): Promise<{
        isLocked: boolean;
        remainingTime: number;
        attemptCount: number;
    }>;
    static clearFailedAttempts(email: string): Promise<void>;
    static clearIpFailedAttempts(ipAddress: string): Promise<void>;
    private static calculateLockoutDuration;
    private static cleanupOldAttempts;
    static getFailedAttempts(email: string): Promise<Array<{
        ip_address: string;
        attempt_time: Date;
        user_agent?: string;
    }>>;
    static unlockAccount(email: string): Promise<void>;
    static getConfig(): LockoutConfig;
    static updateConfig(newConfig: Partial<LockoutConfig>): void;
}
//# sourceMappingURL=accountLockout.d.ts.map