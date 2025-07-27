// Enhanced SMS Service with Zero-Cost Circuit Breaker
import { CircuitBreaker, CircuitState } from './circuitBreaker';

interface SMSProvider {
  name: string;
  sendSMS: (phoneNumber: string, message: string) => Promise<any>;
  priority: number; // 1 = highest priority
}

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

export class EnhancedSMSService {
  private providers: Map<string, SMSProvider> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private stats: Map<string, SMSStats> = new Map();
  private fallbackQueue: SMSNotification[] = [];
  private retryInterval?: NodeJS.Timeout;

  constructor() {
    this.setupProviders();
    this.setupCircuitBreakers();
    this.startRetryProcessor();
  }

  private setupProviders(): void {
    // Add your existing SMS providers here
    const providers: SMSProvider[] = [
      {
        name: 'vonage',
        sendSMS: this.sendViaVonage.bind(this),
        priority: 1
      },
      {
        name: 'twilio',
        sendSMS: this.sendViaTwilio.bind(this),
        priority: 2
      },
      {
        name: 'clicksend',
        sendSMS: this.sendViaClickSend.bind(this),
        priority: 3
      }
    ];

    providers.forEach(provider => {
      this.providers.set(provider.name, provider);
      this.stats.set(provider.name, {
        provider: provider.name,
        totalSent: 0,
        totalFailed: 0,
        successRate: 100,
        averageResponseTime: 0,
        circuitState: CircuitState.CLOSED,
        isHealthy: true
      });
    });
  }

  private setupCircuitBreakers(): void {
    Array.from(this.providers.keys()).forEach(providerName => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,        // Open after 5 failures
        successThreshold: 3,        // Close after 3 successes
        timeout: 60000,             // Wait 1 minute before retry
        resetTimeout: 30000,        // Half-open state timeout
        onStateChange: (state) => {
          console.log(`SMS Provider ${providerName} circuit breaker: ${state}`);
          const stats = this.stats.get(providerName);
          if (stats) {
            stats.circuitState = state;
            stats.isHealthy = state !== CircuitState.OPEN;
          }
        }
      });

      this.circuitBreakers.set(providerName, circuitBreaker);
    });
  }

  async sendSMS(notification: SMSNotification): Promise<boolean> {
    // Get providers sorted by priority and health
    const availableProviders = this.getHealthyProviders();
    
    if (availableProviders.length === 0) {
      console.error('No healthy SMS providers available');
      this.addToFallbackQueue(notification);
      return false;
    }

    for (const provider of availableProviders) {
      try {
        const result = await this.sendWithProvider(provider.name, notification);
        if (result) {
          notification.status = 'sent';
          notification.provider = provider.name;
          notification.sentAt = new Date();
          return true;
        }
      } catch (error) {
        console.warn(`SMS failed with ${provider.name}:`, error);
        notification.error = error instanceof Error ? error.message : 'Unknown error';
        // Continue to next provider
      }
    }

    // All providers failed
    notification.status = 'failed';
    this.addToFallbackQueue(notification);
    return false;
  }

  private async sendWithProvider(providerName: string, notification: SMSNotification): Promise<boolean> {
    const provider = this.providers.get(providerName);
    const circuitBreaker = this.circuitBreakers.get(providerName);
    
    if (!provider || !circuitBreaker) {
      throw new Error(`Provider ${providerName} not found`);
    }

    const startTime = Date.now();
    
    try {
      await circuitBreaker.execute(async () => {
        await provider.sendSMS(notification.phoneNumber, notification.message);
      });

      // Update stats on success
      this.updateProviderStats(providerName, true, Date.now() - startTime);
      return true;
      
    } catch (error) {
      // Update stats on failure
      this.updateProviderStats(providerName, false, Date.now() - startTime);
      throw error;
    }
  }

  private getHealthyProviders(): SMSProvider[] {
    return Array.from(this.providers.values())
      .filter(provider => {
        const circuitBreaker = this.circuitBreakers.get(provider.name);
        return circuitBreaker && !circuitBreaker.isOpen();
      })
      .sort((a, b) => a.priority - b.priority);
  }

  private updateProviderStats(providerName: string, success: boolean, responseTime: number): void {
    const stats = this.stats.get(providerName);
    if (!stats) return;

    if (success) {
      stats.totalSent++;
    } else {
      stats.totalFailed++;
    }

    const totalAttempts = stats.totalSent + stats.totalFailed;
    stats.successRate = totalAttempts > 0 ? (stats.totalSent / totalAttempts) * 100 : 100;
    
    // Simple moving average for response time
    stats.averageResponseTime = (stats.averageResponseTime + responseTime) / 2;
  }

  private addToFallbackQueue(notification: SMSNotification): void {
    notification.attempts++;
    if (notification.attempts < notification.maxAttempts) {
      this.fallbackQueue.push(notification);
      console.log(`Added SMS to fallback queue. Attempts: ${notification.attempts}/${notification.maxAttempts}`);
    } else {
      console.error(`SMS failed permanently after ${notification.attempts} attempts`);
      notification.status = 'cancelled';
    }
  }

  private startRetryProcessor(): void {
    this.retryInterval = setInterval(() => {
      this.processFallbackQueue();
    }, 30000); // Retry every 30 seconds
  }

  private async processFallbackQueue(): Promise<void> {
    if (this.fallbackQueue.length === 0) return;

    console.log(`Processing fallback queue: ${this.fallbackQueue.length} messages`);

    const messagesToRetry = [...this.fallbackQueue];
    this.fallbackQueue = [];

    for (const notification of messagesToRetry) {
      const success = await this.sendSMS(notification);
      if (!success) {
        // Will be re-added to fallback queue if attempts < maxAttempts
      }
    }
  }

  // Provider-specific implementations (adapt these to your existing code)
  private async sendViaVonage(phoneNumber: string, message: string): Promise<void> {
    // Implement your existing Vonage SMS logic here
    // Throw error on failure, return on success
    console.log(`Sending SMS via Vonage to ${phoneNumber}: ${message}`);
    
    // Simulate random success/failure for testing
    if (Math.random() < 0.9) {
      return Promise.resolve();
    } else {
      throw new Error('Vonage SMS failed');
    }
  }

  private async sendViaTwilio(phoneNumber: string, message: string): Promise<void> {
    // Implement your existing Twilio SMS logic here
    console.log(`Sending SMS via Twilio to ${phoneNumber}: ${message}`);
    
    // Simulate random success/failure for testing
    if (Math.random() < 0.8) {
      return Promise.resolve();
    } else {
      throw new Error('Twilio SMS failed');
    }
  }

  private async sendViaClickSend(phoneNumber: string, message: string): Promise<void> {
    // Implement your existing ClickSend SMS logic here
    console.log(`Sending SMS via ClickSend to ${phoneNumber}: ${message}`);
    
    // Simulate random success/failure for testing
    if (Math.random() < 0.7) {
      return Promise.resolve();
    } else {
      throw new Error('ClickSend SMS failed');
    }
  }

  // Public methods for monitoring and management
  getProviderStats(): SMSStats[] {
    return Array.from(this.stats.values());
  }

  getSystemHealth() {
    const providers = this.getProviderStats();
    const healthyProviders = providers.filter(p => p.isHealthy);
    
    return {
      totalProviders: providers.length,
      healthyProviders: healthyProviders.length,
      fallbackQueueSize: this.fallbackQueue.length,
      overallHealthy: healthyProviders.length > 0,
      providers: providers
    };
  }

  // Manual provider control
  resetProvider(providerName: string): void {
    const circuitBreaker = this.circuitBreakers.get(providerName);
    if (circuitBreaker) {
      circuitBreaker.reset();
      console.log(`Reset circuit breaker for provider: ${providerName}`);
    }
  }

  disableProvider(providerName: string): void {
    const circuitBreaker = this.circuitBreakers.get(providerName);
    if (circuitBreaker) {
      circuitBreaker.forceOpen();
      console.log(`Disabled provider: ${providerName}`);
    }
  }

  // Cleanup
  destroy(): void {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
    }
  }
}

// Utility function to create SMS notifications
export function createSMSNotification(
  phoneNumber: string, 
  message: string, 
  maxAttempts: number = 3
): SMSNotification {
  return {
    id: Math.random().toString(36).substr(2, 9),
    phoneNumber,
    message,
    attempts: 0,
    maxAttempts,
    status: 'pending',
    createdAt: new Date()
  };
}
