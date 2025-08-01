"use strict";
// Zero-Cost Circuit Breaker Implementation
// Simple circuit breaker using native JavaScript (no external libraries)
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = exports.CircuitState = void 0;
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN"; // Testing if service is back up
})(CircuitState || (exports.CircuitState = CircuitState = {}));
class CircuitBreaker {
    constructor(options) {
        this.options = options;
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.nextAttempt = 0;
        this.totalCalls = 0;
        this.totalFailures = 0;
        this.totalSuccesses = 0;
    }
    async execute(operation) {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() < this.nextAttempt) {
                throw new Error(`Circuit breaker is OPEN. Next attempt in ${this.nextAttempt - Date.now()}ms`);
            }
            else {
                this.state = CircuitState.HALF_OPEN;
                this.onStateChange();
            }
        }
        try {
            this.totalCalls++;
            const result = await operation();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    onSuccess() {
        this.failures = 0;
        this.successes++;
        this.totalSuccesses++;
        if (this.state === CircuitState.HALF_OPEN) {
            if (this.successes >= this.options.successThreshold) {
                this.state = CircuitState.CLOSED;
                this.successes = 0;
                this.onStateChange();
            }
        }
    }
    onFailure() {
        this.failures++;
        this.totalFailures++;
        this.successes = 0;
        if (this.state === CircuitState.HALF_OPEN ||
            (this.state === CircuitState.CLOSED && this.failures >= this.options.failureThreshold)) {
            this.state = CircuitState.OPEN;
            this.nextAttempt = Date.now() + this.options.timeout;
            this.onStateChange();
        }
    }
    onStateChange() {
        console.log(`Circuit breaker state changed to: ${this.state}`);
        if (this.options.onStateChange) {
            this.options.onStateChange(this.state);
        }
    }
    isOpen() {
        return this.state === CircuitState.OPEN && Date.now() < this.nextAttempt;
    }
    isClosed() {
        return this.state === CircuitState.CLOSED;
    }
    isHalfOpen() {
        return this.state === CircuitState.HALF_OPEN;
    }
    getStats() {
        return {
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            nextAttempt: this.nextAttempt,
            totalCalls: this.totalCalls,
            totalFailures: this.totalFailures,
            totalSuccesses: this.totalSuccesses,
        };
    }
    reset() {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.nextAttempt = 0;
        this.onStateChange();
    }
    // Force open (for maintenance)
    forceOpen() {
        this.state = CircuitState.OPEN;
        this.nextAttempt = Date.now() + this.options.timeout;
        this.onStateChange();
    }
    // Get health status
    getHealth() {
        const stats = this.getStats();
        const successRate = stats.totalCalls > 0 ?
            (stats.totalSuccesses / stats.totalCalls) * 100 : 100;
        return {
            state: this.state,
            healthy: this.state !== CircuitState.OPEN,
            successRate: Math.round(successRate * 100) / 100,
            totalCalls: stats.totalCalls,
            recentFailures: stats.failures,
            nextAttemptIn: this.state === CircuitState.OPEN ?
                Math.max(0, this.nextAttempt - Date.now()) : 0
        };
    }
}
exports.CircuitBreaker = CircuitBreaker;
//# sourceMappingURL=circuitBreaker.js.map