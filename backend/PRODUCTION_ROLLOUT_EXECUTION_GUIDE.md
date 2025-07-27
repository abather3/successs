# 🚀 PRODUCTION ROLLOUT EXECUTION GUIDE
**Date:** July 22, 2025  
**Target:** Deploy before 23:59 PH Time  
**Current Time:** 00:42 PH (23 hours 18 minutes remaining)

## 📋 QUICK REFERENCE

| **Phase** | **Time (PH)** | **Duration** | **Script/Action** |
|-----------|---------------|--------------|-------------------|
| Pre-deployment | 21:00-21:15 | 15 min | Manual checks + backup verification |
| **Maintenance Announcement** | 21:15-21:30 | 15 min | `./scripts/announce-maintenance.sh` |
| **Database Migration** | 21:30-22:30 | 60 min | `./scripts/production-deploy.sh --production` |
| **Code Deployment** | 22:30-23:15 | 45 min | (Included in deploy script) |
| System Verification | 23:15-23:45 | 30 min | Manual testing + health checks |
| **Reset Monitoring** | 23:45-00:05 | 20 min | `./scripts/midnight-reset-monitor.sh` |

---

## ⚡ IMMEDIATE SETUP (Before 21:00 PH)

### 1. Environment Configuration
```bash
# 1. Copy and configure production environment
cp .env.production.template .env.production

# 2. Edit .env.production with actual production values:
# - DATABASE_URL=postgresql://user:pass@prod-host:5432/escashop_prod
# - JWT_SECRET=your-256-bit-production-secret
# - JWT_REFRESH_SECRET=your-different-256-bit-secret
# - SMS_PROVIDER=vonage (or your chosen provider)
# - VONAGE_API_KEY=your-production-api-key
# - VONAGE_API_SECRET=your-production-secret
# - NODE_ENV=production
```

### 2. Pre-deployment Verification
```bash
# Verify all migration files exist
ls -la src/database/migrations/

# Test database connectivity (replace with your production URL)
export PRODUCTION_DATABASE_URL="postgresql://user:pass@host:5432/db"
psql $PRODUCTION_DATABASE_URL -c "SELECT version();"

# Verify Docker is available
docker --version

# Build and test locally first
npm run build:prod
npm test
```

---

## 🕘 21:00-21:15 PH: PRE-DEPLOYMENT CHECKLIST

### ✅ Critical Verifications
- [ ] Production database accessible
- [ ] `.env.production` configured with real values
- [ ] All migration files present and valid
- [ ] Docker service running
- [ ] Backup storage available
- [ ] Monitoring tools ready

### Commands to Run:
```bash
# Test production database connection
psql $PRODUCTION_DATABASE_URL -c "SELECT COUNT(*) FROM customers;"

# Verify current production system status
curl -f http://production-domain/health

# Check disk space for backups
df -h

# Verify scripts are ready
ls -la scripts/
```

---

## 🔊 21:15-21:30 PH: MAINTENANCE ANNOUNCEMENT

### Execute Announcement:
```bash
# Run maintenance announcement script
./scripts/announce-maintenance.sh
```

**Expected Output:**
- System notifications sent
- Maintenance banner activated  
- WebSocket broadcasts to connected users
- Countdown timer started
- Reminder scheduler activated

**Manual Fallback (if script fails):**
1. Post maintenance notice on admin dashboard
2. Send notifications via admin panel
3. Update system status page
4. Notify staff via communication channels

---

## 🚀 21:30-23:15 PH: PRODUCTION DEPLOYMENT

### Primary Deployment Command:
```bash
# Execute full production deployment
export PRODUCTION_DATABASE_URL="your-production-db-url"
./scripts/production-deploy.sh --production
```

### What This Script Does:
1. **Pre-deployment verification** (file checks, DB connectivity)
2. **Database backup** creation (`./backups/prod_backup_*.sql`)
3. **Build production code** (`npm run build:prod`)
4. **Run final tests** (`npm test`)
5. **Apply database migrations** (`npm run migrate`)
6. **Build Docker image** (`escashop-backend:TIMESTAMP`)
7. **Deploy new container** (stop old, start new)
8. **Health checks** (API endpoints, DB connectivity)
9. **Smoke tests** (core functionality)
10. **Setup monitoring** for midnight reset

### Manual Steps if Script Fails:

#### Database Migration Only:
```bash
# If only migrations need to be applied
npm run build:prod
export NODE_ENV=production
npm run migrate
```

#### Manual Docker Deployment:
```bash
# Build image
docker build -t escashop-backend:manual .

# Stop existing
docker stop escashop-backend-prod || true
docker rm escashop-backend-prod || true

# Start new container
docker run -d \
  --name escashop-backend-prod \
  --env-file .env.production \
  --restart unless-stopped \
  -p 5000:5000 \
  escashop-backend:manual npm run start
```

#### Health Check Commands:
```bash
# Wait for startup
sleep 30

# Test endpoints
curl -f http://localhost:5000/health
curl -f http://localhost:5000/api/auth/status  
curl -f http://localhost:5000/api/queue/status
curl -f http://localhost:5000/api/scheduler/status
```

---

## ✅ 23:15-23:45 PH: SYSTEM VERIFICATION

### Critical Tests to Perform:

#### 1. API Functionality
```bash
# Test core endpoints
curl -X GET http://localhost:5000/health
curl -X GET http://localhost:5000/api/queue/status
curl -X GET http://localhost:5000/api/analytics/dashboard
```

#### 2. Database Connectivity  
```bash
curl -X GET http://localhost:5000/api/health/database
```

#### 3. WebSocket Functionality
```bash
# Test WebSocket connection (if endpoint exists)
curl -X GET http://localhost:5000/api/websocket/health
```

#### 4. Queue System Operations
```bash
# Test queue join/status (replace with actual endpoints)
curl -X POST http://localhost:5000/api/queue/join \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","phone":"09123456789"}'
```

#### 5. Scheduler Status
```bash
# Verify scheduler is ready for midnight reset
curl -X GET http://localhost:5000/api/scheduler/status
```

### Expected Results:
- [ ] All APIs return 200 status codes
- [ ] Database queries execute successfully  
- [ ] WebSocket connections establish properly
- [ ] Queue operations work correctly
- [ ] Scheduler shows "ready" status
- [ ] No error messages in application logs

---

## 🌙 23:45-00:05 PH: MIDNIGHT RESET MONITORING

### Start Intensive Monitoring:
```bash
# Launch midnight reset monitoring script
./scripts/midnight-reset-monitor.sh
```

### Manual Monitoring Commands:

#### Watch Application Logs:
```bash
# Monitor container logs for reset activity
docker logs -f escashop-backend-prod | grep -E "(reset|midnight|scheduler)"
```

#### Check System Status:
```bash
# Monitor system health during reset
watch -n 5 'curl -s http://localhost:5000/health'
```

#### Database Activity Monitoring:
```bash
# Connect to production DB and watch for reset activity
psql $PRODUCTION_DATABASE_URL -c "
SELECT 
  schemaname,
  tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes
FROM pg_stat_user_tables 
WHERE tablename LIKE '%queue%' OR tablename LIKE '%customer%'
ORDER BY schemaname, tablename;
"
```

### 🎯 Critical Time Points to Watch:

| **Time** | **Expected Activity** | **What to Monitor** |
|----------|----------------------|---------------------|
| **23:59:00** | Reset initiation | Scheduler logs, "Starting daily queue reset" |
| **23:59:30** | Reset in progress | Database activity, snapshot creation |
| **00:00:00** | **MIDNIGHT EXECUTION** | Queue archival, counters reset |
| **00:00:30** | Reset completion | Success messages, transaction commit |
| **00:01:00** | Post-reset verification | System status, queue state |
| **00:02:00** | Final checks | API responsiveness, data integrity |
| **00:05:00** | Monitoring complete | All systems operational |

### Expected Log Messages:
```
🕐 Daily Queue Reset Scheduler triggered
🚀 Starting daily queue reset at 2025-07-23 00:00:00 Philippine Time  
Daily snapshot created: {totalCustomers: X, completedCustomers: Y}
Queue data archived successfully
Analytics updated with final metrics
Active queue reset completed  
Daily counters reset
Reset activity logged
✅ Daily reset completed successfully in XXXXms
```

---

## 🚨 EMERGENCY PROCEDURES

### If Deployment Fails:

#### Quick Rollback:
```bash
# Stop failed deployment
docker stop escashop-backend-prod

# Restore previous version (if available)
docker run -d --name escashop-backend-prod \
  --env-file .env.production \
  -p 5000:5000 \
  escashop-backend:previous npm run start
```

#### Database Rollback:
```bash
# Find backup file
ls -la backups/

# Restore database (DANGER: This overwrites current data)
psql $PRODUCTION_DATABASE_URL < backups/prod_backup_YYYYMMDD_HHMMSS.sql
```

### If Midnight Reset Fails:

#### Manual Reset Trigger:
```bash
# Trigger manual reset (if endpoint exists)
curl -X POST http://localhost:5000/api/scheduler/trigger-reset \
  -H "Authorization: Bearer admin-token"
```

#### Database Manual Reset:
```bash
# Connect to production database
psql $PRODUCTION_DATABASE_URL

# Execute reset manually (CAREFUL!)
BEGIN;
-- Archive current queue data
INSERT INTO daily_queue_history (...) SELECT ... FROM customers;
-- Reset queue status
UPDATE customers SET queue_status = 'pending' WHERE queue_status = 'waiting';  
-- Reset counters
UPDATE system_settings SET daily_customer_count = 0;
COMMIT;
```

### Contact Information:
- **Primary Engineer:** [Your contact info]
- **Database Admin:** [DBA contact info]  
- **Operations Team:** [Ops contact info]
- **Emergency Escalation:** [Manager contact info]

---

## 📊 SUCCESS CRITERIA CHECKLIST

### Deployment Success:
- [ ] All database migrations applied without errors
- [ ] New Docker container running and healthy
- [ ] All API endpoints responding (< 2 second response time)
- [ ] Database connectivity confirmed
- [ ] WebSocket functionality operational
- [ ] Queue system accepting new customers
- [ ] Authentication system working
- [ ] No critical errors in application logs

### Midnight Reset Success:
- [ ] Reset triggered automatically at 00:00:00 PH
- [ ] Daily snapshot created successfully
- [ ] Queue data archived to history tables
- [ ] Analytics updated with daily metrics  
- [ ] Active queue reset (preserving customer data)
- [ ] Daily counters reset to 0
- [ ] Reset completed within 2 minutes
- [ ] System fully operational by 00:05:00 PH
- [ ] No data corruption or loss
- [ ] All services responding normally

---

## 📋 POST-DEPLOYMENT ACTIONS

### Immediate (00:05-00:30 PH):
1. **Disable maintenance banner**
   ```bash
   curl -X POST http://localhost:5000/api/admin/maintenance-banner \
     -H "Content-Type: application/json" \
     -d '{"enabled": false}'
   ```

2. **Send completion notification**
   ```bash
   curl -X POST http://localhost:5000/api/admin/notifications \
     -H "Content-Type: application/json" \
     -d '{"title": "Deployment Complete", "message": "System updated successfully", "priority": "info"}'
   ```

3. **Verify system metrics**
   ```bash
   docker stats escashop-backend-prod --no-stream
   ```

### Within 24 Hours:
- [ ] Monitor error logs for any post-deployment issues
- [ ] Check performance metrics (response times, memory usage)
- [ ] Verify backup processes are working
- [ ] Update documentation with any changes
- [ ] Conduct post-deployment review meeting

### Weekly:
- [ ] Review deployment logs and metrics
- [ ] Update rollout procedures based on lessons learned
- [ ] Ensure monitoring and alerting are properly configured
- [ ] Schedule regular backup verification

---

## 📁 FILES CREATED FOR THIS ROLLOUT

| **File** | **Purpose** |
|----------|-------------|
| `production-rollout-plan.md` | Detailed rollout plan with timeline |
| `scripts/production-deploy.sh` | Main deployment automation script |
| `scripts/announce-maintenance.sh` | Maintenance window announcement |
| `scripts/midnight-reset-monitor.sh` | Intensive reset monitoring |
| `.env.production.template` | Production environment template |
| `PRODUCTION_ROLLOUT_EXECUTION_GUIDE.md` | This execution guide |

---

## ⏰ FINAL COUNTDOWN

**Current Time:** 00:42 PH (July 22, 2025)  
**Time Until Maintenance:** ~20 hours 48 minutes  
**Time Until Midnight Reset:** ~23 hours 18 minutes

### Key Milestones:
- **17:30 PH:** 4-hour warning reminder
- **20:30 PH:** Final 1-hour warning  
- **21:00 PH:** Begin pre-deployment checks
- **21:15 PH:** 🔊 **ANNOUNCE MAINTENANCE**
- **21:30 PH:** 🚀 **BEGIN DEPLOYMENT**  
- **23:15 PH:** ✅ **VERIFY DEPLOYMENT**
- **23:45 PH:** 👀 **START RESET MONITORING**
- **23:59 PH:** 🎯 **INTENSIVE MONITORING**
- **00:00 PH:** 🌙 **MIDNIGHT RESET EXECUTION**
- **00:05 PH:** 🎉 **ROLLOUT COMPLETE**

---

**Ready for production rollout! 🚀**

All scripts are prepared, timeline is set, and monitoring is ready.  
Execute each phase according to the schedule above.  
Monitor logs closely and be prepared for emergency procedures if needed.

**Good luck with the deployment! 🍀**
