import { Server, Socket } from 'socket.io';
import { User } from '../types';
interface AuthenticatedSocket extends Socket {
    user?: User;
}
export declare const setupWebSocketHandlers: (io: Server) => void;
export declare class WebSocketService {
    private static io;
    static setIO(io: Server): void;
    static emitAuthError(socket: AuthenticatedSocket, code: string, message: string): void;
    static emitAuthExpirationWarning(socket: AuthenticatedSocket, remainingSeconds: number): void;
    static emitQueueUpdate(data: any): Promise<void>;
    static emitQueueStatusChanged(id: number, newStatus: string, additionalData?: any): void;
    static emitTransactionUpdate(data: any, traceId?: string): void;
    static emitSettlementCreated(data: {
        transaction_id: number;
        settlement: any;
        transaction: any;
    }): void;
    static emitNotification(userId: number, notification: any): void;
    static emitBroadcast(message: any): void;
    static broadcastToAll(event: string, data: any): void;
    static emitToRole(role: string, event: string, data: any): void;
    static emitPaymentStatusUpdate(data: {
        transactionId: number;
        payment_status: string;
        balance_amount: number;
        paid_amount: number;
        customer_id?: number;
        or_number?: string;
        updatedBy?: string;
    }, traceId?: string): void;
    static emitCustomerCreated(data: {
        customer: any;
        created_by: number;
        has_initial_transaction: boolean;
        timestamp: Date;
    }): void;
    static emitCashierNotification(data: {
        type: string;
        customer_id: number;
        customer_name: string;
        or_number: string;
        token_number: number;
        message: string;
        priority: 'high' | 'normal';
        created_by: number;
        created_by_name: string;
        timestamp: Date;
        metadata?: any;
    }): void;
    static emitCustomerRegistrationNotification(data: {
        customer: any;
        created_by: number;
        created_by_name: string;
        location_id?: number;
    }): void;
    static emitCustomerRegistrationNotificationIsolated(notification: any): void;
    static emitNotificationStatsUpdate(targetRole?: string): Promise<void>;
    static emitNotificationStatsUpdateForAllRoles(): Promise<void>;
}
export {};
//# sourceMappingURL=websocket.d.ts.map