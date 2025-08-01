export interface JwtKeyConfig {
    algorithm: string;
    keyId: string;
    publicKey: string;
    privateKey: string;
    isActive: boolean;
    expiresAt: Date;
}
export interface JwtPayload {
    userId: number;
    email: string;
    role: string;
    iat?: number;
    exp?: number;
    jti?: string;
    kid?: string;
}
export declare class JwtService {
    private static keys;
    private static activeKeyId;
    static initialize(): Promise<void>;
    static signToken(payload: Omit<JwtPayload, 'iat' | 'exp' | 'jti' | 'kid'>, options?: {
        expiresIn?: string;
        audience?: string;
        issuer?: string;
    }): Promise<string>;
    static verifyToken(token: string): Promise<JwtPayload>;
    static revokeToken(jti: string): Promise<void>;
    static isTokenRevoked(jti: string): Promise<boolean>;
    static generateNewKeyPair(): Promise<string>;
    static rotateKeys(): Promise<void>;
    static getPublicKeys(): Promise<{
        [kid: string]: string;
    }>;
    static getActiveKeyId(): Promise<string>;
    private static loadKeysFromDatabase;
    private static storeKey;
    private static updateKeyStatus;
    private static cleanupExpiredKeys;
    static fetchKeyFromKMS(keyId: string): Promise<JwtKeyConfig | null>;
    static storeKeyInKMS(keyConfig: JwtKeyConfig): Promise<void>;
    static scheduleKeyRotation(intervalHours?: number): void;
}
//# sourceMappingURL=jwtService.d.ts.map