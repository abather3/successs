import { User, UserRole, UserStatus } from '../types';
export declare class UserService {
    static create(userData: {
        email: string;
        fullName: string;
        role: UserRole;
    }): Promise<User>;
    static findById(id: number): Promise<User | null>;
    static findByEmail(email: string): Promise<User | null>;
    static findByEmailWithPassword(email: string): Promise<(User & {
        password_hash: string;
    }) | null>;
    static updatePassword(id: number, newPassword: string): Promise<void>;
    static update(id: number, updates: {
        full_name?: string;
        role?: UserRole;
        status?: UserStatus;
    }): Promise<User>;
    static list(filters?: {
        role?: UserRole;
        status?: UserStatus;
        excludeRole?: UserRole;
    }): Promise<User[]>;
    static validatePassword(email: string, password: string): Promise<User | null>;
    static getUserDependencies(id: number): Promise<{
        salesTransactions: number;
        cashierTransactions: number;
        canDelete: boolean;
        warnings: string[];
    }>;
    static delete(id: number): Promise<void>;
    static generateTemporaryPassword(): Promise<string>;
    static triggerPasswordReset(id: number): Promise<{
        resetToken: string;
    }>;
    static resetPasswordWithToken(token: string, newPassword: string): Promise<boolean>;
    static requestPasswordReset(email: string): Promise<boolean>;
}
//# sourceMappingURL=user.d.ts.map