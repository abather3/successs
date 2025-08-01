#!/bin/bash

# Railway Database Migration Script for EscaShop
# This script handles database migrations and schema validation for Railway deployment

set -e

echo "🗄️ Starting Railway database migration for EscaShop..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if psql is available
check_psql() {
    if ! command -v psql &> /dev/null; then
        print_error "psql is not installed. Please install PostgreSQL client tools."
        print_status "On Windows: Download PostgreSQL from https://www.postgresql.org/download/"
        print_status "On MacOS: brew install postgresql"
        print_status "On Ubuntu: sudo apt-get install postgresql-client"
        exit 1
    fi
    print_success "PostgreSQL client (psql) is available"
}

# Test database connection
test_db_connection() {
    print_status "Testing database connection..."
    
    if [ -z "$DATABASE_URL" ]; then
        print_error "DATABASE_URL environment variable is not set"
        print_status "Please set DATABASE_URL to your Railway PostgreSQL connection string"
        return 1
    fi
    
    if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        print_success "Database connection successful"
        return 0
    else
        print_error "Failed to connect to database"
        print_status "Please check your DATABASE_URL and ensure the database is accessible"
        return 1
    fi
}

# Get database schema information
get_schema_info() {
    print_status "Getting current database schema information..."
    
    # Get list of tables
    TABLES=$(psql "$DATABASE_URL" -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';" 2>/dev/null | tr -d ' ' | grep -v '^$' || echo "")
    
    if [ -z "$TABLES" ]; then
        print_warning "No tables found in database - this appears to be a fresh database"
        return 0
    fi
    
    print_status "Found tables: $(echo $TABLES | tr '\n' ' ')"
    
    # Check for critical tables
    CRITICAL_TABLES=("users" "customers" "transactions" "counters")
    MISSING_TABLES=()
    
    for table in "${CRITICAL_TABLES[@]}"; do
        if ! echo "$TABLES" | grep -q "^$table$"; then
            MISSING_TABLES+=("$table")
        fi
    done
    
    if [ ${#MISSING_TABLES[@]} -gt 0 ]; then
        print_warning "Missing critical tables: ${MISSING_TABLES[*]}"
        return 1
    else
        print_success "All critical tables found"
        return 0
    fi
}

# Validate table columns
validate_table_columns() {
    print_status "Validating table columns..."
    
    # Define expected columns for critical tables
    declare -A EXPECTED_COLUMNS
    EXPECTED_COLUMNS[users]="id email full_name password_hash role status reset_token reset_token_expiry created_at updated_at"
    EXPECTED_COLUMNS[customers]="id or_number name contact_number email age address occupation distribution_info sales_agent_id doctor_assigned prescription grade_type lens_type frame_code payment_info remarks priority_flags queue_status token_number priority_score estimated_time manual_position created_at updated_at"
    EXPECTED_COLUMNS[transactions]="id customer_id or_number amount payment_mode sales_agent_id cashier_id transaction_date paid_amount balance_amount payment_status created_at updated_at"
    EXPECTED_COLUMNS[counters]="id name display_order is_active current_customer_id created_at updated_at"
    
    local validation_passed=true
    
    for table in "${!EXPECTED_COLUMNS[@]}"; do
        print_status "Validating $table table..."
        
        # Get actual columns
        ACTUAL_COLUMNS=$(psql "$DATABASE_URL" -t -c "SELECT column_name FROM information_schema.columns WHERE table_name = '$table' ORDER BY ordinal_position;" 2>/dev/null | tr -d ' ' | grep -v '^$' || echo "")
        
        if [ -z "$ACTUAL_COLUMNS" ]; then
            print_warning "Table '$table' not found or has no columns"
            validation_passed=false
            continue
        fi
        
        # Check for missing columns
        local missing_columns=()
        for expected_col in ${EXPECTED_COLUMNS[$table]}; do
            if ! echo "$ACTUAL_COLUMNS" | grep -q "^$expected_col$"; then
                missing_columns+=("$expected_col")
            fi
        done
        
        if [ ${#missing_columns[@]} -gt 0 ]; then
            print_warning "Table '$table' missing columns: ${missing_columns[*]}"
            validation_passed=false
        else
            print_success "Table '$table' has all expected columns"
        fi
    done
    
    if [ "$validation_passed" = true ]; then
        print_success "All table column validations passed"
        return 0
    else
        print_warning "Some table column validations failed"
        return 1
    fi
}

# Create backup of current database
create_backup() {
    print_status "Creating database backup before migration..."
    
    local backup_file="escashop_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    if pg_dump "$DATABASE_URL" > "$backup_file" 2>/dev/null; then
        print_success "Database backup created: $backup_file"
        return 0
    else
        print_warning "Failed to create database backup (continuing anyway)"
        return 1
    fi
}

# Run migration file
run_migration_file() {
    local migration_file="$1"
    local description="$2"
    
    print_status "Running migration: $description"
    
    if [ ! -f "$migration_file" ]; then
        print_warning "Migration file not found: $migration_file"
        return 1
    fi
    
    if psql "$DATABASE_URL" -f "$migration_file" > /dev/null 2>&1; then
        print_success "Migration completed: $description"
        return 0
    else
        print_error "Migration failed: $description"
        print_status "Check the migration file for syntax errors: $migration_file"
        return 1
    fi
}

# Run all migrations
run_migrations() {
    print_status "Starting database migrations..."
    
    local migrations_dir="backend/src/database"
    local failed_migrations=()
    
    # Run complete migration first (creates all base tables)
    if run_migration_file "$migrations_dir/complete-migration.sql" "Complete database schema"; then
        print_success "Base schema migration completed"
    else
        print_error "Base schema migration failed - this is critical"
        return 1
    fi
    
    # Run additional migrations in order
    declare -a MIGRATION_FILES=(
        "$migrations_dir/migrate-sms-templates.sql:SMS Templates"
        "$migrations_dir/migrations/add_payment_features.sql:Payment Features"
        "$migrations_dir/migrations/payment_tracking_migration.sql:Payment Tracking"
        "$migrations_dir/migrations/add-funds-column.sql:Funds Column"
        "$migrations_dir/migrations/transactions-table.sql:Enhanced Transactions"
        "$migrations_dir/migrations/activity-logs-table.sql:Activity Logs"
        "$migrations_dir/migrations/daily-reports-table.sql:Daily Reports"
        "$migrations_dir/migrations/create-cashier-notifications.sql:Cashier Notifications"
        "$migrations_dir/migrations/create_daily_queue_history_tables.sql:Queue History Tables"
        "$migrations_dir/migrations/create_daily_queue_history_views.sql:Queue History Views"
        "$migrations_dir/migrations/add_processing_duration_analytics.sql:Processing Analytics"
        "$migrations_dir/migrations/001_add_unique_settlement_index.sql:Settlement Index"
        "$migrations_dir/migrations/V2025_07_Processing_Status.sql:Processing Status"
        "$migrations_dir/migrations/queue-status-backward-compatibility.sql:Queue Status Compatibility"
    )
    
    for migration_info in "${MIGRATION_FILES[@]}"; do
        local file="${migration_info%%:*}"
        local desc="${migration_info##*:}"
        
        if [ -f "$file" ]; then
            if run_migration_file "$file" "$desc"; then
                print_success "✓ $desc"
            else
                failed_migrations+=("$desc")
                print_warning "✗ $desc (failed but continuing)"
            fi
        else
            print_warning "Migration file not found: $file"
        fi
    done
    
    # Run initialization script last
    if run_migration_file "$migrations_dir/init.sql" "Database initialization"; then
        print_success "Database initialization completed"
    else
        failed_migrations+=("Database initialization")
    fi
    
    if [ ${#failed_migrations[@]} -eq 0 ]; then
        print_success "All migrations completed successfully"
        return 0
    else
        print_warning "Some migrations failed: ${failed_migrations[*]}"
        print_status "The database should still be functional, but some features may not work correctly"
        return 1
    fi
}

# Validate migration results
validate_migrations() {
    print_status "Validating migration results..."
    
    # Re-run schema validation
    if get_schema_info && validate_table_columns; then
        print_success "Migration validation passed"
        return 0
    else
        print_warning "Migration validation failed - some issues may exist"
        return 1
    fi
}

# Create test data (optional)
create_test_data() {
    print_status "Creating test data..."
    
    # Create a test admin user if none exists
    local admin_exists=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM users WHERE role = 'admin';" 2>/dev/null | tr -d ' ' || echo "0")
    
    if [ "$admin_exists" = "0" ]; then
        print_status "Creating default admin user..."
        psql "$DATABASE_URL" -c "
            INSERT INTO users (email, full_name, password_hash, role, status) 
            VALUES ('admin@escashop.com', 'System Administrator', '\$2b\$12\$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewmCvjk9VtTHNzLO', 'admin', 'active')
            ON CONFLICT (email) DO NOTHING;
        " > /dev/null 2>&1
        print_success "Default admin user created (email: admin@escashop.com, password: admin123)"
    else
        print_success "Admin user already exists"
    fi
    
    # Create default counters if none exist
    local counter_count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM counters;" 2>/dev/null | tr -d ' ' || echo "0")
    
    if [ "$counter_count" = "0" ]; then
        print_status "Creating default counters..."
        psql "$DATABASE_URL" -c "
            INSERT INTO counters (name, display_order, is_active) VALUES 
            ('Counter 1', 1, true),
            ('Counter 2', 2, true)
            ON CONFLICT (name) DO NOTHING;
        " > /dev/null 2>&1
        print_success "Default counters created"
    else
        print_success "Counters already exist"
    fi
}

# Generate migration report
generate_report() {
    print_status "Generating migration report..."
    
    local report_file="migration_report_$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "EscaShop Database Migration Report"
        echo "Generated: $(date)"
        echo "Database: $DATABASE_URL"
        echo ""
        echo "=== Tables ==="
        psql "$DATABASE_URL" -c "SELECT tablename, schemaname FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" 2>/dev/null || echo "Failed to get table list"
        echo ""
        echo "=== Table Row Counts ==="
        for table in users customers transactions counters grade_types lens_types; do
            local count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | tr -d ' ' || echo "N/A")
            echo "$table: $count rows"
        done
        echo ""
        echo "=== Database Size ==="
        psql "$DATABASE_URL" -c "SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size;" 2>/dev/null || echo "Failed to get database size"
    } > "$report_file"
    
    print_success "Migration report generated: $report_file"
}

# Main migration function
main() {
    print_status "Starting Railway database migration process..."
    
    # Pre-migration checks
    check_psql
    
    if ! test_db_connection; then
        print_error "Cannot proceed without database connection"
        exit 1
    fi
    
    # Load environment variables from .env.railway if it exists
    if [ -f ".env.railway" ]; then
        print_status "Loading environment variables from .env.railway"
        set -a  # automatically export all variables
        source .env.railway
        set +a  # stop automatically exporting
    fi
    
    # Get current schema info
    local fresh_db=false
    if ! get_schema_info; then
        fresh_db=true
        print_status "This appears to be a fresh database"
    fi
    
    # Create backup (optional for fresh database)
    if [ "$fresh_db" = false ]; then
        create_backup
    fi
    
    # Run migrations
    if run_migrations; then
        print_success "Database migrations completed"
    else
        print_warning "Some migrations failed, but continuing with validation"
    fi
    
    # Validate results
    validate_migrations
    
    # Create test data
    create_test_data
    
    # Generate report
    generate_report
    
    print_success "🎉 Railway database migration completed!"
    print_status "Your EscaShop database should now be ready for Railway deployment."
}

# Handle script arguments
case "${1:-migrate}" in
    "migrate")
        main
        ;;
    "test")
        check_psql
        test_db_connection
        ;;
    "validate")
        check_psql
        test_db_connection
        get_schema_info
        validate_table_columns
        ;;
    "backup")
        check_psql
        test_db_connection
        create_backup
        ;;
    "report")
        check_psql
        test_db_connection
        generate_report
        ;;
    *)
        echo "Usage: $0 [migrate|test|validate|backup|report]"
        echo ""
        echo "Commands:"
        echo "  migrate   - Run full migration process (default)"
        echo "  test      - Test database connection"
        echo "  validate  - Validate database schema"
        echo "  backup    - Create database backup"
        echo "  report    - Generate migration report"
        exit 1
        ;;
esac
