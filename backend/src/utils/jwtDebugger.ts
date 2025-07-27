import jwt from 'jsonwebtoken';
import { config } from '../config/config';
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
export class JWTDebugger {
  /**
   * Decode and analyze a JWT token without verification (for debugging)
   */
  static decodeToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      return decoded;
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  }

  /**
   * Verify and decode a JWT token
   */
  static verifyToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as JWTPayload;
      return decoded;
    } catch (error) {
      console.error('Failed to verify token:', error);
      return null;
    }
  }

  /**
   * Check if a role has permission for specific actions
   */
  static checkRolePermission(userRole: UserRole, requiredRoles: UserRole[]): boolean {
    return requiredRoles.includes(userRole);
  }

  /**
   * Get role hierarchy (higher roles have more permissions)
   */
  static getRoleHierarchy(): Record<UserRole, number> {
    return {
      [UserRole.SUPER_ADMIN]: 4,
      [UserRole.ADMIN]: 3,
      [UserRole.SALES]: 2,
      [UserRole.CASHIER]: 1
    };
  }

  /**
   * Debug a failing request - logs detailed information
   */
  static debugFailingRequest(token: string, requiredRoles: UserRole[], endpoint: string) {
    console.log('\n=== RBAC Debug Information ===');
    console.log(`Endpoint: ${endpoint}`);
    console.log(`Required Roles: ${requiredRoles.join(', ')}`);
    
    if (!token) {
      console.log('❌ No token provided');
      return;
    }

    // Decode token (without verification for debug purposes)
    const decoded = this.decodeToken(token);
    if (!decoded) {
      console.log('❌ Failed to decode token');
      return;
    }

    console.log(`User ID: ${decoded.userId}`);
    console.log(`User Email: ${decoded.email}`);
    console.log(`User Role: ${decoded.role}`);
    
    if (decoded.exp) {
      const expDate = new Date(decoded.exp * 1000);
      const isExpired = Date.now() > decoded.exp * 1000;
      console.log(`Token Expiry: ${expDate.toISOString()} ${isExpired ? '(EXPIRED)' : '(VALID)'}`);
    }

    // Check role permissions
    const hasPermission = this.checkRolePermission(decoded.role, requiredRoles);
    console.log(`Permission Check: ${hasPermission ? '✅ ALLOWED' : '❌ DENIED'}`);
    
    if (!hasPermission) {
      const hierarchy = this.getRoleHierarchy();
      const userLevel = hierarchy[decoded.role] || 0;
      const requiredLevels = requiredRoles.map(role => hierarchy[role] || 0);
      const minRequiredLevel = Math.min(...requiredLevels);
      
      console.log(`User Role Level: ${userLevel}`);
      console.log(`Minimum Required Level: ${minRequiredLevel}`);
      console.log('Suggested Solutions:');
      console.log('1. Update user role in database');
      console.log('2. Update middleware to include user\'s role');
      console.log('3. Check if role is correctly included in JWT generation');
    }
    
    console.log('===============================\n');
  }

  /**
   * Generate a test token for debugging
   */
  static generateTestToken(userId: number, email: string, role: UserRole): string {
    return jwt.sign(
      { userId, email, role },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );
  }
}
