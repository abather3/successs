# Secret Management & Configuration Hardening Guide

## Overview

This guide documents the implementation of secret management and security hardening measures for the EscaShop application. All sensitive credentials are now secured using vault-based secret management with automatic rotation capabilities.

## 🔐 Secret Management Implementation

### 1. Secrets Manager Service

The `backend/src/services/secretsManager.ts` file implements a comprehensive secret management system that supports:

- **HashiCorp Vault** (Primary)
- **AWS Secrets Manager** (Secondary)
- **Environment Variables** (Fallback)

### 2. Configuration Architecture

```
├── backend/src/config/
│   ├── config.ts          # Non-sensitive configuration
│   ├── database.ts        # Database configuration using secrets
│   └── tls.ts             # TLS/SSL configuration
└── backend/src/services/
    └── secretsManager.ts  # Secret management service
```

### 3. Supported Secret Providers

#### HashiCorp Vault
- **Authentication**: Token-based, AppRole, or file-based
- **Mount Path**: Configurable (default: `secret`)
- **Namespace**: Configurable (default: `admin`)
- **Caching**: 5-minute cache with automatic refresh

#### AWS Secrets Manager
- **Authentication**: IAM roles, access keys, or session tokens
- **Region**: Configurable
- **Rotation**: Automatic secret rotation support

#### Environment Variables
- **Fallback**: Always available as last resort
- **Development**: Suitable for local development

## 🔑 Secrets Configuration

### Environment Variables for Vault Setup

```bash
# HashiCorp Vault
VAULT_URL=https://vault.example.com
VAULT_TOKEN=your-vault-token
VAULT_ROLE_ID=your-role-id
VAULT_SECRET_ID=your-secret-id
VAULT_NAMESPACE=admin
VAULT_MOUNT_PATH=secret
VAULT_TOKEN_PATH=/vault/secrets/token

# AWS Secrets Manager
AWS_SECRETS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_SESSION_TOKEN=your-session-token
```

### Required Secrets in Vault

The following secrets must be configured in your chosen vault:

1. **Database Credentials**
   - `DATABASE_URL` - PostgreSQL connection string

2. **JWT Secrets**
   - `JWT_SECRET` - JWT signing secret
   - `JWT_REFRESH_SECRET` - JWT refresh token secret

3. **SMS Provider API Keys**
   - `SMS_API_KEY` - Generic SMS API key
   - `TWILIO_AUTH_TOKEN` - Twilio authentication token
   - `CLICKSEND_API_KEY` - ClickSend API key
   - `VONAGE_API_SECRET` - Vonage API secret

4. **Email Configuration**
   - `EMAIL_PASSWORD` - Email service password

5. **Third-party Integrations**
   - `GOOGLE_SHEETS_API_KEY` - Google Sheets API key

## 🔒 TLS/SSL Configuration

### Modern Cipher Suites

The application enforces modern cipher suites in order of preference:

```typescript
// TLS 1.3 (Preferred)
TLS_AES_256_GCM_SHA384
TLS_CHACHA20_POLY1305_SHA256
TLS_AES_128_GCM_SHA256

// TLS 1.2 (Fallback)
ECDHE-ECDSA-AES256-GCM-SHA384
ECDHE-RSA-AES256-GCM-SHA384
ECDHE-ECDSA-CHACHA20-POLY1305
ECDHE-RSA-CHACHA20-POLY1305
```

### Certificate Configuration

```bash
# TLS Certificate Paths
TLS_CERT_PATH=./certs/server.crt
TLS_KEY_PATH=./certs/server.key
TLS_CA_PATH=./certs/ca.crt
TLS_DHPARAM_PATH=./certs/dhparam.pem
```

### Security Headers

All responses include the following security headers:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy: default-src 'self'; ...`

## 🛡️ Security Best Practices

### 1. Secret Rotation

- **Automatic**: Secrets are automatically rotated based on vault policies
- **Manual**: Use `secretsManager.refreshSecret(key)` to force refresh
- **Cache**: 5-minute cache prevents excessive vault calls

### 2. Least Privilege Access

- **IAM Roles**: Use least-privilege IAM roles for vault access
- **AppRole**: Implement AppRole authentication for production
- **Network**: Restrict network access to vault endpoints

### 3. Certificate Management

- **Validity**: Maximum 90 days (use Let's Encrypt for automation)
- **Algorithm**: RSA-2048 or ECDSA-256
- **SAN**: Include all domain names in Subject Alternative Names
- **OCSP**: Enable OCSP stapling for revocation checking

### 4. Monitoring and Alerting

- **Expiration**: Monitor certificate expiration dates
- **Renewal**: Automated certificate renewal
- **Revocation**: Monitor certificate revocation lists
- **Auditing**: Regular security audits and penetration testing

## 🚀 Deployment Instructions

### 1. HashiCorp Vault Setup

```bash
# Install Vault
wget https://releases.hashicorp.com/vault/1.14.0/vault_1.14.0_linux_amd64.zip
unzip vault_1.14.0_linux_amd64.zip
sudo mv vault /usr/local/bin/

# Initialize Vault
vault operator init
vault operator unseal

# Enable AppRole authentication
vault auth enable approle

# Create policy for application
vault policy write escashop-policy - <<EOF
path "secret/data/escashop/*" {
  capabilities = ["read"]
}
EOF

# Create AppRole
vault write auth/approle/role/escashop \
    token_policies="escashop-policy" \
    token_ttl=1h \
    token_max_ttl=4h
```

### 2. AWS Secrets Manager Setup

```bash
# Install AWS CLI
pip install awscli

# Configure AWS credentials
aws configure

# Create secrets
aws secretsmanager create-secret \
    --name "escashop/database-url" \
    --secret-string "postgresql://user:pass@host:5432/db"

aws secretsmanager create-secret \
    --name "escashop/jwt-secret" \
    --secret-string "your-jwt-secret"
```

### 3. Certificate Generation

```bash
# Create certs directory
mkdir -p certs

# Generate private key
openssl genrsa -out certs/server.key 2048

# Generate CSR
openssl req -new -key certs/server.key -out certs/server.csr \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

# Generate self-signed certificate (development only)
openssl x509 -req -in certs/server.csr -signkey certs/server.key \
    -out certs/server.crt -days 365

# Generate DH parameters
openssl dhparam -out certs/dhparam.pem 2048
```

### 4. Production Deployment

```bash
# Set vault environment variables
export VAULT_URL=https://vault.example.com
export VAULT_ROLE_ID=your-role-id
export VAULT_SECRET_ID=your-secret-id

# Start application
npm run start
```

## 📊 Security Monitoring

### Metrics to Monitor

1. **Secret Access**
   - Failed secret retrievals
   - Unusual access patterns
   - Cache hit/miss ratios

2. **TLS/SSL**
   - Certificate expiration dates
   - Cipher suite usage
   - Connection failures

3. **Vault Health**
   - Vault availability
   - Authentication failures
   - Policy violations

### Alerting Rules

```yaml
# Example Prometheus alerting rules
groups:
  - name: security
    rules:
      - alert: CertificateExpiring
        expr: ssl_certificate_expiry < 86400 * 30
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "SSL certificate expiring soon"
          
      - alert: VaultDown
        expr: vault_up == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Vault is down"
```

## 🔧 Troubleshooting

### Common Issues

1. **Vault Connection Failed**
   - Check network connectivity
   - Verify vault URL and credentials
   - Check vault seal status

2. **Certificate Validation Failed**
   - Verify certificate format
   - Check certificate expiration
   - Ensure proper certificate chain

3. **Secret Not Found**
   - Verify secret path in vault
   - Check IAM permissions
   - Verify secret exists in vault

### Debug Commands

```bash
# Test vault connection
vault status

# List secrets
vault kv list secret/escashop/

# Get secret
vault kv get secret/escashop/database-url

# Test TLS configuration
openssl s_client -connect localhost:5000 -servername localhost
```

## 📚 Additional Resources

- [HashiCorp Vault Documentation](https://www.vaultproject.io/docs)
- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)

## 🎯 Next Steps

1. **Implement Automatic Rotation**: Set up automatic secret rotation schedules
2. **Add Monitoring**: Implement comprehensive monitoring and alerting
3. **Security Audit**: Conduct regular security audits and penetration testing
4. **Documentation**: Maintain up-to-date security documentation
5. **Training**: Ensure team members are trained on security best practices

---

**Note**: This implementation provides a robust foundation for secret management and security hardening. Always follow your organization's security policies and compliance requirements.
