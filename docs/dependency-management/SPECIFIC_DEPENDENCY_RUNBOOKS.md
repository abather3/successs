# Specific Dependency Update Runbooks

## React Framework Updates

### React Major Version Update (v18.x → v19.x)

#### Pre-Update Assessment
1. **Breaking Changes Analysis**
   - Review React 19 breaking changes documentation
   - Check for deprecated React APIs in use
   - Verify third-party library compatibility

2. **Code Audit**
   ```bash
   # Search for deprecated patterns
   grep -r "React.FC" frontend/src/
   grep -r "componentWillMount" frontend/src/
   grep -r "UNSAFE_" frontend/src/
   ```

3. **Dependencies Check**
   ```bash
   # Check React ecosystem compatibility
   npm ls react
   npm ls react-dom
   npm ls @types/react
   ```

#### Update Process
1. **Create Update Branch**
   ```bash
   git checkout -b update/react-19
   cd frontend
   ```

2. **Update Core React**
   ```bash
   npm install react@^19.1.0 react-dom@^19.1.0
   npm install --save-dev @types/react@^19.1.8 @types/react-dom@^19.1.6
   ```

3. **Code Modifications**
   - Update component definitions
   - Replace deprecated lifecycle methods
   - Update TypeScript types

4. **Testing Strategy**
   ```bash
   # Run all React tests
   npm test -- --testPathPattern=".*\.(test|spec)\.(js|ts|tsx)$"
   
   # Run specific component tests
   npm test -- --testPathPattern="components"
   
   # Run E2E tests
   npm run test:e2e
   ```

5. **Bundle Analysis**
   ```bash
   npm run build
   npx webpack-bundle-analyzer build/static/js/*.js
   ```

#### Rollback Plan
```bash
# Emergency rollback
npm install react@^18.2.0 react-dom@^18.2.0
npm install --save-dev @types/react@^18.2.0 @types/react-dom@^18.2.0
npm run build
```

### React Router Updates

#### React Router v6 → v7 Migration

1. **Breaking Changes**
   - Review routing API changes
   - Check for deprecated router hooks

2. **Migration Steps**
   ```bash
   npm install react-router-dom@^7.6.3
   ```

3. **Code Updates**
   - Update route definitions
   - Replace deprecated hooks
   - Update navigation patterns

## Express.js Framework Updates

### Express Major Version Update (v4.x → v5.x)

#### Pre-Update Assessment
1. **Middleware Compatibility**
   ```bash
   # Check middleware versions
   grep -A 5 -B 5 "express" backend/package.json
   ```

2. **Custom Middleware Audit**
   ```bash
   # Find custom middleware
   find backend/src -name "*.ts" -exec grep -l "req.*res.*next" {} \;
   ```

#### Update Process
1. **Update Express**
   ```bash
   cd backend
   npm install express@^5.0.0
   npm install --save-dev @types/express@^5.0.0
   ```

2. **Middleware Updates**
   - Update body-parser (now built-in)
   - Check middleware compatibility
   - Update error handling patterns

3. **Testing**
   ```bash
   # Test API endpoints
   npm run test:integration
   
   # Test middleware chain
   npm test -- --testPathPattern="middleware"
   ```

#### Specific Checks
```javascript
// Check for removed features
// Express 5 removes support for some patterns
app.get('/route', (req, res, next) => {
  // Check if callback patterns still work
  // Verify error handling
});
```

## TypeScript Updates

### TypeScript Major Version Update

#### Pre-Update Assessment
1. **Breaking Changes Review**
   ```bash
   # Check current TypeScript version
   npx tsc --version
   
   # Analyze type errors
   npx tsc --noEmit
   ```

2. **Configuration Audit**
   ```bash
   # Check tsconfig.json compatibility
   cat backend/tsconfig.json
   cat frontend/tsconfig.json
   ```

#### Update Process
1. **Update TypeScript**
   ```bash
   # Backend
   cd backend
   npm install --save-dev typescript@^5.2.2
   
   # Frontend  
   cd ../frontend
   npm install --save-dev typescript@^4.9.5
   ```

2. **Fix Type Errors**
   ```bash
   # Check for compilation errors
   npx tsc --noEmit --skipLibCheck
   ```

3. **Update Type Definitions**
   ```bash
   # Update all @types packages
   npm update @types/node @types/jest @types/express
   ```

## Database Driver Updates

### PostgreSQL Driver (pg) Updates

#### Pre-Update Assessment
1. **Connection Pool Analysis**
   ```bash
   # Check current pg usage
   grep -r "Pool\|Client" backend/src/
   ```

2. **Query Pattern Audit**
   ```bash
   # Find SQL queries
   grep -r "query\|text" backend/src/ --include="*.ts"
   ```

#### Update Process
1. **Update pg Driver**
   ```bash
   cd backend
   npm install pg@^8.16.3
   npm install --save-dev @types/pg@^8.10.2
   ```

2. **Test Database Operations**
   ```bash
   # Run database tests
   npm run test:integration
   
   # Test specific database operations
   npm test -- --testPathPattern="database"
   ```

3. **Performance Testing**
   ```bash
   # Run performance benchmarks
   npm run benchmark:database
   ```

## Testing Framework Updates

### Jest Updates

#### Jest Major Version Update
1. **Configuration Review**
   ```bash
   # Check Jest configuration
   cat backend/jest.config.js
   cat frontend/package.json | jq '.jest'
   ```

2. **Update Jest**
   ```bash
   npm install --save-dev jest@^30.0.4 @types/jest@^30.0.0
   ```

3. **Update Test Files**
   - Check for deprecated matchers
   - Update mock patterns
   - Fix async test patterns

### Playwright Updates

#### Playwright Version Update
1. **Update Playwright**
   ```bash
   npm install --save-dev @playwright/test@^1.54.1
   ```

2. **Update Test Configuration**
   - Review playwright.config.ts
   - Update browser versions
   - Check for API changes

3. **Run Full E2E Suite**
   ```bash
   npm run test:e2e
   npm run test:e2e:ui
   ```

## Security Library Updates

### Authentication Libraries

#### JWT Library Update
1. **Security Review**
   ```bash
   # Check for security advisories
   npm audit
   
   # Update jsonwebtoken
   npm install jsonwebtoken@^9.0.0
   npm install --save-dev @types/jsonwebtoken@^9.0.2
   ```

2. **Test Authentication Flow**
   ```bash
   # Test JWT functionality
   npm test -- --testPathPattern="auth"
   ```

#### Password Hashing Updates

##### Argon2 Update
```bash
# Update Argon2
npm install argon2@^0.43.1

# Test password hashing
npm test -- --testPathPattern="password"
```

##### BCrypt Update
```bash
# Update BCrypt
npm install bcrypt@^5.1.0
npm install --save-dev @types/bcrypt@^5.0.0
```

## UI Library Updates

### Material-UI Updates

#### MUI Major Version Update
1. **Breaking Changes Review**
   ```bash
   # Check MUI usage
   grep -r "@mui" frontend/src/
   ```

2. **Update MUI**
   ```bash
   cd frontend
   npm install @mui/material@^7.2.0 @mui/icons-material@^7.2.0
   ```

3. **Component Migration**
   - Update theme configuration
   - Fix component prop changes
   - Update styling patterns

4. **Visual Testing**
   ```bash
   # Run visual regression tests
   npm run test:visual
   ```

## Build Tool Updates

### Webpack Updates

#### Webpack Configuration Update
1. **Configuration Audit**
   ```bash
   # Check webpack config
   cat frontend/webpack.config.js
   ```

2. **Update Build Tools**
   ```bash
   npm install --save-dev webpack@^5.0.0 webpack-cli@^5.0.0
   ```

3. **Build Testing**
   ```bash
   # Test build process
   npm run build
   
   # Check bundle size
   npx webpack-bundle-analyzer build/static/js/*.js
   ```

## Monitoring and Logging Updates

### Winston Logger Update
```bash
# Update Winston
npm install winston@^3.0.0

# Test logging functionality
npm test -- --testPathPattern="logger"
```

## Emergency Scenarios

### Critical Security Vulnerability

#### High-Severity CVE Response
1. **Immediate Assessment**
   ```bash
   # Check vulnerability impact
   npm audit --audit-level=high
   
   # Get specific vulnerability details
   npm audit --json | jq '.vulnerabilities'
   ```

2. **Emergency Patch**
   ```bash
   # Apply security patch
   npm install [vulnerable-package]@[patched-version]
   
   # Verify fix
   npm audit
   ```

3. **Rapid Testing**
   ```bash
   # Run critical path tests only
   npm test -- --testPathPattern="critical"
   
   # Quick smoke test
   npm run test:smoke
   ```

### Production Hotfix Deployment

#### Zero-Downtime Update Process
1. **Staging Verification**
   ```bash
   # Deploy to staging
   npm run deploy:staging
   
   # Run smoke tests
   npm run test:smoke:staging
   ```

2. **Blue-Green Deployment**
   ```bash
   # Deploy to blue environment
   npm run deploy:blue
   
   # Switch traffic
   npm run switch:blue
   ```

3. **Rollback Preparation**
   ```bash
   # Keep green environment ready for rollback
   # Monitor metrics for 15 minutes
   # If issues detected, switch back to green
   npm run switch:green
   ```

## Dependency-Specific Considerations

### Node.js Version Compatibility

#### Major Node.js Updates
```bash
# Check Node.js compatibility
node --version
npm run engines-check

# Update Node.js version in Dockerfile
# Update CI/CD pipeline Node.js version
# Update package.json engines field
```

### Package Lock File Management

#### Lock File Conflicts
```bash
# Resolve package-lock.json conflicts
rm package-lock.json
npm install

# Verify no breaking changes
npm ci
npm test
```

### Monorepo Considerations

#### Workspace Updates
```bash
# Update all workspaces
npm update --workspaces

# Run tests across all workspaces
npm run test --workspaces

# Check for cross-workspace compatibility
npm run test:integration --workspaces
```

## Performance Optimization

### Bundle Size Optimization
```bash
# Analyze bundle impact
npm run build
npx webpack-bundle-analyzer build/static/js/*.js

# Check for unused dependencies
npx depcheck

# Remove unused packages
npm uninstall [unused-package]
```

### Runtime Performance
```bash
# Performance benchmarks
npm run benchmark

# Memory usage analysis
node --max-old-space-size=4096 dist/index.js

# Profile application
node --prof dist/index.js
```
