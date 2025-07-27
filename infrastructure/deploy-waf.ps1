# WAF Deployment Script
# This script deploys WAF configuration to staging first, then production

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("staging", "production")]
    [string]$Environment,
    
    [Parameter(Mandatory=$true)]
    [ValidateSet("cloudflare", "aws")]
    [string]$Provider,
    
    [switch]$PlanOnly,
    [switch]$Force
)

# Configuration
$TerraformDir = "E:\projectx\escashop\infrastructure"
$LogDir = "$TerraformDir\logs"

# Create logs directory if it doesn't exist
if (!(Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force
}

# Set log file
$LogFile = "$LogDir\waf-deployment-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage
    $logMessage | Out-File -FilePath $LogFile -Append
}

function Deploy-WAF {
    param(
        [string]$Environment,
        [string]$Provider,
        [bool]$PlanOnly = $false
    )
    
    Write-Log "Starting WAF deployment for $Environment environment using $Provider"
    
    # Change to terraform directory
    Set-Location $TerraformDir
    
    # Initialize Terraform
    Write-Log "Initializing Terraform..."
    terraform init
    
    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERROR: Terraform initialization failed"
        exit 1
    }
    
    # Select or create workspace
    Write-Log "Selecting Terraform workspace: $Environment"
    terraform workspace select $Environment 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Creating new workspace: $Environment"
        terraform workspace new $Environment
    }
    
    # Set variables file based on environment
    $VarsFile = "terraform.tfvars"
    if ($Environment -eq "staging") {
        $VarsFile = "terraform-staging.tfvars"
    }
    
    # Check if variables file exists
    if (!(Test-Path $VarsFile)) {
        Write-Log "ERROR: Variables file $VarsFile not found"
        Write-Log "Please copy terraform.tfvars.example to $VarsFile and update with your values"
        exit 1
    }
    
    # Plan deployment
    Write-Log "Planning Terraform deployment..."
    $ConfigFile = if ($Provider -eq "cloudflare") { "cloudflare-waf-config.tf" } else { "aws-waf-config.tf" }
    
    terraform plan -var-file=$VarsFile -var="environment=$Environment" -target="module.waf" -out="waf-$Environment.tfplan"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERROR: Terraform plan failed"
        exit 1
    }
    
    if ($PlanOnly) {
        Write-Log "Plan-only mode. Deployment plan saved to waf-$Environment.tfplan"
        return
    }
    
    # Confirm deployment for production
    if ($Environment -eq "production" -and !$Force) {
        Write-Log "WARNING: You are about to deploy to PRODUCTION"
        $confirm = Read-Host "Are you sure you want to continue? (yes/no)"
        if ($confirm -ne "yes") {
            Write-Log "Deployment cancelled by user"
            exit 0
        }
    }
    
    # Apply deployment
    Write-Log "Applying Terraform deployment..."
    terraform apply "waf-$Environment.tfplan"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERROR: Terraform apply failed"
        exit 1
    }
    
    Write-Log "WAF deployment completed successfully for $Environment environment"
    
    # Display outputs
    Write-Log "Deployment outputs:"
    terraform output
}

function Test-WAFRules {
    param([string]$Environment)
    
    Write-Log "Testing WAF rules for $Environment environment..."
    
    # Basic connectivity test
    $testUrl = if ($Environment -eq "staging") { "https://staging.escashop.com" } else { "https://escashop.com" }
    
    try {
        $response = Invoke-WebRequest -Uri $testUrl -Method GET -TimeoutSec 10
        Write-Log "✓ Basic connectivity test passed (Status: $($response.StatusCode))"
    } catch {
        Write-Log "✗ Basic connectivity test failed: $($_.Exception.Message)"
    }
    
    # Test SQL injection blocking (should be blocked)
    try {
        $response = Invoke-WebRequest -Uri "$testUrl/test?id=1' OR '1'='1" -Method GET -TimeoutSec 10
        Write-Log "✗ SQL injection test failed - request was not blocked (Status: $($response.StatusCode))"
    } catch {
        Write-Log "✓ SQL injection test passed - request was blocked"
    }
    
    # Test XSS blocking (should be blocked)
    try {
        $response = Invoke-WebRequest -Uri "$testUrl/test?search=<script>alert('xss')</script>" -Method GET -TimeoutSec 10
        Write-Log "✗ XSS test failed - request was not blocked (Status: $($response.StatusCode))"
    } catch {
        Write-Log "✓ XSS test passed - request was blocked"
    }
    
    # Test malicious user agent blocking (should be blocked)
    try {
        $headers = @{ "User-Agent" = "sqlmap/1.0" }
        $response = Invoke-WebRequest -Uri $testUrl -Method GET -Headers $headers -TimeoutSec 10
        Write-Log "✗ Malicious user agent test failed - request was not blocked (Status: $($response.StatusCode))"
    } catch {
        Write-Log "✓ Malicious user agent test passed - request was blocked"
    }
    
    Write-Log "WAF rules testing completed"
}

# Main execution
try {
    Write-Log "=== WAF Deployment Script Started ==="
    Write-Log "Environment: $Environment"
    Write-Log "Provider: $Provider"
    Write-Log "Plan Only: $PlanOnly"
    Write-Log "Force: $Force"
    
    # Deploy WAF
    Deploy-WAF -Environment $Environment -Provider $Provider -PlanOnly $PlanOnly
    
    # Test WAF rules if not plan-only
    if (!$PlanOnly) {
        Start-Sleep -Seconds 30  # Wait for WAF rules to propagate
        Test-WAFRules -Environment $Environment
    }
    
    Write-Log "=== WAF Deployment Script Completed Successfully ==="
    
} catch {
    Write-Log "ERROR: $($_.Exception.Message)"
    Write-Log "=== WAF Deployment Script Failed ==="
    exit 1
}
