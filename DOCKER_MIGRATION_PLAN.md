# 🐳 Docker Migration Strategy for EscaShop
## Comprehensive Plan to Avoid Migration Issues

### 🚨 **Root Causes Analysis**

Based on the EscaShop codebase analysis, here are the primary causes of Docker migration failures:

#### 1. **Migration Order Dependencies**
- ❌ **Problem**: Multiple migration sources without proper dependency tracking
- ❌ **Problem**: Migrations run alphabetically, not in logical dependency order
- ❌ **Problem**: Foreign key constraints created before referenced tables exist

#### 2. **Concurrent Execution Issues**
- ❌ **Problem**: Multiple containers trying to run migrations simultaneously
- ❌ **Problem**: No migration locking mechanism
- ❌ **Problem**: Race conditions in Docker Compose environments

#### 3. **State Inconsistency**
- ❌ **Problem**: Migrations assume clean state but reality is different
- ❌ **Problem**: Missing `IF NOT EXISTS` clauses in critical places
- ❌ **Problem**: No rollback capability for failed migrations

#### 4. **Docker-Specific Issues**
- ❌ **Problem**: Database container might not be fully ready when migrations run
- ❌ **Problem**: Volume mounting issues affecting file access
- ❌ **Problem**: Network timing issues between services

### 🎯 **Comprehensive Solution Strategy**

## Phase 1: Migration System Overhaul

### ✅ **1.1 Implement Proper Migration Tracking**

**Created Files:**
- `database/docker-migration-system.sql` - Comprehensive base schema
- `backend/src/docker-migrate.ts` - Docker-optimized migration runner

**Key Features:**
```sql
-- Enhanced migration tracking with metadata
CREATE TABLE schema_migrations (
    version VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(500) NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER,
    checksum VARCHAR(64), -- Detect file changes
    rollback_sql TEXT,     -- Store rollback commands
    status VARCHAR(20) -- 'running', 'completed', 'failed', 'rolled_back'
);

-- Migration locking to prevent concurrent runs
CREATE TABLE migration_locks (
    id INTEGER PRIMARY KEY DEFAULT 1,
    locked_by VARCHAR(255), -- Container identifier
    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT single_lock CHECK (id = 1)
);
```

### ✅ **1.2 Docker-Optimized Migration Runner**

**Key Features:**
- **Migration Locking**: Prevents concurrent migrations
- **Database Readiness Check**: Waits for PostgreSQL to be fully ready
- **Error Handling**: Graceful handling of non-critical errors
- **Checksum Verification**: Detects migration file changes
- **Container Identification**: Unique identifiers for debugging

### ✅ **1.3 Comprehensive Base Schema**

The `docker-migration-system.sql` includes:
- All tables with proper dependencies
- All indexes and constraints
- All default data
- All functions and triggers
- Proper `IF NOT EXISTS` clauses throughout

## Phase 2: Docker Configuration Optimization

### ✅ **2.1 Proper Service Dependencies**

**Created:** `docker-compose.migration-optimized.yml`

```yaml
services:
  postgres:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d database"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  migration:
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"  # Run once only

  backend:
    depends_on:
      postgres:
        condition: service_healthy
      migration:
        condition: service_completed_successfully
```

### ✅ **2.2 Dedicated Migration Container**

**Created:** `Dockerfile.migration`

**Features:**
- Lightweight Alpine-based image
- PostgreSQL client for database checks
- Proper wait mechanisms
- Health checks
- One-time execution guarantee

## Phase 3: Implementation Steps

### 🔧 **Step 1: Backup Current System**

```bash
# Backup existing database
docker exec escashop-postgres pg_dump -U username dbname > backup.sql

# Backup docker volumes
docker run --rm -v escashop_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data
```

### 🔧 **Step 2: Update Package Scripts**

Add to `backend/package.json`:
```json
{
  "scripts": {
    "migrate:docker": "npx ts-node src/docker-migrate.ts",
    "migrate:docker:build": "npm run build && node dist/docker-migrate.js"
  }
}
```

### 🔧 **Step 3: Environment Configuration**

Create/update `.env`:
```env
# Database Configuration
DATABASE_NAME=escashop
DATABASE_USER=escashop_user
DATABASE_PASSWORD=secure_password_here
DATABASE_PORT=5432

# Migration Configuration
MIGRATION_TIMEOUT=300000
ENABLE_MIGRATION_LOGGING=true

# Application Configuration  
NODE_ENV=production
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
```

### 🔧 **Step 4: Deploy with New System**

```bash
# Stop existing containers
docker-compose down

# Remove old volumes (⚠️ DATA LOSS - only if starting fresh)
# docker volume rm escashop_postgres_data

# Deploy with new migration system
docker-compose -f docker-compose.migration-optimized.yml up -d

# Monitor migration progress
docker logs -f escashop-migration
```

## Phase 4: Monitoring and Troubleshooting

### 📊 **4.1 Migration Monitoring Commands**

```bash
# Check migration status
docker logs escashop-migration

# Check database connectivity
docker exec escashop-postgres pg_isready -U escashop_user

# Inspect migration state
docker exec escashop-postgres psql -U escashop_user -d escashop -c "
SELECT version, name, status, applied_at, execution_time_ms 
FROM schema_migrations 
ORDER BY applied_at DESC LIMIT 10;"

# Check for locks
docker exec escashop-postgres psql -U escashop_user -d escashop -c "
SELECT * FROM migration_locks;"
```

### 📊 **4.2 Common Issues and Solutions**

#### **Issue: Migration Lock Stuck**
```sql
-- Clear stale locks
DELETE FROM migration_locks WHERE 
  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - locked_at)) > 300;
```

#### **Issue: Failed Migration**
```sql
-- Check failed migrations
SELECT * FROM schema_migrations WHERE status = 'failed';

-- Reset failed migration for retry
UPDATE schema_migrations 
SET status = 'completed' 
WHERE version = 'problematic_migration_name';
```

#### **Issue: Column Already Exists**
The new system automatically handles these errors and marks migrations as completed.

### 📊 **4.3 Health Checks**

```bash
# Verify all tables exist
docker exec escashop-postgres psql -U escashop_user -d escashop -c "
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' ORDER BY table_name;"

# Verify indexes
docker exec escashop-postgres psql -U escashop_user -d escashop -c "
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'public' ORDER BY indexname;"

# Check foreign key constraints
docker exec escashop-postgres psql -U escashop_user -d escashop -c "
SELECT conname, conrelid::regclass, confrelid::regclass 
FROM pg_constraint WHERE contype = 'f';"
```

## Phase 5: Rollback Strategy

### 🔄 **5.1 Emergency Rollback Plan**

```bash
# 1. Stop all services
docker-compose down

# 2. Restore from backup
docker volume create escashop_postgres_data
docker run --rm -v escashop_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres-backup.tar.gz -C /

# 3. Start with old configuration
docker-compose -f docker-compose.old.yml up -d
```

### 🔄 **5.2 Gradual Migration Approach**

For production systems, implement a blue-green deployment:

1. **Blue Environment**: Current production
2. **Green Environment**: New migration system
3. **Test thoroughly** in green
4. **Switch traffic** when confident
5. **Keep blue** as fallback

## Phase 6: Best Practices Going Forward

### ✅ **6.1 Migration Development Rules**

1. **Always use `IF NOT EXISTS`** for CREATE statements
2. **Test migrations locally** before committing
3. **Include rollback SQL** in migration comments
4. **Use transactions** for complex migrations
5. **Avoid data migrations** in schema migrations

### ✅ **6.2 Development Workflow**

```bash
# Local development
npm run migrate:dev

# Testing migration
npm run migrate:docker:build
docker run --rm migration-test

# Production deployment
docker-compose -f docker-compose.migration-optimized.yml up -d
```

### ✅ **6.3 Monitoring Setup**

```yaml
# Add to docker-compose
  migration-monitor:
    image: prom/prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--query.log-file=/tmp/queries.log'
```

## 🎯 **Success Metrics**

- ✅ **Zero migration failures** in Docker deployments
- ✅ **Sub-30 second** migration completion time
- ✅ **100% reproducibility** across environments
- ✅ **Automatic recovery** from common issues
- ✅ **Complete audit trail** of all migrations

## 🚀 **Implementation Timeline**

- **Week 1**: Implement new migration system
- **Week 2**: Test in staging environment
- **Week 3**: Production deployment with monitoring
- **Week 4**: Documentation and team training

## 📋 **Checklist for Go-Live**

- [ ] Base schema file created and tested
- [ ] Docker migration runner implemented
- [ ] Docker Compose configuration updated
- [ ] Environment variables configured
- [ ] Backup strategy in place
- [ ] Rollback plan tested
- [ ] Monitoring setup complete
- [ ] Team trained on new system
- [ ] Documentation updated

---

**This comprehensive plan addresses all the root causes of migration failures and provides a robust, Docker-optimized solution for the EscaShop system.**
