export interface RollbackTrigger {
    name: string;
    threshold: number;
    windowMinutes: number;
    enabled: boolean;
}
export interface RollbackConfig {
    version: string;
    deploymentTime: Date;
    rollbackCommand: string;
    healthCheckUrl: string;
    triggers: RollbackTrigger[];
}
export declare class EnhancedRollbackSystem {
    private static instance;
    private currentConfig?;
    private isRollbackInProgress;
    private rollbackHistory;
    private constructor();
    static getInstance(): EnhancedRollbackSystem;
    private initializeDefaultTriggers;
    checkRollbackTriggers(): Promise<void>;
    private evaluateTrigger;
    private initiateRollback;
    private executePreRollbackHooks;
    private executeRollback;
    private executePostRollbackHooks;
    private performHealthCheck;
    private saveApplicationState;
    private notifyExternalSystems;
    private drainTraffic;
    private restoreTraffic;
    private clearCaches;
    private alertRollbackFailure;
    private wait;
    updateConfig(config: Partial<RollbackConfig>): void;
    getRollbackHistory(): typeof this.rollbackHistory;
    getStatus(): {
        isRollbackInProgress: boolean;
        currentVersion: string | undefined;
        lastRollback: {
            timestamp: Date;
            reason: string;
            success: boolean;
            version?: string;
        } | null;
        triggers: RollbackTrigger[];
    };
    manualRollback(reason: string): Promise<boolean>;
}
export declare const enhancedRollbackSystem: EnhancedRollbackSystem;
//# sourceMappingURL=enhancedRollback.d.ts.map