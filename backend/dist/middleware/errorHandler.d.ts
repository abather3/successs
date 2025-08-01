import { Request, Response, NextFunction } from 'express';
export declare class AuthError extends Error {
    code: string;
    statusCode: number;
    userMessage: string;
    constructor(code: string, message: string, userMessage: string, statusCode?: number);
}
export declare const AuthErrors: {
    TOKEN_MISSING: AuthError;
    TOKEN_EXPIRED: AuthError;
    TOKEN_INVALID: AuthError;
    TOKEN_MALFORMED: AuthError;
    USER_NOT_FOUND: AuthError;
    USER_INACTIVE: AuthError;
    INSUFFICIENT_PERMISSIONS: AuthError;
    INVALID_CREDENTIALS: AuthError;
    ACCOUNT_LOCKED: AuthError;
    REFRESH_TOKEN_MISSING: AuthError;
    REFRESH_TOKEN_INVALID: AuthError;
    REFRESH_TOKEN_EXPIRED: AuthError;
};
export declare const createAuthError: (errorType: AuthError) => AuthError;
export declare const getJwtErrorType: (error: any) => AuthError;
export declare const errorHandler: (error: Error | AuthError, req: Request, res: Response, next: NextFunction) => void;
export declare const asyncErrorHandler: (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => void;
export declare const throwAuthError: (errorType: AuthError) => never;
//# sourceMappingURL=errorHandler.d.ts.map