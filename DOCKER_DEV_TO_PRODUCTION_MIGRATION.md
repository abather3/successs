# Docker Development to Production Migration Guide

## Overview

This guide provides step-by-step instructions for converting your EscaShop Docker development setup to a production-ready deployment. Your production setup already includes Nginx as a reverse proxy, which will handle all request routing and replace the development proxies.

## Current Setup Analysis

### Development Environment (`docker-compose.dev.yml`)
- Direct port exposure (frontend:3000, backend:5000, postgres:5432, redis:6379)
- Development proxy middleware in frontend
- Hot reloading and file watching
- Debug logging and verbose output
- Development dependencies included

### Production Environment (`docker-compose.yml`)
- Nginx reverse proxy handling all requests
- SSL/TLS termination
- Docker secrets for sensitive data
- Production-optimized builds
- Health checks and monitoring

## Step-by-Step Migration Process

### Step 1: Environment Variables and Configuration

#### 1.1 Create Production Environment Files

```bash
# Backend production environment
cp backend/.env.production.template backend/.env.production
```

Edit `backend/.env.production` with your production values:

```env
# Database Configuration
DATABASE_URL=postgresql://prod_user:secure_prod_password@prod-db-host:5432/escashop_prod

# JWT Configuration (Use strong, unique keys)
JWT_SECRET=your-super-secure-jwt-secret-256-bits-minimum-length-for-production
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-256-bits-minimum-different

# Production Environment
NODE_ENV=production
PORT=5000

# Security Configuration
CORS_ORIGINS=https://your-production-domain.com,https://admin.your-domain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# SSL/TLS Configuration
SSL_ENABLED=true
SSL_CERT_PATH=/etc/ssl/certs/escashop.pem
SSL_KEY_PATH=/etc/ssl/private/escashop.key

# Production domain
FRONTEND_URL=https://your-production-domain.com
```

#### 1.2 Create Frontend Production Environment

Create `frontend/.env.production`:

```env
NODE_ENV=production
REACT_APP_API_URL=/api
REACT_APP_WS_URL=wss://your-production-domain.com
GENERATE_SOURCEMAP=false
```

### Step 2: Docker Secrets Configuration

#### 2.1 Create Secrets Directory Structure

```bash
mkdir -p secrets
chmod 700 secrets
```

#### 2.2 Generate Strong Secrets

```bash
# Database password
echo "your_super_secure_db_password_min_32_chars" > secrets/db_password.txt

# Redis password
echo "your_super_secure_redis_password_min_32_chars" > secrets/redis_password.txt

# JWT secrets
openssl rand -base64 64 | tr -d '\n' > secrets/jwt_secret.txt
openssl rand -base64 64 | tr -d '\n' > secrets/jwt_refresh_secret.txt

# API secrets
echo "your_vonage_api_secret" > secrets/vonage_api_secret.txt
echo "your_email_app_password" > secrets/email_password.txt
echo "your_google_sheets_api_key" > secrets/google_sheets_api_key.txt

# Set proper permissions
chmod 600 secrets/*.txt
```

### Step 3: SSL/TLS Certificate Setup

#### 3.1 Create SSL Directory

```bash
mkdir -p nginx/ssl
chmod 700 nginx/ssl
```

#### 3.2 Option A: Let's Encrypt (Recommended)

```bash
# Install certbot (if not already installed)
sudo apt update && sudo apt install certbot

# Generate certificate
sudo certbot certonly --standalone -d your-production-domain.com

# Copy certificates to nginx directory
sudo cp /etc/letsencrypt/live/your-production-domain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/your-production-domain.com/privkey.pem nginx/ssl/
sudo chown $USER:$USER nginx/ssl/*.pem
chmod 600 nginx/ssl/*.pem
```

#### 3.2 Option B: Self-Signed Certificate (Development/Testing)

```bash
# Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/escashop.key \
  -out nginx/ssl/escashop.pem \
  -subj "/C=PH/ST=Metro Manila/L=Manila/O=EscaShop/CN=your-production-domain.com"

chmod 600 nginx/ssl/*
```

### Step 4: Update Nginx Configuration for Production

#### 4.1 Create Production Nginx Config

Create `nginx/nginx.prod.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;

    # Upstream servers
    upstream backend {
        server backend:5000;
        keepalive 32;
    }

    upstream frontend {
        server frontend:3000;
        keepalive 32;
    }

    # HTTP to HTTPS redirect
    server {
        listen 80;
        server_name your-production-domain.com;
        return 301 https://$server_name$request_uri;
    }

    # Main HTTPS server
    server {
        listen 443 ssl http2;
        server_name your-production-domain.com;

        # SSL Configuration
        ssl_certificate /etc/nginx/ssl/escashop.pem;
        ssl_certificate_key /etc/nginx/ssl/escashop.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;

        # API routes
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        # Auth routes (stricter rate limiting)
        location /api/auth/ {
            limit_req zone=auth burst=5 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket support
        location /socket.io/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Frontend routes
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Handle client-side routing
            try_files $uri $uri/ @fallback;
        }

        # Fallback for React Router
        location @fallback {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Static files with caching
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            proxy_pass http://frontend;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

### Step 5: Database Migration to Production

#### 5.1 Production Database Setup

```bash
# Option A: External managed database (recommended)
# Update docker-compose.yml to use external database
# Remove postgres service and update DATABASE_URL

# Option B: Docker PostgreSQL with proper security
# Ensure postgresql data is backed up and volumes are persistent
```

#### 5.2 Database Migration Script

Create `scripts/migrate-to-production.sh`:

```bash
#!/bin/bash
set -e

echo "Starting production database migration..."

# Backup development database
docker exec escashop_postgres_dev pg_dump -U postgres escashop > backup-dev-$(date +%Y%m%d).sql

# Wait for production database to be ready
echo "Waiting for production database..."
until docker exec escashop_backend_prod pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER; do
  sleep 2
done

# Run migrations
docker exec escashop_backend_prod npm run migrate:prod

echo "Production database migration completed!"
```

### Step 6: Frontend Production Build Configuration

#### 6.1 Update Frontend Build Process

Update `frontend/package.json` scripts:

```json
{
  "scripts": {
    "build:production": "NODE_ENV=production GENERATE_SOURCEMAP=false react-scripts build",
    "build:analyze": "npm run build:production && npx webpack-bundle-analyzer build/static/js/*.js"
  }
}
```

#### 6.2 Remove Development Dependencies

Update frontend `Dockerfile` production stage:

```dockerfile
# Production stage
FROM base AS production
ENV NODE_ENV=production

# Copy production dependencies only
COPY --from=production-deps /app/node_modules ./node_modules

# Copy built application
COPY --from=build /app/build ./build

# Remove setupProxy.js in production
RUN rm -f src/setupProxy.js

# Install serve to run the production build
RUN npm install -g serve

# Switch to non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001
USER nextjs

EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
```

### Step 7: Production Docker Compose Updates

#### 7.1 Update Main Docker Compose

Update your `docker-compose.yml`:

```yaml
version: '3.8'

services:
  # Redis for caching and session management
  redis:
    image: redis:7-alpine
    container_name: escashop_redis_prod
    restart: unless-stopped
    command: redis-server --requirepass "$(cat /run/secrets/redis_password)"
    secrets:
      - redis_password
    volumes:
      - redis_data_prod:/data
    networks:
      - escashop_network_prod
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: production
    container_name: escashop_backend_prod
    restart: unless-stopped
    env_file:
      - backend/.env.production
    secrets:
      - db_password
      - redis_password
      - jwt_secret
      - jwt_refresh_secret
      - vonage_api_secret
      - email_password
      - google_sheets_api_key
    volumes:
      - ./backend/logs:/app/logs
      - ./backend/uploads:/app/uploads
    networks:
      - escashop_network_prod
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      target: production
    container_name: escashop_frontend_prod
    restart: unless-stopped
    env_file:
      - frontend/.env.production
    networks:
      - escashop_network_prod
    depends_on:
      - backend
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: escashop_nginx_prod
    restart: unless-stopped
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - ./backend/logs:/var/log/escashop
    ports:
      - "80:80"
      - "443:443"
    networks:
      - escashop_network_prod
    depends_on:
      - backend
      - frontend
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

# Docker Secrets
secrets:
  db_password:
    file: ./secrets/db_password.txt
  redis_password:
    file: ./secrets/redis_password.txt
  jwt_secret:
    file: ./secrets/jwt_secret.txt
  jwt_refresh_secret:
    file: ./secrets/jwt_refresh_secret.txt
  vonage_api_secret:
    file: ./secrets/vonage_api_secret.txt
  email_password:
    file: ./secrets/email_password.txt
  google_sheets_api_key:
    file: ./secrets/google_sheets_api_key.txt

# Named volumes
volumes:
  redis_data_prod:
    driver: local

# Custom network
networks:
  escashop_network_prod:
    driver: bridge
```

### Step 8: Testing and Validation

#### 8.1 Pre-deployment Testing Script

Create `scripts/test-production.sh`:

```bash
#!/bin/bash
set -e

echo "Starting production environment tests..."

# Build production images
docker-compose -f docker-compose.yml build --no-cache

# Start services
docker-compose -f docker-compose.yml up -d

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 30

# Health checks
echo "Running health checks..."
curl -f http://localhost/health || exit 1
curl -f https://localhost/api/health -k || exit 1

# API tests
echo "Testing API endpoints..."
curl -f https://localhost/api/auth/status -k || exit 1

# WebSocket test
echo "Testing WebSocket connection..."
# Add WebSocket connection test here

echo "All tests passed!"
```

#### 8.2 Load Testing

Create `scripts/load-test.sh`:

```bash
#!/bin/bash
# Install: apt-get install apache2-utils
ab -n 1000 -c 10 https://localhost/api/health
```

### Step 9: Monitoring and Logging

#### 9.1 Production Logging Configuration

Update `backend/.env.production`:

```env
# Logging
LOG_LEVEL=info
LOG_FILE=/app/logs/app.log
LOG_TO_FILE=true
ERROR_LOG_FILE=/app/logs/error.log
```

#### 9.2 Log Rotation Setup

Create `scripts/setup-logrotate.sh`:

```bash
#!/bin/bash
cat > /etc/logrotate.d/escashop << EOF
/path/to/escashop/backend/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF
```

### Step 10: Deployment Process

#### 10.1 Production Deployment Script

Create `scripts/deploy-production.sh`:

```bash
#!/bin/bash
set -e

echo "Starting production deployment..."

# Stop development environment
docker-compose -f docker-compose.dev.yml down

# Backup current production (if exists)
if [ "$(docker ps -q -f name=escashop_*_prod)" ]; then
    echo "Backing up current production..."
    docker-compose -f docker-compose.yml down
    # Create backup of volumes and data
fi

# Build and deploy production
echo "Building production images..."
docker-compose -f docker-compose.yml build --no-cache

echo "Starting production services..."
docker-compose -f docker-compose.yml up -d

# Wait for services
echo "Waiting for services to be healthy..."
timeout 300 bash -c 'until docker-compose -f docker-compose.yml ps | grep -q "healthy"; do sleep 5; done'

# Run health checks
echo "Running production health checks..."
./scripts/test-production.sh

echo "Production deployment completed successfully!"
echo "Access your application at: https://your-production-domain.com"
```

### Step 11: Security Hardening

#### 11.1 Firewall Configuration

```bash
# Allow only necessary ports
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw deny 3000/tcp  # Block direct frontend access
ufw deny 5000/tcp  # Block direct backend access
ufw deny 5432/tcp  # Block direct database access
ufw deny 6379/tcp  # Block direct Redis access
ufw enable
```

#### 11.2 Docker Security

```bash
# Run with non-root user
# Limit container resources
# Use read-only filesystems where possible
# Scan images for vulnerabilities
docker scan escashop_backend_prod
docker scan escashop_frontend_prod
```

### Step 12: Backup and Recovery

#### 12.1 Automated Backup Script

Create `scripts/backup-production.sh`:

```bash
#!/bin/bash
set -e

BACKUP_DIR="/backups/escashop/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# Backup database
docker exec escashop_backend_prod pg_dump -U $DB_USER -h $DB_HOST $DB_NAME | gzip > $BACKUP_DIR/database.sql.gz

# Backup volumes
docker run --rm -v escashop_redis_data_prod:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/redis_data.tar.gz -C /data .

# Backup application data
tar czf $BACKUP_DIR/uploads.tar.gz backend/uploads/
tar czf $BACKUP_DIR/logs.tar.gz backend/logs/

echo "Backup completed: $BACKUP_DIR"
```

## Key Differences Summary

| Component | Development | Production |
|-----------|------------|------------|
| **Proxy** | setupProxy.js middleware | Nginx reverse proxy |
| **SSL/TLS** | HTTP only | HTTPS with certificates |
| **Secrets** | Environment variables | Docker secrets |
| **Database** | Development data | Production data with backups |
| **Logging** | Debug level | Info level with rotation |
| **Monitoring** | Basic health checks | Full monitoring stack |
| **Security** | Development keys | Strong production secrets |
| **Caching** | Development Redis | Production Redis with persistence |

## Post-Migration Checklist

- [ ] All services start successfully
- [ ] Health checks pass
- [ ] SSL certificates are valid
- [ ] API endpoints respond correctly
- [ ] WebSocket connections work
- [ ] Authentication functions properly
- [ ] Database migrations completed
- [ ] Backups are configured
- [ ] Monitoring is active
- [ ] Logs are being collected
- [ ] Security hardening applied
- [ ] Performance testing completed
- [ ] Documentation updated

## Troubleshooting Common Issues

### SSL Certificate Issues
```bash
# Check certificate validity
openssl x509 -in nginx/ssl/escashop.pem -text -noout

# Test SSL configuration
openssl s_client -connect your-domain.com:443
```

### Database Connection Issues
```bash
# Test database connectivity
docker exec escashop_backend_prod psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1;"
```

### Nginx Configuration Issues
```bash
# Test nginx configuration
docker exec escashop_nginx_prod nginx -t

# Check nginx logs
docker logs escashop_nginx_prod
```

This migration guide ensures a smooth transition from your development environment to a production-ready setup with proper security, monitoring, and performance optimizations.
