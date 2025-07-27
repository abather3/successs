#!/usr/bin/env node

/**
 * Test setup verification script
 * Verifies that all required dependencies and test files are properly configured
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function checkFile(filePath, description) {
  const fullPath = path.join(__dirname, '..', filePath);
  const exists = fs.existsSync(fullPath);
  const status = exists ? '✅' : '❌';
  const statusColor = exists ? colors.green : colors.red;
  
  log(`${status} ${description}: ${filePath}`, statusColor);
  return exists;
}

function checkPackageScript(scriptName) {
  try {
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const exists = packageJson.scripts && packageJson.scripts[scriptName];
    const status = exists ? '✅' : '❌';
    const statusColor = exists ? colors.green : colors.red;
    
    log(`${status} npm script: ${scriptName}`, statusColor);
    return exists;
  } catch (error) {
    log(`❌ Error checking package.json: ${error.message}`, colors.red);
    return false;
  }
}

function checkDependency(depName, type = 'dependencies') {
  try {
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const deps = packageJson[type] || {};
    const exists = deps[depName];
    const status = exists ? '✅' : '❌';
    const statusColor = exists ? colors.green : colors.red;
    
    log(`${status} ${type}: ${depName}`, statusColor);
    return exists;
  } catch (error) {
    log(`❌ Error checking dependencies: ${error.message}`, colors.red);
    return false;
  }
}

function checkFrontendSetup() {
  const frontendPath = path.join(__dirname, '..', '..', 'frontend');
  const cypressPath = path.join(frontendPath, 'cypress');
  const configPath = path.join(frontendPath, 'cypress.config.js');
  
  const frontendExists = fs.existsSync(frontendPath);
  const cypressExists = fs.existsSync(cypressPath);
  const configExists = fs.existsSync(configPath);
  
  log(`${frontendExists ? '✅' : '❌'} Frontend directory exists`, 
      frontendExists ? colors.green : colors.red);
  log(`${cypressExists ? '✅' : '❌'} Cypress directory exists`, 
      cypressExists ? colors.green : colors.red);
  log(`${configExists ? '✅' : '❌'} Cypress config exists`, 
      configExists ? colors.green : colors.red);
  
  return frontendExists && cypressExists && configExists;
}

function main() {
  log('🔍 Test Setup Verification', colors.bright);
  log('=' * 40, colors.cyan);
  
  let allGood = true;
  
  // Check test files
  log('\n📋 Test Files:', colors.blue);
  const testFiles = [
    'src/__tests__/paymentSettlements.test.ts',
    'src/__tests__/integration/payment-flows.test.ts',
    'src/__tests__/migration/backward-compatibility.test.ts'
  ];
  
  testFiles.forEach(file => {
    if (!checkFile(file, 'Test file')) {
      allGood = false;
    }
  });
  
  // Check scripts
  log('\n📜 Scripts:', colors.blue);
  if (!checkFile('scripts/test-payment-system.js', 'Test runner script')) {
    allGood = false;
  }
  
  // Check dependencies
  log('\n📦 Dependencies:', colors.blue);
  const requiredDeps = ['jest', 'ts-jest', '@types/jest'];
  requiredDeps.forEach(dep => {
    if (!checkDependency(dep, 'devDependencies')) {
      allGood = false;
    }
  });
  
  // Check package scripts
  log('\n🚀 Package Scripts:', colors.blue);
  const requiredScripts = ['test', 'test:coverage'];
  requiredScripts.forEach(script => {
    if (!checkPackageScript(script)) {
      allGood = false;
    }
  });
  
  // Check frontend setup
  log('\n🌐 Frontend Setup:', colors.blue);
  if (!checkFrontendSetup()) {
    log('⚠️  Frontend E2E tests may not work properly', colors.yellow);
  }
  
  // Check test setup file
  log('\n⚙️  Test Configuration:', colors.blue);
  checkFile('src/__tests__/setup.ts', 'Test setup file');
  
  // Summary
  log('\n📊 Setup Summary:', colors.bright);
  log('=' * 20, colors.cyan);
  
  if (allGood) {
    log('✅ Test setup is complete!', colors.green);
    log('You can now run: npm run test:all', colors.cyan);
  } else {
    log('❌ Test setup is incomplete!', colors.red);
    log('Please install missing dependencies and create missing files.', colors.yellow);
  }
  
  // Recommendations
  log('\n💡 Recommendations:', colors.blue);
  log('- Run: npm install --save-dev jest ts-jest @types/jest', colors.cyan);
  log('- Create missing test files if needed', colors.cyan);
  log('- Set up Cypress for E2E tests: npm install --save-dev cypress', colors.cyan);
  log('- Run the test suite: node scripts/test-payment-system.js', colors.cyan);
}

if (require.main === module) {
  main();
}

module.exports = { checkFile, checkPackageScript, checkDependency, checkFrontendSetup };
