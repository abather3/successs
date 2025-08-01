# Understanding ESCashop - Docker Development Mode

## Overview
ESCashop is a comprehensive queue management and point-of-sale system for eyewear shops. This document provides a complete understanding of all files that make up the system when running in Docker Development mode.

## System Architecture

### Core Services
The system consists of 4 main Docker services:
1. **PostgreSQL Database** - Data persistence and storage
2. **Redis** - Caching and session management  
3. **Backend API** - Node.js/Express application
4. **Frontend** - React application

## Docker Configuration Files

### 1. Main Docker Compose File
**File:** `docker-compose.dev.yml`

```yaml
# Key Services Configuration:
services:
  postgres:
    image: postgres:15-alpine
    container_name: escashop_postgres_dev
    environment:
      POSTGRES_DB: escashop
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres_secure_password_123
    ports:
      - "5432:5432"
    volumes:
      - postgres_data_dev:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d

  redis:
    image: redis:7-alpine
    container_name: escashop_redis_dev
    command: redis-server --requirepass "redis_secure_password_456"
    ports:
      - "6379:6379"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: development
    container_name: escashop_backend_dev
    ports:
      - "5000:5000"
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://postgres:postgres_secure_password_123@postgres:5432/escashop

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      target: development
    container_name: escashop_frontend_dev
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      REACT_APP_API_URL: ""
      REACT_APP_WS_URL: ws://localhost:5000
```

### 2. Backend Dockerfile
**File:** `backend/Dockerfile`

Multi-stage Docker build with development and production targets:
- **Base Stage:** Node.js 20 Alpine with system dependencies
- **Development Stage:** Includes all dependencies, runs with `npm run dev`
- **Production Stage:** Optimized build with only production dependencies

### 3. Frontend Dockerfile  
**File:** `frontend/Dockerfile`

Multi-stage build for React application:
- **Development Stage:** Hot-reload enabled, memory optimizations
- **Production Stage:** Optimized build served with `serve`

## Environment Configuration

### 1. Root Environment File
**File:** `.env`
```bash
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/escashop
JWT_SECRET=your-super-secret-jwt-key-change-in-production
FRONTEND_URL=http://localhost:3000
EMAIL_SERVICE_ENABLED=true
SMS_PROVIDER=vonage
```

### 2. Docker Environment File
**File:** `.env.docker`
```bash
NODE_ENV=production
COMPOSE_PROJECT_NAME=escashop
POSTGRES_DB=escashop
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
REDIS_PASSWORD=redis_secure_password_456
JWT_EXPIRES_IN=30m
ENABLE_UNIQUE_SETTLEMENT_INDEX=true
```

### 3. Frontend Development Environment
**File:** `frontend/.env.development`
```bash
DISABLE_ESLINT_PLUGIN=true
GENERATE_SOURCEMAP=false
SKIP_PREFLIGHT_CHECK=true
TSC_COMPILE_ON_ERROR=true
```

## Package Configuration

### 1. Backend Package.json
**File:** `backend/package.json`

**Key Scripts:**
- `dev`: Development mode with nodemon
- `build`: TypeScript compilation
- `start`: Production start with migrations
- `migrate`: Database migration execution
- `test`: Jest test runner

**Key Dependencies:**
- Express.js - Web framework
- PostgreSQL (pg) - Database client
- Socket.io - Real-time communication
- Argon2 - Password hashing
- JWT - Authentication tokens
- Redis (ioredis) - Caching client

### 2. Frontend Package.json
**File:** `frontend/package.json`

**Key Scripts:**
- `start`/`dev`: Development server
- `build`: Production build with memory optimization
- `test`: React testing library

**Key Dependencies:**
- React 19.1.0 - UI framework
- Material-UI (@mui) - Component library
- Axios - HTTP client
- Socket.io-client - Real-time communication
- React Router - Navigation
- Recharts - Data visualization

## Database System

### Database Initialization
**File:** `database/02-create-admin-user.sql`
```sql
-- Creates default admin user
INSERT INTO users (email, full_name, password_hash, role, status) 
VALUES (
    'admin@escashop.com',
    'System Administrator',
    '$argon2id$v=19$m=65536,t=3,p=1$...',  -- Password: admin123
    'admin',
    'active'
);
```

### Consolidated Migration System
**Directory:** `database/migrations_consolidated/`

The complete database schema is managed through 4 consolidated migration files:

#### 1. Base Schema Setup (001_base_schema_setup.sql)
**Purpose:** Creates the foundational database schema

**Core Tables Created:**
- `users` - System users (admin, cashiers, sales agents)
- `customers` - Customer information and queue data
- `transactions` - Financial transactions
- `payment_settlements` - Payment records
- `queue` - Queue management
- `activity_logs` - System activity tracking
- `notification_logs` - Notification history
- `system_settings` - Configuration settings
- `daily_reports` - Daily financial reports
- `grade_types` - Lens grade types
- `lens_types` - Lens type options
- `counters` - Service counters
- `sms_templates` - SMS message templates

**Key Features:**
- Foreign key constraints for data integrity
- Performance indexes on frequently queried columns
- Triggers for automatic `updated_at` timestamp updates
- Safe column additions with existence checks

#### 2. Initial Data Seeding (002_initial_data_seeding.sql)
**Purpose:** Inserts default data required for system operation

**Data Seeded:**
- Default admin user (`admin@escashop.com`)
- 17 different grade types (No Grade, Single Vision, Progressive, etc.)
- 8 lens types (non-coated, anti-radiation, photochromic, etc.)
- Default service counters (Counter 1, Counter 2)
- SMS templates for notifications
- System settings (queue reset, notifications, capacity limits)

#### 3. Enhanced Analytics and SMS (003_enhanced_analytics_sms.sql)
**Purpose:** Adds advanced queue analytics and SMS notification systems

**New Tables:**
- `queue_analytics` - Hourly queue metrics
- `daily_queue_summary` - Daily aggregated queue data
- `queue_events` - Detailed queue event tracking
- `sms_notifications` - SMS delivery tracking
- `customer_notifications` - Enhanced notification system

**Features:**
- Queue performance metrics (wait times, service times, peak hours)
- SMS delivery status tracking
- Customer notification management with retry logic
- Analytics indexes for performance optimization

#### 4. Payment System Enhancements (004_payment_system_enhancements.sql)
**Purpose:** Advanced payment tracking and duplicate prevention

**Enhancements:**
- `payment_tracking` table for detailed payment monitoring
- Unique constraints to prevent duplicate settlements
- Automatic payment status calculation triggers
- Enhanced daily reports with JSONB funds tracking
- Payment gateway integration support

**Key Functions:**
- `update_transaction_payment_status()` - Auto-calculates payment status
- Triggers for real-time payment status updates
- Performance indexes for payment queries

### Additional Database Files

#### Backend Database Initialization
**File:** `backend/src/database/init.sql`
- Complements consolidated migrations
- Ensures backward compatibility
- Creates analytics tables if not exists
- Adds default data for counters and types

#### Balance Calculation Fix
**File:** `database/fix_balance_calculations.sql`
- Fixes existing transaction balance calculations
- Creates triggers for automatic balance updates
- Ensures data consistency across payment settlements

## System Features

### Core Functionality
1. **User Management**
   - Role-based access (admin, cashier, sales agent)
   - Authentication with JWT tokens
   - Password reset functionality

2. **Customer Management**
   - Customer registration and profile management
   - Queue position tracking
   - Priority scoring system
   - Token number generation

3. **Queue Management**
   - Real-time queue updates via WebSocket
   - Multiple service counters
   - Priority queue handling
   - Queue analytics and reporting

4. **Payment Processing**
   - Multiple payment methods (cash, GCash, Maya, etc.)
   - Partial payment support
   - Settlement tracking
   - Balance calculations with triggers

5. **Analytics and Reporting**
   - Daily queue summaries
   - Customer service metrics
   - Payment analytics
   - Historical data tracking

6. **Notification System**
   - SMS notifications via Vonage
   - Email notifications
   - Real-time WebSocket updates
   - Notification delivery tracking

## Development Workflow

### Starting the System
```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# Check service status
docker-compose -f docker-compose.dev.yml ps

# View logs
docker-compose -f docker-compose.dev.yml logs -f backend
```

### Database Migration
The system automatically runs migrations on backend startup:
1. Consolidated migrations are executed in order (001 → 004)
2. Individual migration files are applied as needed
3. Migration status is tracked in `schema_migrations` table

### Development URLs
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000
- **Database:** localhost:5432
- **Redis:** localhost:6379

### Default Credentials
- **Admin User:** admin@escashop.com
- **Password:** admin123

## Network Architecture

### Docker Network
- **Network Name:** escashop_network_dev
- **Type:** Bridge network
- **Subnet:** 172.21.0.0/16

### Inter-Service Communication
- Backend connects to PostgreSQL via hostname `postgres`
- Backend connects to Redis via hostname `redis`
- Frontend proxies API requests to `backend:5000`
- WebSocket connections for real-time updates

## Data Persistence

### Docker Volumes
- `postgres_data_dev` - PostgreSQL data persistence
- `redis_data_dev` - Redis data persistence
- `./backend/logs` - Application logs
- `./backend/uploads` - File uploads

## Security Considerations

### Development Security
- Database passwords are hardcoded for development
- JWT secrets are development-only values
- CORS is configured for localhost access
- File upload limits are enforced

### Production Notes
- All secrets should be moved to Docker secrets
- Environment variables should be externalized
- HTTPS should be enabled with proper certificates
- Database access should be restricted

## Troubleshooting

### Common Issues
1. **Port Conflicts:** Ensure ports 3000, 5000, 5432, 6379 are available
2. **Memory Issues:** Frontend build may require increased Docker memory
3. **Permission Issues:** Ensure Docker has access to project directories
4. **Database Connection:** Check if PostgreSQL container is healthy

### Health Checks
All services include health checks:
- **PostgreSQL:** `pg_isready` command
- **Redis:** Redis ping command  
- **Backend:** HTTP health endpoint
- **Frontend:** HTTP availability check

## File Structure Summary

```
escashop/
├── docker-compose.dev.yml          # Main development compose file
├── .env                           # Root environment variables
├── .env.docker                    # Docker-specific environment
├── backend/
│   ├── Dockerfile                 # Backend container definition
│   ├── package.json              # Backend dependencies and scripts
│   └── src/database/init.sql      # Backend database initialization
├── frontend/
│   ├── Dockerfile                 # Frontend container definition
│   ├── package.json              # Frontend dependencies and scripts
│   └── .env.development          # Frontend development settings
└── database/
    ├── 02-create-admin-user.sql   # Admin user creation
    ├── fix_balance_calculations.sql # Balance fix script
    └── migrations_consolidated/    # Complete migration system
        ├── 001_base_schema_setup.sql
        ├── 002_initial_data_seeding.sql
        ├── 003_enhanced_analytics_sms.sql
        └── 004_payment_system_enhancements.sql
```

This documentation provides a complete understanding of the ESCashop system architecture, configuration, and operational aspects in Docker development mode.
