#!/bin/bash

# Railway Deployment Script for EscaShop
# This script helps deploy EscaShop to Railway with proper configuration

set -e

echo "🚀 Starting Railway deployment for EscaShop..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="escashop"
BACKEND_SERVICE_NAME="backend"
FRONTEND_SERVICE_NAME="frontend"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Railway CLI is installed
check_railway_cli() {
    if ! command -v railway &> /dev/null; then
        print_error "Railway CLI is not installed. Please install it first:"
        echo "npm install -g @railway/cli"
        exit 1
    fi
    print_success "Railway CLI is installed"
}

# Check if user is logged in to Railway
check_railway_auth() {
    if ! railway whoami &> /dev/null; then
        print_error "You are not logged in to Railway. Please run:"
        echo "railway login"
        exit 1
    fi
    print_success "Railway authentication verified"
}

# Check if environment variables are set
check_environment_variables() {
    print_status "Checking required environment variables..."
    
    REQUIRED_VARS=(
        "DATABASE_URL"
        "JWT_SECRET"
        "JWT_REFRESH_SECRET"
        "FRONTEND_URL"
    )
    
    MISSING_VARS=()
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            MISSING_VARS+=("$var")
        fi
    done
    
    if [ ${#MISSING_VARS[@]} -ne 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${MISSING_VARS[@]}"; do
            echo "  - $var"
        done
        print_warning "Please set these variables in Railway dashboard or .env.railway file"
        return 1
    fi
    
    print_success "All required environment variables are set"
}

# Deploy backend service
deploy_backend() {
    print_status "Deploying backend service..."
    
    cd backend
    
    # Check if backend railway.toml exists
    if [ ! -f "railway.toml" ]; then
        print_warning "Backend railway.toml not found, creating one..."
        cat > railway.toml << EOF
[build]
builder = "NIXPACKS"
buildCommand = "npm run build"

[deploy]
startCommand = "npm start"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"

[env]
NODE_ENV = "production"
EOF
    fi
    
    # Deploy backend
    railway up --service $BACKEND_SERVICE_NAME
    
    cd ..
    print_success "Backend deployed successfully"
}

# Deploy frontend service
deploy_frontend() {
    print_status "Deploying frontend service..."
    
    cd frontend
    
    # Check if frontend railway.toml exists
    if [ ! -f "railway.toml" ]; then
        print_warning "Frontend railway.toml not found, creating one..."
        cat > railway.toml << EOF
[build]
builder = "NIXPACKS"
buildCommand = "npm run build"

[deploy]
startCommand = "npm run start"
healthcheckPath = "/"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"

[env]
NODE_ENV = "production"
EOF
    fi
    
    # Deploy frontend
    railway up --service $FRONTEND_SERVICE_NAME
    
    cd ..
    print_success "Frontend deployed successfully"
}

# Run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Check if migration script exists
    if [ -f "scripts/railway-migrate.sh" ]; then
        bash scripts/railway-migrate.sh
    else
        print_warning "Migration script not found. You may need to run migrations manually."
        print_status "To run migrations on Railway:"
        echo "1. Connect to your Railway project"
        echo "2. Use Railway's built-in shell or connect to the database directly"
        echo "3. Run your SQL migration files"
    fi
}

# Check deployment health
check_deployment_health() {
    print_status "Checking deployment health..."
    
    # Get service URLs from Railway
    BACKEND_URL=$(railway url --service $BACKEND_SERVICE_NAME 2>/dev/null || echo "")
    FRONTEND_URL=$(railway url --service $FRONTEND_SERVICE_NAME 2>/dev/null || echo "")
    
    if [ -n "$BACKEND_URL" ]; then
        print_status "Backend URL: $BACKEND_URL"
        # Check health endpoint
        if curl -f "$BACKEND_URL/health" &> /dev/null; then
            print_success "Backend health check passed"
        else
            print_warning "Backend health check failed - service may still be starting"
        fi
    fi
    
    if [ -n "$FRONTEND_URL" ]; then
        print_status "Frontend URL: $FRONTEND_URL"
        print_success "Frontend deployment completed"
    fi
}

# Main deployment function
main() {
    print_status "Starting Railway deployment process..."
    
    # Pre-deployment checks
    check_railway_cli
    check_railway_auth
    
    # Load environment variables from .env.railway if it exists
    if [ -f ".env.railway" ]; then
        print_status "Loading environment variables from .env.railway"
        set -a  # automatically export all variables
        source .env.railway
        set +a  # stop automatically exporting
    fi
    
    # Check environment variables
    if ! check_environment_variables; then
        print_error "Environment variable check failed. Please fix and try again."
        exit 1
    fi
    
    # Deploy services
    deploy_backend
    deploy_frontend
    
    # Run migrations
    run_migrations
    
    # Check deployment health
    check_deployment_health
    
    print_success "🎉 Deployment completed!"
    print_status "Your EscaShop application should now be running on Railway."
    print_status "Check the Railway dashboard for service URLs and logs."
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "backend")
        deploy_backend
        ;;
    "frontend")
        deploy_frontend
        ;;
    "migrate")
        run_migrations
        ;;
    "health")
        check_deployment_health
        ;;
    "check")
        check_railway_cli
        check_railway_auth
        check_environment_variables
        ;;
    *)
        echo "Usage: $0 [deploy|backend|frontend|migrate|health|check]"
        echo ""
        echo "Commands:"
        echo "  deploy    - Full deployment (default)"
        echo "  backend   - Deploy backend service only"
        echo "  frontend  - Deploy frontend service only" 
        echo "  migrate   - Run database migrations"
        echo "  health    - Check deployment health"
        echo "  check     - Check prerequisites"
        exit 1
        ;;
esac
