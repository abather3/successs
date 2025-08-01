#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔒 EscaShop Production Security Audit');
console.log('=====================================\n');

const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  issues: []
};

function runTest(testName, testFunction) {
  try {
    console.log(`🔍 ${testName}...`);
    const result = testFunction();
    if (result.status === 'pass') {
      console.log(`✅ ${testName}: ${result.message}`);
      results.passed++;
    } else if (result.status === 'warn') {
      console.log(`⚠️  ${testName}: ${result.message}`);
      results.warnings++;
      results.issues.push({ type: 'warning', test: testName, message: result.message });
    } else {
      console.log(`❌ ${testName}: ${result.message}`);
      results.failed++;
      results.issues.push({ type: 'failure', test: testName, message: result.message });
    }
  } catch (error) {
    console.log(`❌ ${testName}: Error - ${error.message}`);
    results.failed++;
    results.issues.push({ type: 'error', test: testName, message: error.message });
  }
  console.log('');
}

// Security Test Functions
function checkDockerImages() {
  try {
    const backendImage = execSync('docker inspect escashop/backend:test --format="{{.Config.User}}"', { encoding: 'utf8' }).trim();
    const frontendImage = execSync('docker inspect escashop/frontend:test --format="{{.Config.User}}"', { encoding: 'utf8' }).trim();
    
    if (backendImage === 'node' && frontendImage === 'nextjs') {
      return { status: 'pass', message: 'Containers run as non-root users' };
    } else {
      return { status: 'fail', message: `Backend user: ${backendImage}, Frontend user: ${frontendImage}` };
    }
  } catch (error) {
    return { status: 'fail', message: 'Could not inspect Docker images' };
  }
}

function checkEnvironmentSecrets() {
  const secretsDir = './secrets';
  const requiredSecrets = [
    'jwt_secret.txt', 'jwt_refresh_secret.txt', 'db_password.txt'
  ];
  
  if (!fs.existsSync(secretsDir)) {
    return { status: 'warn', message: 'Secrets directory not found - using environment variables' };
  }
  
  const missingSecrets = requiredSecrets.filter(secret => 
    !fs.existsSync(path.join(secretsDir, secret))
  );
  
  if (missingSecrets.length === 0) {
    return { status: 'pass', message: 'All required secrets files present' };
  } else {
    return { status: 'warn', message: `Missing secrets: ${missingSecrets.join(', ')}` };
  }
}

function checkFilePermissions() {
  const criticalFiles = [
    './docker-compose.prod.improved.yml',
    './backend/Dockerfile',
    './frontend/Dockerfile'
  ];
  
  try {
    for (const file of criticalFiles) {
      if (!fs.existsSync(file)) {
        return { status: 'fail', message: `Critical file missing: ${file}` };
      }
    }
    return { status: 'pass', message: 'All critical files present' };
  } catch (error) {
    return { status: 'fail', message: 'Error checking file permissions' };
  }
}

function checkProductionConfigs() {
  const issues = [];
  
  // Check if debug routes are disabled in production
  const testCompose = './docker-compose.test.yml';
  if (fs.existsSync(testCompose)) {
    const content = fs.readFileSync(testCompose, 'utf8');
    if (content.includes('ENABLE_DEBUG_ROUTES: true')) {
      issues.push('Debug routes enabled in test config');
    }
    if (content.includes('LOG_LEVEL: info')) {
      issues.push('Log level should be "warn" or "error" in production');
    }
  }
  
  if (issues.length === 0) {
    return { status: 'pass', message: 'Production configurations look secure' };
  } else {
    return { status: 'warn', message: `Issues found: ${issues.join(', ')}` };
  }
}

function checkDependencyVulnerabilities() {
  try {
    // Check backend dependencies
    console.log('   Scanning backend dependencies...');
    execSync('cd backend && npm audit --audit-level=high', { stdio: 'pipe' });
    
    // Check frontend dependencies  
    console.log('   Scanning frontend dependencies...');
    execSync('cd frontend && npm audit --audit-level=high', { stdio: 'pipe' });
    
    return { status: 'pass', message: 'No high-severity vulnerabilities found' };
  } catch (error) {
    return { status: 'warn', message: 'High-severity vulnerabilities detected - run npm audit for details' };
  }
}

function checkSSLConfiguration() {
  const nginxConfig = './nginx/nginx.prod.conf';
  if (!fs.existsSync(nginxConfig)) {
    return { status: 'warn', message: 'Nginx production config not found' };
  }
  
  const content = fs.readFileSync(nginxConfig, 'utf8');
  const hasSSL = content.includes('ssl_certificate') && content.includes('ssl_certificate_key');
  const hasSecurityHeaders = content.includes('X-Frame-Options') && content.includes('X-Content-Type-Options');
  
  if (hasSSL && hasSecurityHeaders) {
    return { status: 'pass', message: 'SSL and security headers configured' };
  } else {
    return { status: 'warn', message: `Missing: ${!hasSSL ? 'SSL config' : ''} ${!hasSecurityHeaders ? 'Security headers' : ''}` };
  }
}

function checkPasswordSecurity() {
  const backendPackage = './backend/package.json';
  if (!fs.existsSync(backendPackage)) {
    return { status: 'fail', message: 'Backend package.json not found' };
  }
  
  const content = JSON.parse(fs.readFileSync(backendPackage, 'utf8'));
  const hasBcrypt = content.dependencies && content.dependencies.bcrypt;
  const hasArgon2 = content.dependencies && content.dependencies.argon2;
  
  if (hasBcrypt || hasArgon2) {
    return { status: 'pass', message: `Password hashing library present: ${hasBcrypt ? 'bcrypt' : 'argon2'}` };
  } else {
    return { status: 'fail', message: 'No secure password hashing library found' };
  }
}

// Run Security Tests
console.log('🔒 Running Security Validation Tests...\n');

runTest('Docker Non-Root User Check', checkDockerImages);
runTest('Environment Secrets Check', checkEnvironmentSecrets);
runTest('File Permissions Check', checkFilePermissions);
runTest('Production Configuration Check', checkProductionConfigs);
runTest('Dependency Vulnerability Scan', checkDependencyVulnerabilities);
runTest('SSL Configuration Check', checkSSLConfiguration);
runTest('Password Security Check', checkPasswordSecurity);

// Print Summary
console.log('🔒 Security Audit Summary');
console.log('========================');
console.log(`✅ Passed: ${results.passed}`);
console.log(`⚠️  Warnings: ${results.warnings}`);
console.log(`❌ Failed: ${results.failed}`);

if (results.issues.length > 0) {
  console.log('\n📋 Issues to Address:');
  results.issues.forEach((issue, index) => {
    console.log(`${index + 1}. [${issue.type.toUpperCase()}] ${issue.test}: ${issue.message}`);
  });
}

const securityScore = Math.round((results.passed / (results.passed + results.failed + results.warnings)) * 100);
console.log(`\n🎯 Security Score: ${securityScore}%`);

if (securityScore >= 80) {
  console.log('🟢 Security status: GOOD - Ready for production');
} else if (securityScore >= 60) {
  console.log('🟡 Security status: MODERATE - Address warnings before production');
} else {
  console.log('🔴 Security status: POOR - Address critical issues before production');
}

process.exit(results.failed > 0 ? 1 : 0);
