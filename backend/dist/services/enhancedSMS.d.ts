import { CircuitState } from './circuitBreaker';
interface SMSNotification {
    id: string;
    phoneNumber: string;
    message: string;
    provider?: string;
    attempts: number;
    maxAttempts: number;
    status: 'pending' | 'sent' | 'failed' | 'cancelled';
    createdAt: Date;
    sentAt?: Date;
    error?: string;
}
interface SMSStats {
    provider: string;
    totalSent: number;
    totalFailed: number;
    successRate: number;
    averageResponseTime: number;
    circuitState: CircuitState;
    isHealthy: boolean;
}
export declare class EnhancedSMSService {
    private providers;
    private circuitBreakers;
    private stats;
    private fallbackQueue;
    private retryInterval?;
    constructor();
    private setupProviders;
    private setupCircuitBreakers;
    sendSMS(notification: SMSNotification): Promise<boolean>;
    private sendWithProvider;
    private getHealthyProviders;
    private updateProviderStats;
    private addToFallbackQueue;
    private startRetryProcessor;
    private processFallbackQueue;
    private sendViaVonage;
    private sendViaTwilio;
    private sendViaClickSend;
    getProviderStats(): SMSStats[];
    getSystemHealth(): {
        totalProviders: number;
        healthyProviders: number;
        fallbackQueueSize: number;
        overallHealthy: boolean;
        providers: SMSStats[];
    };
    resetProvider(providerName: string): void;
    disableProvider(providerName: string): void;
    destroy(): void;
}
export declare function createSMSNotification(phoneNumber: string, message: string, maxAttempts?: number): SMSNotification;
export {};
//# sourceMappingURL=enhancedSMS.d.ts.map