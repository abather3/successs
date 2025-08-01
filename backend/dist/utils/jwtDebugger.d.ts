import { UserRole } from '../types';
export interface JWTPayload {
    userId: number;
    email: string;
    role: UserRole;
    iat?: number;
    exp?: number;
}
/**
 * Debug utility to analyze JWT tokens and role permissions
 */
export declare class JWTDebugger {
    /**
     * Decode and analyze a JWT token without verification (for debugging)
     */
    static decodeToken(token: string): JWTPayload | null;
    /**
     * Verify and decode a JWT token
     */
    static verifyToken(token: string): JWTPayload | null;
    /**
     * Check if a role has permission for specific actions
     */
    static checkRolePermission(userRole: UserRole, requiredRoles: UserRole[]): boolean;
    /**
     * Get role hierarchy (higher roles have more permissions)
     */
    static getRoleHierarchy(): Record<UserRole, number>;
    /**
     * Debug a failing request - logs detailed information
     */
    static debugFailingRequest(token: string, requiredRoles: UserRole[], endpoint: string): void;
    /**
     * Generate a test token for debugging
     */
    static generateTestToken(userId: number, email: string, role: UserRole): string;
}
//# sourceMappingURL=jwtDebugger.d.ts.map