import { Router } from 'express';
import { CustomerNotificationData } from '../services/CustomerNotificationService';
declare const router: Router;
/**
 * INTERNAL: Trigger customer registration notification (called by customer creation)
 * This would be called from the customer service when a new customer is created
 * ISOLATED: Does not interfere with queue management
 */
export declare function triggerCustomerRegistrationNotification(customerData: CustomerNotificationData): Promise<void>;
export default router;
//# sourceMappingURL=customerNotifications.d.ts.map