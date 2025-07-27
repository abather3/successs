import { Response, NextFunction } from 'express';
import { AuthRequest, UserRole } from '../types';
import { CustomerService } from '../services/customer';

/**
 * Middleware to ensure sales agents can only access customers they created
 * Admins and cashiers can access all customers
 */
export const requireCustomerOwnership = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Admin users and cashiers can access all customers
    if (user.role === UserRole.ADMIN || user.role === UserRole.CASHIER) {
      next();
      return;
    }

    // For sales agents, verify ownership
    if (user.role === UserRole.SALES) {
      const customerId = parseInt(req.params.id, 10);
      
      if (isNaN(customerId)) {
        res.status(400).json({ error: 'Invalid customer ID' });
        return;
      }

      const customer = await CustomerService.findById(customerId);
      
      if (!customer) {
        res.status(404).json({ error: 'Customer not found' });
        return;
      }

      // Check if the sales agent owns this customer
      if (customer.sales_agent_id !== user.id) {
        res.status(403).json({ 
          error: 'Access denied. You can only access customers you created.' 
        });
        return;
      }
    }

    next();
  } catch (error) {
    console.error('Error in ownership middleware:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Helper function to check if a user owns a customer record
 */
export const checkCustomerOwnership = async (
  userId: number,
  customerId: number,
  userRole: UserRole
): Promise<boolean> => {
  try {
    // Admin users and cashiers can access all customers
    if (userRole === UserRole.ADMIN || userRole === UserRole.CASHIER) {
      return true;
    }

    // For sales agents, check actual ownership
    if (userRole === UserRole.SALES) {
      const customer = await CustomerService.findById(customerId);
      return customer ? customer.sales_agent_id === userId : false;
    }

    // Other roles don't have customer ownership
    return false;
  } catch (error) {
    console.error('Error checking customer ownership:', error);
    return false;
  }
};

/**
 * Helper function to get sales agent ID for filtering
 * Returns the agent ID for sales users, undefined for admins and cashiers (no filtering)
 */
export const getSalesAgentFilter = (user: { id: number; role: UserRole }): number | undefined => {
  if (user.role === UserRole.SALES) {
    return user.id;
  }
  return undefined; // Admin and cashiers see all customers
};
