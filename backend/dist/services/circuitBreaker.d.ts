export declare enum CircuitState {
    CLOSED = "CLOSED",// Normal operation
    OPEN = "OPEN",// Circuit is open, failing fast
    HALF_OPEN = "HALF_OPEN"
}
interface CircuitBreakerOptions {
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
    resetTimeout: number;
    onStateChange?: (state: CircuitState) => void;
}
interface CircuitBreakerStats {
    state: CircuitState;
    failures: number;
    successes: number;
    nextAttempt: number;
    totalCalls: number;
    totalFailures: number;
    totalSuccesses: number;
}
export declare class CircuitBreaker {
    private options;
    private state;
    private failures;
    private successes;
    private nextAttempt;
    private totalCalls;
    private totalFailures;
    private totalSuccesses;
    constructor(options: CircuitBreakerOptions);
    execute<T>(operation: () => Promise<T>): Promise<T>;
    private onSuccess;
    private onFailure;
    private onStateChange;
    isOpen(): boolean;
    isClosed(): boolean;
    isHalfOpen(): boolean;
    getStats(): CircuitBreakerStats;
    reset(): void;
    forceOpen(): void;
    getHealth(): {
        state: CircuitState;
        healthy: boolean;
        successRate: number;
        totalCalls: number;
        recentFailures: number;
        nextAttemptIn: number;
    };
}
export {};
//# sourceMappingURL=circuitBreaker.d.ts.map