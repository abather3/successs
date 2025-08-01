export interface PasswordPolicy {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSymbols: boolean;
    preventReuse: number;
    maxAge: number;
    complexityScore: number;
}
export declare class PasswordPolicyService {
    private static policy;
    static validateComplexity(password: string): {
        valid: boolean;
        errors: string[];
    };
    static calculateComplexityScore(password: string): number;
    static checkPasswordHistory(userId: number, newPasswordHash: string): Promise<boolean>;
    static storePasswordHistory(userId: number, passwordHash: string): Promise<void>;
    static checkPasswordAge(userId: number): Promise<{
        expired: boolean;
        daysOld: number;
    }>;
    static updatePasswordTimestamp(userId: number): Promise<void>;
    static getPolicy(): PasswordPolicy;
    static updatePolicy(newPolicy: Partial<PasswordPolicy>): void;
}
//# sourceMappingURL=passwordPolicy.d.ts.map