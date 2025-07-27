#!/bin/bash

# ===========================================
# EscaShop Docker Secrets Generator
# ===========================================
# This script generates secure secrets for Docker deployment

set -e

SECRETS_DIR="./secrets"
BACKUP_DIR="./secrets/backup-$(date +%Y%m%d_%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to generate secure random string
generate_secret() {
    local length=${1:-64}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Function to generate JWT secret (longer and more secure)
generate_jwt_secret() {
    openssl rand -base64 128 | tr -d "=+/" | cut -c1-128
}

# Function to create secret file
create_secret_file() {
    local filename=$1
    local content=$2
    local description=$3
    
    echo -n "$content" > "$SECRETS_DIR/$filename"
    chmod 600 "$SECRETS_DIR/$filename"
    echo -e "${GREEN}✓${NC} Created $filename - $description"
}

echo -e "${BLUE}EscaShop Docker Secrets Generator${NC}"
echo "=================================="

# Create secrets directory
mkdir -p "$SECRETS_DIR"

# Backup existing secrets if they exist
if [ "$(ls -A $SECRETS_DIR 2>/dev/null)" ]; then
    echo -e "${YELLOW}⚠️  Existing secrets found. Creating backup...${NC}"
    mkdir -p "$BACKUP_DIR"
    cp "$SECRETS_DIR"/*.txt "$BACKUP_DIR/" 2>/dev/null || true
    echo -e "${GREEN}✓${NC} Backup created at $BACKUP_DIR"
fi

echo -e "\n${BLUE}Generating secure secrets...${NC}"

# Database password
create_secret_file "db_password.txt" "$(generate_secret 32)" "PostgreSQL database password"

# Redis password
create_secret_file "redis_password.txt" "$(generate_secret 32)" "Redis cache password"

# JWT secrets (extra long for security)
create_secret_file "jwt_secret.txt" "$(generate_jwt_secret)" "JWT access token secret"
create_secret_file "jwt_refresh_secret.txt" "$(generate_jwt_secret)" "JWT refresh token secret"

# API secrets
create_secret_file "vonage_api_secret.txt" "0YSON3xZYOEWYLyf" "Vonage SMS API secret"
create_secret_file "email_password.txt" "cutbcijqacobypak" "Email service password"

# Google Sheets API key (placeholder)
create_secret_file "google_sheets_api_key.txt" "$(generate_secret 64)" "Google Sheets API key"

# Session secret
create_secret_file "session_secret.txt" "$(generate_secret 64)" "Session encryption secret"

# Cookie signing secret
create_secret_file "cookie_secret.txt" "$(generate_secret 64)" "Cookie signing secret"

# Encryption key for sensitive data
create_secret_file "encryption_key.txt" "$(generate_secret 32)" "Data encryption key"

echo -e "\n${GREEN}✅ All secrets generated successfully!${NC}"

# Create .gitignore for secrets directory
cat > "$SECRETS_DIR/.gitignore" << EOF
# Ignore all secret files
*.txt
*.key
*.pem

# But track this .gitignore file
!.gitignore
!README.md
EOF

# Create README for secrets directory
cat > "$SECRETS_DIR/README.md" << EOF
# EscaShop Docker Secrets

This directory contains sensitive configuration data for the EscaShop application.

## Security Notes

- **NEVER commit secret files to version control**
- All \`.txt\` files in this directory are automatically ignored by Git
- Secrets are mounted as read-only files inside Docker containers
- Use strong, unique passwords for production deployments

## Files Generated

- \`db_password.txt\` - PostgreSQL database password
- \`redis_password.txt\` - Redis cache password  
- \`jwt_secret.txt\` - JWT access token signing secret
- \`jwt_refresh_secret.txt\` - JWT refresh token signing secret
- \`vonage_api_secret.txt\` - Vonage SMS API secret
- \`email_password.txt\` - Email service password
- \`google_sheets_api_key.txt\` - Google Sheets API key
- \`session_secret.txt\` - Session encryption secret
- \`cookie_secret.txt\` - Cookie signing secret
- \`encryption_key.txt\` - General data encryption key

## Regenerating Secrets

To regenerate all secrets:

\`\`\`bash
./scripts/generate-secrets.sh
\`\`\`

## Production Deployment

For production:
1. Generate secrets on secure machine
2. Transfer securely to production server
3. Ensure proper file permissions (600)
4. Consider using external secret management (AWS Secrets Manager, etc.)

## Backup

Existing secrets are automatically backed up when regenerating.
EOF

echo -e "\n${BLUE}Security checklist:${NC}"
echo "==================="
echo -e "${YELLOW}1.${NC} Update the actual API keys in secrets/ directory with real values"
echo -e "${YELLOW}2.${NC} Ensure secrets/ directory is excluded from version control"
echo -e "${YELLOW}3.${NC} Set proper file permissions: chmod 600 secrets/*.txt"
echo -e "${YELLOW}4.${NC} Consider using external secret management for production"
echo -e "${YELLOW}5.${NC} Regularly rotate secrets in production"

echo -e "\n${GREEN}✅ Secret generation completed!${NC}"
echo -e "Secrets are ready for Docker deployment."
