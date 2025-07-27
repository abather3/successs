#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class DependencyAnalyzer {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.results = {
      backend: { used: new Set(), unused: new Set(), all: new Set() },
      frontend: { used: new Set(), unused: new Set(), all: new Set() },
      root: { used: new Set(), unused: new Set(), all: new Set() }
    };
  }

  // Read package.json files
  readPackageJson(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.log(`${colors.red}Error reading ${filePath}: ${error.message}${colors.reset}`);
      return null;
    }
  }

  // Get all dependencies from package.json
  getAllDependencies(packageJson) {
    const deps = new Set();
    
    if (packageJson.dependencies) {
      Object.keys(packageJson.dependencies).forEach(dep => deps.add(dep));
    }
    
    if (packageJson.devDependencies) {
      Object.keys(packageJson.devDependencies).forEach(dep => deps.add(dep));
    }
    
    return deps;
  }

  // Search for imports/requires in files
  findImportsInFile(filePath, dependencies) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const usedDeps = new Set();

      dependencies.forEach(dep => {
        // Common import patterns
        const patterns = [
          new RegExp(`import.*from\\s+['"\`]${dep}['"\`]`, 'g'),
          new RegExp(`import\\s+['"\`]${dep}['"\`]`, 'g'),
          new RegExp(`require\\s*\\(\\s*['"\`]${dep}['"\`]\\s*\\)`, 'g'),
          new RegExp(`from\\s+['"\`]${dep}/`, 'g'),
          new RegExp(`require\\s*\\(\\s*['"\`]${dep}/`, 'g'),
          // Special cases for scoped packages
          new RegExp(`from\\s+['"\`]@${dep.replace('@', '')}`, 'g'),
          // Dynamic imports
          new RegExp(`import\\s*\\(\\s*['"\`]${dep}['"\`]\\s*\\)`, 'g')
        ];

        if (patterns.some(pattern => pattern.test(content))) {
          usedDeps.add(dep);
        }
      });

      return usedDeps;
    } catch (error) {
      return new Set();
    }
  }

  // Recursively scan directory for source files
  scanDirectory(dir, dependencies, extensions = ['.js', '.ts', '.jsx', '.tsx', '.json']) {
    const usedDeps = new Set();

    const scanRecursive = (currentDir) => {
      try {
        const items = fs.readdirSync(currentDir);
        
        for (const item of items) {
          const fullPath = path.join(currentDir, item);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            // Skip node_modules, dist, build directories
            if (!['node_modules', 'dist', 'build', '.git', 'coverage'].includes(item)) {
              scanRecursive(fullPath);
            }
          } else if (stat.isFile()) {
            const ext = path.extname(item);
            if (extensions.includes(ext)) {
              const fileUsedDeps = this.findImportsInFile(fullPath, dependencies);
              fileUsedDeps.forEach(dep => usedDeps.add(dep));
            }
          }
        }
      } catch (error) {
        console.log(`${colors.yellow}Warning: Could not scan ${currentDir}: ${error.message}${colors.reset}`);
      }
    };

    scanRecursive(dir);
    return usedDeps;
  }

  // Check if dependency might be used in config files or scripts
  checkConfigUsage(dependencies, workspaceDir) {
    const usedDeps = new Set();
    const configFiles = [
      'package.json',
      'tsconfig.json',
      'jest.config.js',
      'webpack.config.js',
      'tailwind.config.js',
      'postcss.config.js',
      '.eslintrc.js',
      'eslint.config.js'
    ];

    configFiles.forEach(configFile => {
      const configPath = path.join(workspaceDir, configFile);
      if (fs.existsSync(configPath)) {
        const configUsedDeps = this.findImportsInFile(configPath, dependencies);
        configUsedDeps.forEach(dep => usedDeps.add(dep));
      }
    });

    return usedDeps;
  }

  // Analyze specific workspace
  analyzeWorkspace(workspaceName, workspaceDir) {
    console.log(`\n${colors.blue}Analyzing ${workspaceName}...${colors.reset}`);
    
    const packageJsonPath = path.join(workspaceDir, 'package.json');
    const packageJson = this.readPackageJson(packageJsonPath);
    
    if (!packageJson) {
      console.log(`${colors.red}Could not read package.json for ${workspaceName}${colors.reset}`);
      return;
    }

    const allDeps = this.getAllDependencies(packageJson);
    this.results[workspaceName].all = allDeps;

    // Find used dependencies in source code
    const usedInCode = this.scanDirectory(workspaceDir, allDeps);
    
    // Find used dependencies in config files
    const usedInConfig = this.checkConfigUsage(allDeps, workspaceDir);
    
    // Combine all used dependencies
    const allUsed = new Set([...usedInCode, ...usedInConfig]);
    
    // Special handling for commonly used but hard-to-detect dependencies
    const specialCases = this.checkSpecialCases(allDeps, workspaceDir, workspaceName);
    specialCases.forEach(dep => allUsed.add(dep));

    this.results[workspaceName].used = allUsed;
    
    // Find unused dependencies
    allDeps.forEach(dep => {
      if (!allUsed.has(dep)) {
        this.results[workspaceName].unused.add(dep);
      }
    });
  }

  // Handle special cases that are hard to detect automatically
  checkSpecialCases(dependencies, workspaceDir, workspaceName) {
    const used = new Set();

    // Backend special cases
    if (workspaceName === 'backend') {
      // Runtime dependencies that might not show up in static analysis
      if (dependencies.has('ts-node') && fs.existsSync(path.join(workspaceDir, 'tsconfig.json'))) {
        used.add('ts-node');
      }
      if (dependencies.has('nodemon')) {
        used.add('nodemon'); // Used in package.json scripts
      }
      if (dependencies.has('dotenv')) {
        used.add('dotenv'); // Often imported at the top of index files
      }
    }

    // Frontend special cases
    if (workspaceName === 'frontend') {
      // React ecosystem dependencies
      if (dependencies.has('react-scripts')) {
        used.add('react-scripts'); // Used by Create React App
      }
      if (dependencies.has('web-vitals')) {
        used.add('web-vitals'); // Often used in index.js
      }
      if (dependencies.has('serve')) {
        used.add('serve'); // Used for serving built files
      }
    }

    // Testing dependencies
    ['jest', '@types/jest', 'ts-jest', 'supertest', '@types/supertest'].forEach(dep => {
      if (dependencies.has(dep) && fs.existsSync(path.join(workspaceDir, '__tests__'))) {
        used.add(dep);
      }
    });

    return used;
  }

  // Generate cleanup recommendations
  generateRecommendations() {
    console.log(`\n${colors.magenta}=== DEPENDENCY CLEANUP RECOMMENDATIONS ===${colors.reset}`);
    
    Object.keys(this.results).forEach(workspace => {
      const result = this.results[workspace];
      
      if (result.unused.size > 0) {
        console.log(`\n${colors.cyan}${workspace.toUpperCase()} - Potentially Unused Dependencies:${colors.reset}`);
        
        result.unused.forEach(dep => {
          console.log(`${colors.red}  ❌ ${dep}${colors.reset}`);
        });

        // Generate npm uninstall command
        const depsArray = Array.from(result.unused);
        if (depsArray.length > 0) {
          console.log(`\n${colors.yellow}Cleanup command for ${workspace}:${colors.reset}`);
          console.log(`npm uninstall ${depsArray.join(' ')}`);
        }
      } else {
        console.log(`\n${colors.green}${workspace.toUpperCase()} - All dependencies appear to be used! ✅${colors.reset}`);
      }
    });
  }

  // Main analysis method
  analyze() {
    console.log(`${colors.green}🔍 Starting dependency analysis for EscaShop...${colors.reset}`);
    
    // Analyze root package.json
    this.analyzeWorkspace('root', this.rootDir);
    
    // Analyze backend
    const backendDir = path.join(this.rootDir, 'backend');
    if (fs.existsSync(backendDir)) {
      this.analyzeWorkspace('backend', backendDir);
    }
    
    // Analyze frontend
    const frontendDir = path.join(this.rootDir, 'frontend');
    if (fs.existsSync(frontendDir)) {
      this.analyzeWorkspace('frontend', frontendDir);
    }

    this.generateRecommendations();
    this.generateSummary();
  }

  generateSummary() {
    console.log(`\n${colors.magenta}=== SUMMARY ===${colors.reset}`);
    
    let totalUnused = 0;
    let totalDeps = 0;

    Object.keys(this.results).forEach(workspace => {
      const result = this.results[workspace];
      totalUnused += result.unused.size;
      totalDeps += result.all.size;
      
      console.log(`${workspace}: ${result.used.size} used, ${result.unused.size} unused out of ${result.all.size} total`);
    });

    console.log(`\n${colors.cyan}Overall: ${totalDeps - totalUnused} used, ${totalUnused} potentially unused out of ${totalDeps} total dependencies${colors.reset}`);
    
    if (totalUnused > 0) {
      console.log(`\n${colors.yellow}💡 Removing unused dependencies could reduce bundle size and simplify maintenance.${colors.reset}`);
      console.log(`${colors.yellow}⚠️  Please verify these recommendations before removing dependencies!${colors.reset}`);
    } else {
      console.log(`\n${colors.green}🎉 No unused dependencies detected! Your codebase is clean.${colors.reset}`);
    }
  }
}

// Run the analysis
const rootDir = process.argv[2] || process.cwd();
const analyzer = new DependencyAnalyzer(rootDir);
analyzer.analyze();
