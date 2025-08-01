import { Response, NextFunction } from 'express';
import { AuthRequest, UserRole } from '../types';
/**
 * Middleware to ensure sales agents can only access customers they created
 * Admins and cashiers can access all customers
 */
export declare const requireCustomerOwnership: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * Helper function to check if a user owns a customer record
 */
export declare const checkCustomerOwnership: (userId: number, customerId: number, userRole: UserRole) => Promise<boolean>;
/**
 * Helper function to get sales agent ID for filtering
 * Returns the agent ID for sales users, undefined for admins and cashiers (no filtering)
 */
export declare const getSalesAgentFilter: (user: {
    id: number;
    role: UserRole;
}) => number | undefined;
//# sourceMappingURL=ownership.d.ts.map