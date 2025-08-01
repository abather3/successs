export interface MfaConfig {
    enabled: boolean;
    issuer: string;
    windowSize: number;
    backupCodesCount: number;
}
export interface TotpSetup {
    secret: string;
    qrCode: string;
    backupCodes: string[];
    otpAuthUrl: string;
}
export declare class MfaService {
    private static config;
    static enableTotp(userId: number, userEmail: string): Promise<TotpSetup>;
    static verifyTotpSetup(userId: number, token: string): Promise<boolean>;
    static verifyTotp(userId: number, token: string): Promise<boolean>;
    static verifyBackupCode(userId: number, code: string): Promise<boolean>;
    static generateNewBackupCodes(userId: number): Promise<string[]>;
    static registerWebAuthnCredential(userId: number, credentialData: {
        credentialId: string;
        publicKey: string;
        counter: number;
        aaguid: string;
        name: string;
    }): Promise<void>;
    static getWebAuthnCredentials(userId: number): Promise<Array<{
        id: number;
        credentialId: string;
        publicKey: string;
        counter: number;
        aaguid: string;
        name: string;
        lastUsed: Date | null;
    }>>;
    static updateWebAuthnCounter(credentialId: string, counter: number): Promise<void>;
    static removeWebAuthnCredential(userId: number, credentialId: string): Promise<void>;
    static getUserMfaStatus(userId: number): Promise<{
        totpEnabled: boolean;
        webAuthnEnabled: boolean;
        backupCodesRemaining: number;
        webAuthnCredentials: number;
    }>;
    static disableTotp(userId: number): Promise<void>;
    static disableAllMfa(userId: number): Promise<void>;
    static requiresMfa(userId: number): Promise<boolean>;
    private static generateBackupCodes;
    static getConfig(): MfaConfig;
    static updateConfig(newConfig: Partial<MfaConfig>): void;
}
//# sourceMappingURL=mfaService.d.ts.map