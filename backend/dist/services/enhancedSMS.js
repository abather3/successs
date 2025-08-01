"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedSMSService = void 0;
exports.createSMSNotification = createSMSNotification;
// Enhanced SMS Service with Zero-Cost Circuit Breaker
const circuitBreaker_1 = require("./circuitBreaker");
class EnhancedSMSService {
    constructor() {
        this.providers = new Map();
        this.circuitBreakers = new Map();
        this.stats = new Map();
        this.fallbackQueue = [];
        this.setupProviders();
        this.setupCircuitBreakers();
        this.startRetryProcessor();
    }
    setupProviders() {
        // Add your existing SMS providers here
        const providers = [
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
                circuitState: circuitBreaker_1.CircuitState.CLOSED,
                isHealthy: true
            });
        });
    }
    setupCircuitBreakers() {
        Array.from(this.providers.keys()).forEach(providerName => {
            const circuitBreaker = new circuitBreaker_1.CircuitBreaker({
                failureThreshold: 5, // Open after 5 failures
                successThreshold: 3, // Close after 3 successes
                timeout: 60000, // Wait 1 minute before retry
                resetTimeout: 30000, // Half-open state timeout
                onStateChange: (state) => {
                    console.log(`SMS Provider ${providerName} circuit breaker: ${state}`);
                    const stats = this.stats.get(providerName);
                    if (stats) {
                        stats.circuitState = state;
                        stats.isHealthy = state !== circuitBreaker_1.CircuitState.OPEN;
                    }
                }
            });
            this.circuitBreakers.set(providerName, circuitBreaker);
        });
    }
    async sendSMS(notification) {
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
            }
            catch (error) {
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
    async sendWithProvider(providerName, notification) {
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
        }
        catch (error) {
            // Update stats on failure
            this.updateProviderStats(providerName, false, Date.now() - startTime);
            throw error;
        }
    }
    getHealthyProviders() {
        return Array.from(this.providers.values())
            .filter(provider => {
            const circuitBreaker = this.circuitBreakers.get(provider.name);
            return circuitBreaker && !circuitBreaker.isOpen();
        })
            .sort((a, b) => a.priority - b.priority);
    }
    updateProviderStats(providerName, success, responseTime) {
        const stats = this.stats.get(providerName);
        if (!stats)
            return;
        if (success) {
            stats.totalSent++;
        }
        else {
            stats.totalFailed++;
        }
        const totalAttempts = stats.totalSent + stats.totalFailed;
        stats.successRate = totalAttempts > 0 ? (stats.totalSent / totalAttempts) * 100 : 100;
        // Simple moving average for response time
        stats.averageResponseTime = (stats.averageResponseTime + responseTime) / 2;
    }
    addToFallbackQueue(notification) {
        notification.attempts++;
        if (notification.attempts < notification.maxAttempts) {
            this.fallbackQueue.push(notification);
            console.log(`Added SMS to fallback queue. Attempts: ${notification.attempts}/${notification.maxAttempts}`);
        }
        else {
            console.error(`SMS failed permanently after ${notification.attempts} attempts`);
            notification.status = 'cancelled';
        }
    }
    startRetryProcessor() {
        this.retryInterval = setInterval(() => {
            this.processFallbackQueue();
        }, 30000); // Retry every 30 seconds
    }
    async processFallbackQueue() {
        if (this.fallbackQueue.length === 0)
            return;
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
    async sendViaVonage(phoneNumber, message) {
        // Implement your existing Vonage SMS logic here
        // Throw error on failure, return on success
        console.log(`Sending SMS via Vonage to ${phoneNumber}: ${message}`);
        // Simulate random success/failure for testing
        if (Math.random() < 0.9) {
            return Promise.resolve();
        }
        else {
            throw new Error('Vonage SMS failed');
        }
    }
    async sendViaTwilio(phoneNumber, message) {
        // Implement your existing Twilio SMS logic here
        console.log(`Sending SMS via Twilio to ${phoneNumber}: ${message}`);
        // Simulate random success/failure for testing
        if (Math.random() < 0.8) {
            return Promise.resolve();
        }
        else {
            throw new Error('Twilio SMS failed');
        }
    }
    async sendViaClickSend(phoneNumber, message) {
        // Implement your existing ClickSend SMS logic here
        console.log(`Sending SMS via ClickSend to ${phoneNumber}: ${message}`);
        // Simulate random success/failure for testing
        if (Math.random() < 0.7) {
            return Promise.resolve();
        }
        else {
            throw new Error('ClickSend SMS failed');
        }
    }
    // Public methods for monitoring and management
    getProviderStats() {
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
    resetProvider(providerName) {
        const circuitBreaker = this.circuitBreakers.get(providerName);
        if (circuitBreaker) {
            circuitBreaker.reset();
            console.log(`Reset circuit breaker for provider: ${providerName}`);
        }
    }
    disableProvider(providerName) {
        const circuitBreaker = this.circuitBreakers.get(providerName);
        if (circuitBreaker) {
            circuitBreaker.forceOpen();
            console.log(`Disabled provider: ${providerName}`);
        }
    }
    // Cleanup
    destroy() {
        if (this.retryInterval) {
            clearInterval(this.retryInterval);
        }
    }
}
exports.EnhancedSMSService = EnhancedSMSService;
// Utility function to create SMS notifications
function createSMSNotification(phoneNumber, message, maxAttempts = 3) {
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
//# sourceMappingURL=enhancedSMS.js.map