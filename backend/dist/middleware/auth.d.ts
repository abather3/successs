import { Response, NextFunction } from 'express';
import { AuthRequest, UserRole } from '../types';
export declare const authenticateToken: (req: import("express").Request, res: Response, next: NextFunction) => void;
export declare const requireRole: (roles: UserRole[], resourceName?: string) => (req: import("express").Request, res: Response, next: NextFunction) => void;
export declare const requireAdmin: (req: import("express").Request, res: Response, next: NextFunction) => void;
export declare const requireSalesOrAdmin: (req: import("express").Request, res: Response, next: NextFunction) => void;
export declare const requireCashierOrAdmin: (req: import("express").Request, res: Response, next: NextFunction) => void;
export declare const requireSuperAdmin: (req: import("express").Request, res: Response, next: NextFunction) => void;
export declare const requireProcessingView: (req: import("express").Request, res: Response, next: NextFunction) => void;
export declare const requireServeToProcessing: (req: import("express").Request, res: Response, next: NextFunction) => void;
export declare const requireForcedTransitions: (req: import("express").Request, res: Response, next: NextFunction) => void;
export declare const logActivity: (action: string) => (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map