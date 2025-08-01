#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const yaml = require('js-yaml');

/**
 * Setup Dependency Testing Environment
 * Creates matrix package.json files and prepares testing environment
 */

class DependencyTestingSetup {
    constructor() {
        this.rootDir = process.cwd();
        this.matrixFile = path.join(this.rootDir, 'dependency-matrix.yml');
        this.testDir = path.join(this.rootDir, 'dependency-testing');
        this.reportsDir = path.join(this.rootDir, 'test-reports');
    }

    async setup() {
        console.log('🚀 Setting up dependency testing environment...');
        
        // Ensure directories exist
        this.ensureDirectories();
        
        // Load matrix configuration
        const matrixConfig = this.loadMatrixConfig();
        
        // Create test environments for each matrix combination
        await this.createTestEnvironments(matrixConfig);
        
        // Generate testing scripts
        this.generateTestingScripts();
        
        console.log('✅ Dependency testing environment setup complete!');
    }

    ensureDirectories() {
        const dirs = [this.testDir, this.reportsDir];
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Created directory: ${dir}`);
            }
        });
    }

    loadMatrixConfig() {
        if (!fs.existsSync(this.matrixFile)) {
            throw new Error('dependency-matrix.yml not found');
        }
        
        const content = fs.readFileSync(this.matrixFile, 'utf8');
        return yaml.load(content);
    }

    async createTestEnvironments(config) {
        const { test_matrices } = config;
        
        for (const [matrixType, matrixData] of Object.entries(test_matrices)) {
            console.log(`\n🔧 Processing matrix: ${matrixType}`);
            
            for (const combination of matrixData.combinations) {
                await this.createMatrixEnvironment(combination, matrixType);
            }
        }
    }

    async createMatrixEnvironment(combination, matrixType) {
        const envName = `${matrixType}-${combination.name}`;
        const envDir = path.join(this.testDir, envName);
        
        console.log(`  📦 Creating environment: ${envName}`);
        
        // Create environment directory
        if (!fs.existsSync(envDir)) {
            fs.mkdirSync(envDir, { recursive: true });
        }

        // Copy source code
        await this.copySourceCode(envDir);
        
        // Create matrix-specific package.json files
        this.createMatrixPackageJson(envDir, combination);
        
        // Create test configuration
        this.createTestConfiguration(envDir, combination, matrixType);
    }

    async copySourceCode(targetDir) {
        const sourceDirs = ['backend', 'frontend', 'tests'];
        const sourceFiles = ['package.json', 'package-lock.json', '.gitignore'];
        
        // Copy directories
        sourceDirs.forEach(dir => {
            const srcPath = path.join(this.rootDir, dir);
            const destPath = path.join(targetDir, dir);
            
            if (fs.existsSync(srcPath)) {
                this.copyDirectory(srcPath, destPath);
            }
        });
        
        // Copy files
        sourceFiles.forEach(file => {
            const srcPath = path.join(this.rootDir, file);
            const destPath = path.join(targetDir, file);
            
            if (fs.existsSync(srcPath)) {
                fs.copyFileSync(srcPath, destPath);
            }
        });
    }

    copyDirectory(src, dest) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        
        const entries = fs.readdirSync(src, { withFileTypes: true });
        
        entries.forEach(entry => {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            // Skip node_modules and other large directories
            if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
                return;
            }
            
            if (entry.isDirectory()) {
                this.copyDirectory(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        });
    }

    createMatrixPackageJson(envDir, combination) {
        // Root package.json
        const rootPackageJson = this.createRootPackageJson(combination);
        fs.writeFileSync(
            path.join(envDir, 'package.json'),
            JSON.stringify(rootPackageJson, null, 2)
        );

        // Backend package.json
        const backendPackageJson = this.createBackendPackageJson(combination);
        fs.writeFileSync(
            path.join(envDir, 'backend', 'package.json'),
            JSON.stringify(backendPackageJson, null, 2)
        );

        // Frontend package.json
        const frontendPackageJson = this.createFrontendPackageJson(combination);
        fs.writeFileSync(
            path.join(envDir, 'frontend', 'package.json'),
            JSON.stringify(frontendPackageJson, null, 2)
        );
    }

    createRootPackageJson(combination) {
        const basePackage = JSON.parse(fs.readFileSync(path.join(this.rootDir, 'package.json'), 'utf8'));
        
        return {
            ...basePackage,
            name: `escashop-${combination.name}`,
            description: `EscaShop test environment for ${combination.name}`,
            scripts: {
                ...basePackage.scripts,
                "test:matrix": "npm run test:backend && npm run test:frontend",
                "test:backend": "npm run test --workspace=backend",
                "test:frontend": "npm run test --workspace=frontend",
                "build:matrix": "npm run build --workspace=backend && npm run build --workspace=frontend"
            }
        };
    }

    createBackendPackageJson(combination) {
        const basePackage = JSON.parse(fs.readFileSync(path.join(this.rootDir, 'backend', 'package.json'), 'utf8'));
        
        // Update dependencies based on matrix configuration
        const updatedDependencies = { ...basePackage.dependencies };
        const updatedDevDependencies = { ...basePackage.devDependencies };
        
        if (combination.backend) {
            Object.entries(combination.backend).forEach(([dep, version]) => {
                if (updatedDependencies[dep]) {
                    updatedDependencies[dep] = version;
                }
                if (updatedDevDependencies[dep]) {
                    updatedDevDependencies[dep] = version;
                }
            });
        }
        
        return {
            ...basePackage,
            dependencies: updatedDependencies,
            devDependencies: updatedDevDependencies
        };
    }

    createFrontendPackageJson(combination) {
        const basePackage = JSON.parse(fs.readFileSync(path.join(this.rootDir, 'frontend', 'package.json'), 'utf8'));
        
        // Update dependencies based on matrix configuration
        const updatedDependencies = { ...basePackage.dependencies };
        const updatedDevDependencies = { ...basePackage.devDependencies };
        
        if (combination.frontend) {
            Object.entries(combination.frontend).forEach(([dep, version]) => {
                if (updatedDependencies[dep]) {
                    updatedDependencies[dep] = version;
                }
                if (updatedDevDependencies[dep]) {
                    updatedDevDependencies[dep] = version;
                }
                // Handle socket.io-client specifically
                if (dep === 'socket.io-client') {
                    updatedDependencies['socket.io-client'] = version;
                }
            });
        }
        
        return {
            ...basePackage,
            dependencies: updatedDependencies,
            devDependencies: updatedDevDependencies
        };
    }

    createTestConfiguration(envDir, combination, matrixType) {
        const config = {
            name: combination.name,
            matrixType,
            nodeVersion: combination.node_version,
            dependencies: {
                frontend: combination.frontend || {},
                backend: combination.backend || {}
            },
            expectedIssues: combination.expected_issues || [],
            testTimeout: '30m',
            testSuites: ['unit', 'integration', 'e2e'],
            environment: {
                NODE_ENV: 'test',
                CI: 'true',
                DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/escashop_matrix_test',
                REDIS_URL: 'redis://localhost:6379/2'
            }
        };
        
        fs.writeFileSync(
            path.join(envDir, 'test-config.json'),
            JSON.stringify(config, null, 2)
        );
    }

    generateTestingScripts() {
        // Generate main test runner script
        const testRunnerScript = this.generateTestRunnerScript();
        fs.writeFileSync(
            path.join(this.rootDir, 'scripts', 'run-matrix-tests.js'),
            testRunnerScript
        );
        
        // Generate Docker Compose for testing
        const dockerCompose = this.generateDockerCompose();
        fs.writeFileSync(
            path.join(this.rootDir, 'docker-compose.dependency-testing.yml'),
            dockerCompose
        );
        
        // Generate CI/CD pipeline update
        this.updateCIPipeline();
        
        console.log('📜 Generated testing scripts');
    }

    generateTestRunnerScript() {
        return `#!/usr/bin/env node
        
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Matrix Test Runner
 * Runs dependency matrix tests across all combinations
 */

class MatrixTestRunner {
    constructor() {
        this.testDir = path.join(process.cwd(), 'dependency-testing');
        this.reportsDir = path.join(process.cwd(), 'test-reports');
        this.results = [];
    }

    async runAllTests() {
        console.log('🧪 Starting matrix dependency tests...');
        
        const environments = fs.readdirSync(this.testDir);
        
        for (const env of environments) {
            await this.runEnvironmentTests(env);
        }
        
        await this.generateFinalReport();
    }

    async runEnvironmentTests(envName) {
        console.log(\`\\n🔬 Testing environment: \${envName}\`);
        
        const envDir = path.join(this.testDir, envName);
        const config = JSON.parse(fs.readFileSync(path.join(envDir, 'test-config.json'), 'utf8'));
        
        const result = {
            environment: envName,
            config,
            startTime: new Date(),
            tests: {}
        };
        
        try {
            // Install dependencies
            console.log('  📦 Installing dependencies...');
            execSync('npm ci', { cwd: envDir, stdio: 'inherit' });
            
            // Run backend tests
            result.tests.backend = await this.runBackendTests(envDir);
            
            // Run frontend tests  
            result.tests.frontend = await this.runFrontendTests(envDir);
            
            // Run E2E tests
            result.tests.e2e = await this.runE2ETests(envDir);
            
            result.status = 'success';
            result.endTime = new Date();
            
        } catch (error) {
            result.status = 'failed';
            result.error = error.message;
            result.endTime = new Date();
            console.error(\`❌ Tests failed for \${envName}: \${error.message}\`);
        }
        
        this.results.push(result);
        this.saveEnvironmentReport(result);
    }

    async runBackendTests(envDir) {
        try {
            execSync('npm run test --workspace=backend', { cwd: envDir, stdio: 'pipe' });
            return { status: 'passed', issues: [] };
        } catch (error) {
            return { status: 'failed', issues: [error.message] };
        }
    }

    async runFrontendTests(envDir) {
        try {
            execSync('npm run test --workspace=frontend', { cwd: envDir, stdio: 'pipe' });
            return { status: 'passed', issues: [] };
        } catch (error) {
            return { status: 'failed', issues: [error.message] };
        }
    }

    async runE2ETests(envDir) {
        try {
            execSync('npm run test:e2e', { cwd: envDir, stdio: 'pipe' });
            return { status: 'passed', issues: [] };
        } catch (error) {
            return { status: 'failed', issues: [error.message] };
        }
    }

    saveEnvironmentReport(result) {
        const reportPath = path.join(this.reportsDir, \`\${result.environment}-report.json\`);
        fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
    }

    async generateFinalReport() {
        const summary = {
            totalEnvironments: this.results.length,
            passed: this.results.filter(r => r.status === 'success').length,
            failed: this.results.filter(r => r.status === 'failed').length,
            results: this.results,
            generatedAt: new Date()
        };
        
        fs.writeFileSync(
            path.join(this.reportsDir, 'matrix-test-summary.json'),
            JSON.stringify(summary, null, 2)
        );
        
        console.log(\`\\n📊 Matrix Testing Complete:\`);
        console.log(\`  ✅ Passed: \${summary.passed}\`);
        console.log(\`  ❌ Failed: \${summary.failed}\`);
        console.log(\`  📋 Reports saved to: \${this.reportsDir}\`);
    }
}

if (require.main === module) {
    const runner = new MatrixTestRunner();
    runner.runAllTests().catch(console.error);
}

module.exports = MatrixTestRunner;`;
    }

    generateDockerCompose() {
        return `version: '3.8'

services:
  postgres-test:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: escashop_matrix_test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5433:5432"
    volumes:
      - postgres_matrix_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis-test:
    image: redis:6-alpine
    ports:
      - "6380:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_matrix_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  node18-test:
    build:
      context: ./docker/node18
    volumes:
      - .:/app
      - node18_modules:/app/node_modules
    environment:
      - NODE_ENV=test
      - DATABASE_URL=postgresql://postgres:postgres@postgres-test:5432/escashop_matrix_test
      - REDIS_URL=redis://redis-test:6379/2
    depends_on:
      postgres-test:
        condition: service_healthy
      redis-test:
        condition: service_healthy
    command: tail -f /dev/null

  node20-test:
    build:
      context: ./docker/node20
    volumes:
      - .:/app
      - node20_modules:/app/node_modules
    environment:
      - NODE_ENV=test
      - DATABASE_URL=postgresql://postgres:postgres@postgres-test:5432/escashop_matrix_test
      - REDIS_URL=redis://redis-test:6379/2
    depends_on:
      postgres-test:
        condition: service_healthy
      redis-test:
        condition: service_healthy
    command: tail -f /dev/null

  node22-test:
    build:
      context: ./docker/node22
    volumes:
      - .:/app
      - node22_modules:/app/node_modules
    environment:
      - NODE_ENV=test
      - DATABASE_URL=postgresql://postgres:postgres@postgres-test:5432/escashop_matrix_test
      - REDIS_URL=redis://redis-test:6379/2
    depends_on:
      postgres-test:
        condition: service_healthy
      redis-test:
        condition: service_healthy
    command: tail -f /dev/null

  percy-agent:
    image: percyio/agent:latest
    environment:
      - PERCY_TOKEN=\${PERCY_TOKEN}
    command: tail -f /dev/null
    profiles: ["visual-testing"]

volumes:
  postgres_matrix_data:
  redis_matrix_data:
  node18_modules:
  node20_modules:
  node22_modules:`;
    }

    updateCIPipeline() {
        // Update the existing CI pipeline to include dependency testing branch
        const ciPath = path.join(this.rootDir, '.github', 'workflows', 'dependency-testing.yml');
        
        const ciConfig = `name: Dependency Testing Pipeline

on:
  push:
    branches: [ dependency-testing ]
  pull_request:
    branches: [ dependency-testing ]
  workflow_dispatch:
    inputs:
      test_scope:
        description: 'Test scope'
        required: false
        default: 'all'
        type: choice
        options:
          - all
          - node18
          - node20
          - node22
          - major-updates-only

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}

jobs:
  dependency-testing:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        node-version: [18.19.1, 20.11.1, 22.5.1]
    
    name: "Node.js \${{ matrix.node-version }} Dependency Testing"
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node-version }}
          cache: 'npm'

      - name: Setup test environment
        run: |
          docker-compose -f docker-compose.dependency-testing.yml up -d postgres-test redis-test
          sleep 10

      - name: Setup dependency testing environment
        run: |
          npm install
          node scripts/setup-dependency-testing.js

      - name: Run matrix tests
        timeout-minutes: 45
        run: |
          node scripts/run-matrix-tests.js

      - name: Generate compatibility report
        if: always()
        run: |
          node scripts/generate-compatibility-report.js

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: dependency-test-results-node\${{ matrix.node-version }}
          path: |
            test-reports/
            compatibility-reports/

  visual-regression-testing:
    runs-on: ubuntu-latest
    needs: dependency-testing
    if: github.event.inputs.test_scope != 'major-updates-only'
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.11.1'
          cache: 'npm'

      - name: Setup test environment
        run: |
          docker-compose -f docker-compose.dependency-testing.yml up -d

      - name: Run visual regression tests
        env:
          PERCY_TOKEN: \${{ secrets.PERCY_TOKEN }}
        run: |
          npm run test:visual-regression

      - name: Upload visual test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: visual-regression-results
          path: |
            percy-results/
            screenshots/`;

        fs.writeFileSync(ciPath, ciConfig);
    }
}

// Run setup if called directly
if (require.main === module) {
    const setup = new DependencyTestingSetup();
    setup.setup().catch(console.error);
}

module.exports = DependencyTestingSetup;
