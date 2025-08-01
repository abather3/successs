# Fix Localhost Binding Issues
# Run this script as Administrator

Write-Host "Fixing localhost binding issues..." -ForegroundColor Green

# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator"))
{
    Write-Host "This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click on PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Backup current hosts file
$hostsPath = "C:\Windows\System32\drivers\etc\hosts"
$backupPath = "C:\Windows\System32\drivers\etc\hosts.backup"

if (!(Test-Path $backupPath)) {
    Copy-Item $hostsPath $backupPath
    Write-Host "Backed up hosts file to $backupPath" -ForegroundColor Yellow
}

# Read current hosts file
$hostsContent = Get-Content $hostsPath

# Check if localhost entries exist
$hasIPv4Localhost = $hostsContent | Where-Object { $_ -match "^127\.0\.0\.1\s+localhost" }
$hasIPv6Localhost = $hostsContent | Where-Object { $_ -match "^::1\s+localhost" }

# Add missing entries
$newEntries = @()
if (!$hasIPv4Localhost) {
    $newEntries += "127.0.0.1       localhost"
    Write-Host "Adding IPv4 localhost entry" -ForegroundColor Green
}
if (!$hasIPv6Localhost) {
    $newEntries += "::1             localhost"
    Write-Host "Adding IPv6 localhost entry" -ForegroundColor Green
}

if ($newEntries.Count -gt 0) {
    $newEntries | Add-Content -Path $hostsPath
    Write-Host "Updated hosts file successfully!" -ForegroundColor Green
} else {
    Write-Host "Localhost entries already exist in hosts file" -ForegroundColor Yellow
}

# Flush DNS cache
Write-Host "Flushing DNS cache..." -ForegroundColor Green
ipconfig /flushdns | Out-Null

# Check network connectivity
Write-Host "Testing localhost connectivity..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method HEAD -UseBasicParsing -TimeoutSec 5
    Write-Host "✓ localhost:3000 is accessible (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "✗ localhost:3000 is not accessible: $($_.Exception.Message)" -ForegroundColor Red
}

try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000" -Method HEAD -UseBasicParsing -TimeoutSec 5
    Write-Host "✓ 127.0.0.1:3000 is accessible (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "✗ 127.0.0.1:3000 is not accessible: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nFix completed! Please:" -ForegroundColor Green
Write-Host "1. Close and reopen all browsers" -ForegroundColor Yellow
Write-Host "2. Try accessing http://localhost:3000 in Chrome and Edge" -ForegroundColor Yellow
Write-Host "3. If issues persist, try http://127.0.0.1:3000 instead" -ForegroundColor Yellow

Read-Host "Press Enter to exit"
