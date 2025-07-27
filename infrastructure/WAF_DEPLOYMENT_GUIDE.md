# WAF Deployment Guide

This guide provides step-by-step instructions for deploying Web Application Firewall (WAF) protection for the escashop application.

## Overview

The WAF implementation provides comprehensive protection against:
- **SQL Injection (SQLi)** attacks
- **Cross-Site Scripting (XSS)** attacks
- **Remote Code Execution (RCE)** attempts
- **Bot and scraper detection**
- **Geographic/IP blocking**
- **Rate limiting**
- **Directory traversal attacks**
- **Leaked credentials detection**

## Available Providers

### 1. Cloudflare WAF
- **File**: `cloudflare-waf-config.tf`
- **Features**: Attack score-based rules, bot management, managed rules
- **Best for**: Easy setup, comprehensive protection, global CDN

### 2. AWS WAF
- **File**: `aws-waf-config.tf`
- **Features**: Managed rule groups, custom rules, CloudWatch integration
- **Best for**: AWS-hosted applications, detailed logging

## Prerequisites

### General Requirements
- Terraform installed (version >= 1.0)
- PowerShell (for deployment script)
- Domain configured with DNS

### Cloudflare Setup
1. Cloudflare account with domain added
2. API token with Zone:Edit permissions
3. Zone ID from Cloudflare dashboard

### AWS Setup
1. AWS account with appropriate permissions
2. AWS CLI configured
3. WAF v2 permissions (wafv2:*)

## Configuration

### 1. Environment Variables
Copy the example variables file:
```bash
cp terraform.tfvars.example terraform.tfvars
```

Update with your actual values:
- API tokens/keys
- Domain names
- IP allowlists
- Rate limiting settings

### 2. Staging Configuration
Create staging-specific variables:
```bash
cp terraform.tfvars.example terraform-staging.tfvars
```

Update staging values:
- Set `environment = "staging"`
- Use staging domain
- Enable logging mode for testing

## Deployment Process

### Phase 1: Staging Deployment

1. **Deploy to Staging First**
   ```powershell
   .\deploy-waf.ps1 -Environment staging -Provider cloudflare -PlanOnly
   ```

2. **Review the Plan**
   - Check proposed changes
   - Verify rule configurations
   - Confirm resource creation

3. **Apply to Staging**
   ```powershell
   .\deploy-waf.ps1 -Environment staging -Provider cloudflare
   ```

4. **Monitor and Test**
   - Check WAF logs for false positives
   - Test legitimate traffic flows
   - Verify attack blocking

### Phase 2: Rule Tuning

1. **Analyze Logs**
   - Review blocked requests
   - Identify false positives
   - Adjust rule thresholds

2. **Update Configuration**
   - Modify rule expressions
   - Adjust rate limits
   - Update IP allowlists

3. **Re-deploy Staging**
   ```powershell
   .\deploy-waf.ps1 -Environment staging -Provider cloudflare
   ```

### Phase 3: Production Deployment

1. **Plan Production Deployment**
   ```powershell
   .\deploy-waf.ps1 -Environment production -Provider cloudflare -PlanOnly
   ```

2. **Deploy to Production**
   ```powershell
   .\deploy-waf.ps1 -Environment production -Provider cloudflare
   ```

3. **Monitor Production**
   - Watch for immediate issues
   - Monitor application performance
   - Check for false positives

## Rule Configuration

### SQL Injection Protection
```hcl
# Cloudflare Example
expression = "(cf.waf.score.sqli lt 20) or (http.request.uri.query contains \"union select\")"
action = "block"
```

### XSS Protection
```hcl
# AWS Example
byte_match_statement {
  field_to_match {
    uri_path {}
  }
  positional_constraint = "CONTAINS"
  search_string = "<script"
}
```

### Bot Protection
```hcl
# Cloudflare Bot Management
expression = "(cf.bot_management.score lt 10) and not (cf.bot_management.verified_bot)"
action = "managed_challenge"
```

### Geographic Blocking
```hcl
# AWS Geo Blocking
geo_match_statement {
  country_codes = ["CN", "RU", "KP"]
}
```

## Monitoring and Alerting

### Cloudflare Monitoring
1. **Dashboard Access**
   - Go to Cloudflare Dashboard > Security > WAF
   - Monitor rule triggers and blocks
   - Review attack trends

2. **Key Metrics**
   - Total requests blocked
   - Attack types detected
   - False positive rate
   - Geographic distribution

### AWS Monitoring
1. **CloudWatch Metrics**
   - WAF rule matches
   - Blocked requests
   - Rate limit triggers

2. **Log Analysis**
   - CloudWatch Logs for detailed analysis
   - Request patterns
   - Attack signatures

### Alerting Setup
Create alerts for:
- High false positive rates
- Sudden traffic spikes
- New attack patterns
- Rule failures

## Testing WAF Rules

### Automated Testing
The deployment script includes basic tests:
- Connectivity verification
- SQL injection blocking
- XSS protection
- Malicious user agent blocking

### Manual Testing
1. **Legitimate Traffic**
   - Normal user workflows
   - API endpoints
   - Admin functionality

2. **Attack Simulation**
   - SQL injection attempts
   - XSS payloads
   - Directory traversal
   - Bot-like behavior

### Testing Commands
```bash
# Test SQL injection (should be blocked)
curl "https://escashop.com/api/test?id=1' OR '1'='1"

# Test XSS (should be blocked)
curl "https://escashop.com/search?q=<script>alert('xss')</script>"

# Test malicious user agent (should be blocked)
curl -H "User-Agent: sqlmap/1.0" "https://escashop.com"
```

## Troubleshooting

### Common Issues

1. **False Positives**
   - **Symptom**: Legitimate requests blocked
   - **Solution**: Adjust rule thresholds, add exceptions
   - **Prevention**: Thorough staging testing

2. **Performance Impact**
   - **Symptom**: Increased response times
   - **Solution**: Optimize rule complexity, use caching
   - **Prevention**: Monitor performance metrics

3. **Deployment Failures**
   - **Symptom**: Terraform errors
   - **Solution**: Check credentials, validate configuration
   - **Prevention**: Use plan-only mode first

### Debugging Steps
1. Check WAF logs for blocked requests
2. Verify rule expressions and syntax
3. Test with different user agents/IPs
4. Review CloudWatch metrics
5. Check DNS propagation

## Maintenance

### Regular Tasks
1. **Weekly Reviews**
   - Analyze attack patterns
   - Review false positives
   - Update IP allowlists

2. **Monthly Updates**
   - Update managed rules
   - Review rate limits
   - Audit rule effectiveness

3. **Quarterly Assessments**
   - Full security review
   - Performance analysis
   - Rule optimization

### Rule Updates
```bash
# Update rules
terraform plan -var-file=terraform.tfvars
terraform apply

# Rollback if needed
terraform plan -destroy
```

## Security Best Practices

1. **Principle of Least Privilege**
   - Restrict admin access by IP
   - Use strong authentication
   - Regular access reviews

2. **Defense in Depth**
   - WAF + application security
   - Rate limiting + bot protection
   - Monitoring + alerting

3. **Regular Testing**
   - Penetration testing
   - Security audits
   - Rule effectiveness reviews

## Support and Documentation

### Resources
- [Cloudflare WAF Documentation](https://developers.cloudflare.com/waf/)
- [AWS WAF Developer Guide](https://docs.aws.amazon.com/waf/)
- [OWASP Web Application Firewall](https://owasp.org/www-community/Web_Application_Firewall)

### Emergency Contacts
- Security Team: security@escashop.com
- DevOps Team: devops@escashop.com
- On-call: +1-XXX-XXX-XXXX

## Conclusion

This WAF deployment provides comprehensive protection against common web attacks. Regular monitoring, testing, and updates are essential for maintaining security effectiveness. Always deploy to staging first and thoroughly test before production deployment.
