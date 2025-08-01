import { PaymentMode, Transaction, PaymentSettlement } from '../types';
export declare class PaymentSettlementService {
    static createSettlement(transactionId: number, amount: number, paymentMode: PaymentMode, cashierId: number): Promise<{
        transaction: Transaction;
        settlements: PaymentSettlement[];
    }>;
    static getSettlements(transactionId: number): Promise<PaymentSettlement[]>;
}
//# sourceMappingURL=paymentSettlementService.d.ts.map