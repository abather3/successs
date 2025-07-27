// Zero-Cost Circuit Breaker Implementation
// Simple circuit breaker using native JavaScript (no external libraries)

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, failing fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service is back up
}

interface CircuitBreakerOptions {
  failureThreshold: number;    // Number of failures to open circuit
  successThreshold: number;    // Number of successes to close circuit
  timeout: number;             // Time to wait before trying again (ms)
  resetTimeout: number;        // Time to wait in half-open state (ms)
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

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private nextAttempt = 0;
  private totalCalls = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker is OPEN. Next attempt in ${this.nextAttempt - Date.now()}ms`);
      } else {
        this.state = CircuitState.HALF_OPEN;
        this.onStateChange();
      }
    }

    try {
      this.totalCalls++;
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
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

  private onFailure(): void {
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

  private onStateChange(): void {
    console.log(`Circuit breaker state changed to: ${this.state}`);
    if (this.options.onStateChange) {
      this.options.onStateChange(this.state);
    }
  }

  isOpen(): boolean {
    return this.state === CircuitState.OPEN && Date.now() < this.nextAttempt;
  }

  isClosed(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  isHalfOpen(): boolean {
    return this.state === CircuitState.HALF_OPEN;
  }

  getStats(): CircuitBreakerStats {
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

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = 0;
    this.onStateChange();
  }

  // Force open (for maintenance)
  forceOpen(): void {
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
