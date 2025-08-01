"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSalesAgentFilter = exports.checkCustomerOwnership = exports.requireCustomerOwnership = void 0;
const types_1 = require("../types");
const customer_1 = require("../services/customer");
/**
 * Middleware to ensure sales agents can only access customers they created
 * Admins and cashiers can access all customers
 */
const requireCustomerOwnership = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        // Admin users and cashiers can access all customers
        if (user.role === types_1.UserRole.ADMIN || user.role === types_1.UserRole.CASHIER) {
            next();
            return;
        }
        // For sales agents, verify ownership
        if (user.role === types_1.UserRole.SALES) {
            const customerId = parseInt(req.params.id, 10);
            if (isNaN(customerId)) {
                res.status(400).json({ error: 'Invalid customer ID' });
                return;
            }
            const customer = await customer_1.CustomerService.findById(customerId);
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
    }
    catch (error) {
        console.error('Error in ownership middleware:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.requireCustomerOwnership = requireCustomerOwnership;
/**
 * Helper function to check if a user owns a customer record
 */
const checkCustomerOwnership = async (userId, customerId, userRole) => {
    try {
        // Admin users and cashiers can access all customers
        if (userRole === types_1.UserRole.ADMIN || userRole === types_1.UserRole.CASHIER) {
            return true;
        }
        // For sales agents, check actual ownership
        if (userRole === types_1.UserRole.SALES) {
            const customer = await customer_1.CustomerService.findById(customerId);
            return customer ? customer.sales_agent_id === userId : false;
        }
        // Other roles don't have customer ownership
        return false;
    }
    catch (error) {
        console.error('Error checking customer ownership:', error);
        return false;
    }
};
exports.checkCustomerOwnership = checkCustomerOwnership;
/**
 * Helper function to get sales agent ID for filtering
 * Returns the agent ID for sales users, undefined for admins and cashiers (no filtering)
 */
const getSalesAgentFilter = (user) => {
    if (user.role === types_1.UserRole.SALES) {
        return user.id;
    }
    return undefined; // Admin and cashiers see all customers
};
exports.getSalesAgentFilter = getSalesAgentFilter;
//# sourceMappingURL=ownership.js.map