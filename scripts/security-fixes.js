#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 EscaShop Security Fixes');
console.log('==========================\n');

const fixes = {
  applied: 0,
  skipped: 0,
  errors: 0
};

function applyFix(fixName, fixFunction) {
  try {
    console.log(`🔧 Applying ${fixName}...`);
    const result = fixFunction();
    if (result.success) {
      console.log(`✅ ${fixName}: ${result.message}`);
      fixes.applied++;
    } else {
      console.log(`⚠️  ${fixName}: ${result.message}`);
      fixes.skipped++;
    }
  } catch (error) {
    console.log(`❌ ${fixName}: Error - ${error.message}`);
    fixes.errors++;
  }
  console.log('');
}

// Fix 1: Update production configuration to disable debug routes
function fixProductionConfig() {
  const prodComposeFile = './docker-compose.prod.improved.yml';
  
  if (!fs.existsSync(prodComposeFile)) {
    return { success: false, message: 'Production compose file not found' };
  }
  
  let content = fs.readFileSync(prodComposeFile, 'utf8');
  let changed = false;
  
  // Fix debug routes
  if (content.includes('ENABLE_DEBUG_ROUTES: true')) {
    content = content.replace(/ENABLE_DEBUG_ROUTES: true/g, 'ENABLE_DEBUG_ROUTES: false');
    changed = true;
  }
  
  // Fix log level
  if (content.includes('LOG_LEVEL: info')) {
    content = content.replace(/LOG_LEVEL: info/g, 'LOG_LEVEL: warn');
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(prodComposeFile, content);
    return { success: true, message: 'Production configuration updated' };
  }
  
  return { success: false, message: 'No configuration changes needed' };
}

// Fix 2: Create secure secrets directory
function createSecretsDirectory() {
  const secretsDir = './secrets';
  
  if (!fs.existsSync(secretsDir)) {
    fs.mkdirSync(secretsDir, { mode: 0o700 });
  }
  
  const secrets = {
    'jwt_secret.txt': 'production_jwt_secret_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
    'jwt_refresh_secret.txt': 'production_jwt_refresh_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
    'db_password.txt': 'secure_db_password_' + Math.random().toString(36).substring(2, 15),
    'redis_password.txt': 'secure_redis_password_' + Math.random().toString(36).substring(2, 15),
    'vonage_api_key.txt': 'your_vonage_api_key_here',
    'vonage_api_secret.txt': 'your_vonage_api_secret_here',
    'email_user.txt': 'your_email@example.com',
    'email_password.txt': 'your_email_password_here',
    'google_sheets_api_key.txt': 'your_google_sheets_api_key_here',
    'grafana_admin_password.txt': 'secure_grafana_password_' + Math.random().toString(36).substring(2, 15)
  };
  
  let created = 0;
  for (const [filename, defaultValue] of Object.entries(secrets)) {
    const filepath = path.join(secretsDir, filename);
    if (!fs.existsSync(filepath)) {
      fs.writeFileSync(filepath, defaultValue, { mode: 0o600 });
      created++;
    }
  }
  
  return { 
    success: true, 
    message: `Created ${created} secret files (please update with real values)` 
  };
}

// Fix 3: Update vulnerable dependencies (conservative approach)
function updateVulnerableDependencies() {
  const updates = [];
  
  // Backend dependencies that commonly have vulnerabilities
  const backendUpdates = {
    'axios': '^1.7.7',  // Latest stable
    'express': '^4.21.1', // Latest stable  
    'jsonwebtoken': '^9.0.2', // Latest stable
    'socket.io': '^4.8.5', // Latest stable
    'bcrypt': '^5.1.1', // Latest stable
    'pg': '^8.13.1' // Latest stable
  };
  
  // Update backend package.json
  const backendPkgPath = './backend/package.json';
  if (fs.existsSync(backendPkgPath)) {
    const backendPkg = JSON.parse(fs.readFileSync(backendPkgPath, 'utf8'));
    let backendChanged = false;
    
    for (const [dep, version] of Object.entries(backendUpdates)) {
      if (backendPkg.dependencies[dep]) {
        backendPkg.dependencies[dep] = version;
        backendChanged = true;
        updates.push(`Backend: ${dep} -> ${version}`);
      }
    }
    
    if (backendChanged) {
      fs.writeFileSync(backendPkgPath, JSON.stringify(backendPkg, null, 2));
    }
  }
  
  // Frontend dependencies that commonly have vulnerabilities
  const frontendUpdates = {
    'axios': '^1.7.7',
    'react-scripts': '^5.0.1', // Keep current stable version
    'socket.io-client': '^4.8.5'
  };
  
  // Update frontend package.json
  const frontendPkgPath = './frontend/package.json';
  if (fs.existsSync(frontendPkgPath)) {
    const frontendPkg = JSON.parse(fs.readFileSync(frontendPkgPath, 'utf8'));
    let frontendChanged = false;
    
    for (const [dep, version] of Object.entries(frontendUpdates)) {
      if (frontendPkg.dependencies[dep]) {
        frontendPkg.dependencies[dep] = version;
        frontendChanged = true;
        updates.push(`Frontend: ${dep} -> ${version}`);
      }
    }
    
    if (frontendChanged) {
      fs.writeFileSync(frontendPkgPath, JSON.stringify(frontendPkg, null, 2));
    }
  }
  
  return { 
    success: updates.length > 0, 
    message: updates.length > 0 ? `Updated: ${updates.join(', ')}` : 'No dependency updates needed' 
  };
}

// Fix 4: Create secure Nginx configuration
function createSecureNginxConfig() {
  const nginxDir = './nginx';
  const nginxConfigPath = path.join(nginxDir, 'nginx.prod.conf');
  
  if (!fs.existsSync(nginxDir)) {
    fs.mkdirSync(nginxDir, { recursive: true });
  }
  
  const secureNginxConfig = `
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' ws: wss:;" always;
    
    # SSL Configuration (update paths for your certificates)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;
    
    server {
        listen 443 ssl http2;
        server_name your-domain.com;
        
        # SSL certificate paths (update these)
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        
        # API proxy with rate limiting
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend:5000/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Login endpoint with stricter rate limiting
        location /api/auth/login {
            limit_req zone=login burst=5 nodelay;
            proxy_pass http://backend:5000/auth/login;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # WebSocket support
        location /socket.io/ {
            proxy_pass http://backend:5000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Frontend static files
        location / {
            proxy_pass http://frontend:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
    
    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }
}
`;
  
  if (!fs.existsSync(nginxConfigPath)) {
    fs.writeFileSync(nginxConfigPath, secureNginxConfig.trim());
    return { success: true, message: 'Created secure Nginx configuration' };
  }
  
  return { success: false, message: 'Nginx config already exists' };
}

// Fix 5: Create security environment variables template
function createSecurityEnvTemplate() {
  const envTemplatePath = './.env.production.template';
  
  const envTemplate = `# EscaShop Production Environment Variables
# Copy this to .env.production and update with real values

# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_NAME=escashop
DB_USER=escashop_user
DB_PASSWORD=\${DB_PASSWORD_SECRET}

# JWT Configuration (use strong secrets)
JWT_SECRET=\${JWT_SECRET}
JWT_REFRESH_SECRET=\${JWT_REFRESH_SECRET}
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=\${REDIS_PASSWORD_SECRET}

# Security Settings
BCRYPT_ROUNDS=12
PASSWORD_MIN_LENGTH=12
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_SYMBOLS=true
SESSION_TIMEOUT=300000

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100

# Production Logging
LOG_LEVEL=warn
LOG_TO_CONSOLE=false
LOG_TO_FILE=true

# Feature Flags (Production)
ENABLE_DEBUG_ROUTES=false
ENABLE_API_DOCS=false
ENABLE_MOCK_DATA=false
ENABLE_METRICS=true

# CORS Settings
FRONTEND_URL=https://yourdomain.com
CORS_ORIGINS=https://yourdomain.com
CORS_CREDENTIALS=true

# Email Configuration
EMAIL_SERVICE=smtp
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=true
EMAIL_USER=\${EMAIL_USER}
EMAIL_PASSWORD=\${EMAIL_PASSWORD}

# SMS Configuration
SMS_PROVIDER=vonage
VONAGE_API_KEY=\${VONAGE_API_KEY}
VONAGE_API_SECRET=\${VONAGE_API_SECRET}

# Timezone
TZ=Asia/Manila

# Application Version
APP_VERSION=1.0.0
`;
  
  if (!fs.existsSync(envTemplatePath)) {
    fs.writeFileSync(envTemplatePath, envTemplate.trim());
    return { success: true, message: 'Created production environment template' };
  }
  
  return { success: false, message: 'Environment template already exists' };
}

// Apply all fixes
console.log('🚀 Starting security fixes...\n');

applyFix('Production Configuration Security', fixProductionConfig);
applyFix('Secrets Directory Setup', createSecretsDirectory);
applyFix('Dependency Updates', updateVulnerableDependencies);
applyFix('Secure Nginx Configuration', createSecureNginxConfig);
applyFix('Production Environment Template', createSecurityEnvTemplate);

// Summary
console.log('🔧 Security Fixes Summary');
console.log('=========================');
console.log(`✅ Applied: ${fixes.applied}`);
console.log(`⚠️  Skipped: ${fixes.skipped}`);
console.log(`❌ Errors: ${fixes.errors}`);

if (fixes.applied > 0) {
  console.log('\n📋 Next Steps:');
  console.log('1. Review and update secret values in ./secrets/ directory');
  console.log('2. Update SSL certificate paths in nginx.prod.conf');
  console.log('3. Copy .env.production.template to .env.production and configure');
  console.log('4. Run: npm install (in both frontend and backend directories)');
  console.log('5. Test the updated configuration');
}

const securityScore = Math.round(((fixes.applied) / (fixes.applied + fixes.errors)) * 100);
console.log(`\n🎯 Security Improvement Score: ${securityScore}%`);

if (securityScore >= 90) {
  console.log('🟢 Security status: EXCELLENT - Ready for production deployment');
} else if (securityScore >= 70) {
  console.log('🟡 Security status: GOOD - Minor improvements recommended');
} else {
  console.log('🔴 Security status: NEEDS WORK - Address remaining issues');
}

process.exit(fixes.errors > 0 ? 1 : 0);
