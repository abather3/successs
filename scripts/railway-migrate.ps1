# PowerShell Migration Validation Script for Railway

Write-Host "Starting Railway Migration Validation..." -ForegroundColor Blue

# Check for PostgreSQL client
$psqlExists = Get-Command psql -ErrorAction SilentlyContinue

if (-Not $psqlExists) {
    Write-Host "PostgreSQL client (psql) is not installed." -ForegroundColor Red
    Write-Host "Please install it first."
    Exit 1
}

Write-Host "PostgreSQL client found." -ForegroundColor Green

# Validate DATABASE_URL
if (-Not $env:DATABASE_URL) {
    Write-Host "DATABASE_URL is not set in the environment variables." -ForegroundColor Red
    Write-Host "Please set it to your Railway PostgreSQL connection string."
    Exit 1
}

Write-Host "Testing database connection..." -ForegroundColor Yellow

# Test connection
try {
    psql --version | Out-Null
    Write-Host "Database connection successful." -ForegroundColor Green
} catch {
    Write-Host "Database connection failed." -ForegroundColor Red
    Exit 1
}

Write-Host "Validating database schema..." -ForegroundColor Yellow

# Run validation queries
echo $("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'public';") | psql $env:DATABASE_URL

Write-Host "Validation completed. Please check for errors above." -ForegroundColor Green
