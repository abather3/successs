import React, { ComponentType, useEffect, useState } from 'react';

// Feature flag hook for React components
export const useFeatureFlag = (flagName: string, userId?: string): boolean => {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    // This would integrate with your feature flag service
    // For now, we'll simulate with environment variables
    const checkFeatureFlag = async () => {
      try {
        const response = await fetch(`/api/feature-flags/${flagName}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'User-ID': userId || 'anonymous'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setIsEnabled(data.enabled);
        }
      } catch (error) {
        console.error('Failed to fetch feature flag:', error);
        setIsEnabled(false);
      }
    };

    checkFeatureFlag();
  }, [flagName, userId]);

  return isEnabled;
};

// Higher-order component for feature flag controlled components
export function withFeatureFlag<P = {}>(
  flagName: string,
  NewComponent: ComponentType<P>,
  FallbackComponent?: ComponentType<P>
) {
  return function FeatureFlaggedComponent(props: P) {
    const isEnabled = useFeatureFlag(flagName);

    if (isEnabled) {
      return <NewComponent {...props} />;
    }

    if (FallbackComponent) {
      return <FallbackComponent {...props} />;
    }

    return null;
  };
}

// Abstract base component class
export abstract class AbstractReactComponent<P = {}, S = {}> extends React.Component<P, S> {
  protected featureFlags: Map<string, boolean> = new Map();

  async componentDidMount() {
    await this.loadFeatureFlags();
  }

  protected async loadFeatureFlags(): Promise<void> {
    // Override in subclasses to load specific feature flags
  }

  protected isFeatureEnabled(flagName: string): boolean {
    return this.featureFlags.get(flagName) || false;
  }

  protected renderWithFallback(
    condition: boolean,
    primaryComponent: React.ReactNode,
    fallbackComponent?: React.ReactNode
  ): React.ReactNode {
    return condition ? primaryComponent : (fallbackComponent || null);
  }
}

// Component factory for version management
interface ComponentConfig {
  name: string;
  version: string;
  featureFlag?: string;
  fallbackVersion?: string;
}

export class ComponentFactory {
  private static componentRegistry = new Map<string, Map<string, ComponentType<any>>>();

  static register<P = {}>(
    name: string,
    version: string,
    component: ComponentType<P>
  ): void {
    if (!this.componentRegistry.has(name)) {
      this.componentRegistry.set(name, new Map());
    }
    
    const versions = this.componentRegistry.get(name)!;
    versions.set(version, component);
  }

  static create<P = {}>(
    config: ComponentConfig,
    props: P
  ): React.ReactElement<P> | null {
    const versions = this.componentRegistry.get(config.name);
    if (!versions) {
      console.warn(`Component ${config.name} not found in registry`);
      return null;
    }

    // Determine which version to use based on feature flags
    let targetVersion = config.version;
    
    if (config.featureFlag) {
      // This would check the actual feature flag
      // For demo purposes, using a simple check
      const isNewVersionEnabled = process.env.NODE_ENV === 'development';
      
      if (!isNewVersionEnabled && config.fallbackVersion) {
        targetVersion = config.fallbackVersion;
      }
    }

    const Component = versions.get(targetVersion);
    if (!Component) {
      console.warn(`Component ${config.name} version ${targetVersion} not found`);
      return null;
    }

    return React.createElement(Component, props);
  }
}

// Example component implementations
interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

// Legacy Button Component
export const LegacyButton: React.FC<ButtonProps> = ({ onClick, children, variant = 'primary' }) => {
  return (
    <button
      onClick={onClick}
      className={`legacy-btn ${variant === 'primary' ? 'btn-primary' : 'btn-secondary'}`}
      style={{
        padding: '8px 16px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        backgroundColor: variant === 'primary' ? '#007bff' : '#6c757d',
        color: 'white',
        cursor: 'pointer'
      }}
    >
      {children}
    </button>
  );
};

// New Button Component with enhanced features
export const NewButton: React.FC<ButtonProps> = ({ onClick, children, variant = 'primary' }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      await onClick();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`new-btn ${variant === 'primary' ? 'btn-primary' : 'btn-secondary'}`}
      style={{
        padding: '12px 24px',
        border: 'none',
        borderRadius: '8px',
        backgroundColor: variant === 'primary' ? '#0056b3' : '#545b62',
        color: 'white',
        cursor: isLoading ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        opacity: isLoading ? 0.7 : 1
      }}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  );
};

// Feature-flagged Button that switches between versions
export const SmartButton: React.FC<ButtonProps> = (props) => {
  return withFeatureFlag('new-button-component', NewButton, LegacyButton)(props);
};

// Register components
ComponentFactory.register('Button', '1.0.0', LegacyButton);
ComponentFactory.register('Button', '2.0.0', NewButton);

// Version-aware component wrapper
export function VersionAwareComponent<P = {}>({
  name,
  version,
  featureFlag,
  fallbackVersion,
  ...props
}: ComponentConfig & P) {
  const config: ComponentConfig = {
    name,
    version,
    featureFlag,
    fallbackVersion
  };

  return ComponentFactory.create(config, props);
}

// Rollback-aware component decorator
export function withRollbackSupport<P = {}>(
  Component: ComponentType<P>,
  rollbackConfig: {
    errorBoundaryFallback?: ComponentType<P>;
    maxErrors?: number;
    rollbackThreshold?: number;
  } = {}
) {
  return class RollbackComponent extends React.Component<P, { hasError: boolean; errorCount: number }> {
    private static errorCounts = new Map<string, number>();

    constructor(props: P) {
      super(props);
      this.state = { hasError: false, errorCount: 0 };
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      const componentName = Component.displayName || Component.name || 'Unknown';
      const currentCount = RollbackComponent.errorCounts.get(componentName) || 0;
      const newCount = currentCount + 1;
      
      RollbackComponent.errorCounts.set(componentName, newCount);
      
      console.error(`Component ${componentName} error #${newCount}:`, error, errorInfo);
      
      // If error count exceeds threshold, trigger rollback
      if (newCount >= (rollbackConfig.rollbackThreshold || 5)) {
        console.warn(`Component ${componentName} exceeded error threshold, triggering rollback`);
        // Here you would trigger a rollback mechanism
        this.triggerRollback(componentName);
      }

      this.setState({ errorCount: newCount });
    }

    private triggerRollback(componentName: string) {
      // This would integrate with your deployment system
      fetch('/api/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          component: componentName,
          reason: 'Error threshold exceeded',
          errorCount: this.state.errorCount
        })
      }).catch(err => console.error('Failed to trigger rollback:', err));
    }

    render() {
      if (this.state.hasError) {
        if (rollbackConfig.errorBoundaryFallback) {
          const FallbackComponent = rollbackConfig.errorBoundaryFallback;
          return <FallbackComponent {...this.props} />;
        }
        
        return (
          <div style={{ padding: '20px', border: '1px solid red', borderRadius: '4px' }}>
            <h3>Component Error</h3>
            <p>Something went wrong. Please refresh the page.</p>
          </div>
        );
      }

      return <Component {...this.props} />;
    }
  };
}
