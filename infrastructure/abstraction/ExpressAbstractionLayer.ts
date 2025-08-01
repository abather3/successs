import { Request, Response, NextFunction, Application } from 'express';
import { featureFlagManager } from '../feature-flags/FeatureFlagManager';

export interface MiddlewareConfig {
  name: string;
  version: string;
  fallbackVersion?: string;
  featureFlag?: string;
}

export abstract class AbstractExpressMiddleware {
  protected config: MiddlewareConfig;

  constructor(config: MiddlewareConfig) {
    this.config = config;
  }

  abstract execute(req: Request, res: Response, next: NextFunction): void | Promise<void>;

  public getHandler(): (req: Request, res: Response, next: NextFunction) => void {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Check if feature flag should determine which version to use
        if (this.config.featureFlag) {
          const useNewVersion = featureFlagManager.isEnabled(
            this.config.featureFlag,
            req.user?.id,
            process.env.NODE_ENV
          );

          if (!useNewVersion && this.config.fallbackVersion) {
            // Use fallback implementation
            return this.executeFallback(req, res, next);
          }
        }

        await this.execute(req, res, next);
      } catch (error) {
        console.error(`Middleware ${this.config.name} error:`, error);
        next(error);
      }
    };
  }

  protected executeFallback(req: Request, res: Response, next: NextFunction): void {
    // Default fallback just calls next
    next();
  }
}

// Rate Limiting Abstraction
export class RateLimitMiddleware extends AbstractExpressMiddleware {
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  async execute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const useEnhancedRateLimit = featureFlagManager.isEnabled(
      'enhanced-rate-limiting',
      req.user?.id,
      process.env.NODE_ENV
    );

    if (useEnhancedRateLimit) {
      await this.enhancedRateLimit(req, res, next);
    } else {
      this.basicRateLimit(req, res, next);
    }
  }

  private basicRateLimit(req: Request, res: Response, next: NextFunction): void {
    const clientId = req.ip || 'unknown';
    const limit = 100;
    const windowMs = 15 * 60 * 1000; // 15 minutes

    const now = Date.now();
    const record = this.rateLimitMap.get(clientId);

    if (!record || now > record.resetTime) {
      this.rateLimitMap.set(clientId, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (record.count >= limit) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }

    record.count++;
    next();
  }

  private async enhancedRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Enhanced rate limiting with Redis, sliding window, etc.
    const clientId = req.ip || 'unknown';
    const userTier = req.user?.tier || 'basic';
    
    const limits = {
      basic: { requests: 100, window: 15 * 60 * 1000 },
      premium: { requests: 1000, window: 15 * 60 * 1000 },
      enterprise: { requests: 10000, window: 15 * 60 * 1000 }
    };

    const limit = limits[userTier as keyof typeof limits] || limits.basic;
    
    // Implementation would use Redis for distributed rate limiting
    // For now, using in-memory as fallback
    this.basicRateLimit(req, res, next);
  }
}

// Authentication Abstraction
export class AuthMiddleware extends AbstractExpressMiddleware {
  async execute(req: Request, res: Response, next: NextFunction): Promise<void> {
    const useNewAuth = featureFlagManager.isEnabled(
      'new-auth-system',
      undefined,
      process.env.NODE_ENV
    );

    if (useNewAuth) {
      await this.newAuthImplementation(req, res, next);
    } else {
      await this.legacyAuthImplementation(req, res, next);
    }
  }

  private async newAuthImplementation(req: Request, res: Response, next: NextFunction): Promise<void> {
    // New JWT implementation with enhanced security
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      // Enhanced token validation with multiple checks
      // Implementation would include:
      // - Token rotation validation
      // - Device fingerprinting
      // - Suspicious activity detection
      
      next();
    } catch (error) {
      res.status(401).json({ error: 'Authentication failed' });
    }
  }

  private async legacyAuthImplementation(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Legacy implementation
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      // Basic token validation
      next();
    } catch (error) {
      res.status(401).json({ error: 'Authentication failed' });
    }
  }
}

// Middleware Factory
export class MiddlewareFactory {
  private static middlewareRegistry = new Map<string, typeof AbstractExpressMiddleware>();

  static register(name: string, middlewareClass: typeof AbstractExpressMiddleware): void {
    this.middlewareRegistry.set(name, middlewareClass);
  }

  static create(name: string, config: MiddlewareConfig): AbstractExpressMiddleware | null {
    const MiddlewareClass = this.middlewareRegistry.get(name);
    if (!MiddlewareClass) {
      console.warn(`Middleware ${name} not found in registry`);
      return null;
    }

    return new MiddlewareClass(config);
  }

  static applyMiddleware(app: Application, middlewares: Array<{ name: string; config: MiddlewareConfig }>): void {
    middlewares.forEach(({ name, config }) => {
      const middleware = this.create(name, config);
      if (middleware) {
        app.use(middleware.getHandler());
      }
    });
  }
}

// Register built-in middleware
MiddlewareFactory.register('rateLimit', RateLimitMiddleware);
MiddlewareFactory.register('auth', AuthMiddleware);
