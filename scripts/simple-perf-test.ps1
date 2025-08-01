# Simple Performance Test for EscaShop
Write-Host "🚀 EscaShop Simple Performance Test" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green

# Start test environment
Write-Host "🔧 Starting test environment..." -ForegroundColor Cyan
docker-compose -f docker-compose.test.yml up -d
Start-Sleep -Seconds 15

Write-Host "✅ Testing backend health endpoint..." -ForegroundColor Yellow

# Test backend performance
$backendSuccess = 0
$backendFail = 0
$backendTimes = @()

for ($i = 1; $i -le 20; $i++) {
    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-WebRequest -Uri "http://localhost:5001/health" -UseBasicParsing -TimeoutSec 5
        $stopwatch.Stop()
        
        if ($response.StatusCode -eq 200) {
            $backendSuccess++
            $backendTimes += $stopwatch.ElapsedMilliseconds
        } else {
            $backendFail++
        }
        
        Write-Progress -Activity "Backend Test" -Status "Request $i/20" -PercentComplete (($i/20)*100)
    }
    catch {
        $backendFail++
        Write-Warning "Request $i failed: $($_.Exception.Message)"
    }
}

Write-Host "✅ Testing frontend endpoint..." -ForegroundColor Yellow

# Test frontend performance  
$frontendSuccess = 0
$frontendFail = 0
$frontendTimes = @()

for ($i = 1; $i -le 20; $i++) {
    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-WebRequest -Uri "http://localhost:3001" -UseBasicParsing -TimeoutSec 5
        $stopwatch.Stop()
        
        if ($response.StatusCode -eq 200) {
            $frontendSuccess++
            $frontendTimes += $stopwatch.ElapsedMilliseconds
        } else {
            $frontendFail++
        }
        
        Write-Progress -Activity "Frontend Test" -Status "Request $i/20" -PercentComplete (($i/20)*100)
    }
    catch {
        $frontendFail++
        Write-Warning "Request $i failed: $($_.Exception.Message)"
    }
}

# Results
Write-Host ""
Write-Host "📊 Performance Test Results" -ForegroundColor Green
Write-Host "============================" -ForegroundColor Green

Write-Host ""
Write-Host "🔧 Backend Results:" -ForegroundColor Cyan
Write-Host "  Successful: $backendSuccess/20" -ForegroundColor Green
Write-Host "  Failed: $backendFail/20" -ForegroundColor Red

if ($backendTimes.Count -gt 0) {
    $avgBackend = [math]::Round(($backendTimes | Measure-Object -Average).Average, 2)
    $minBackend = ($backendTimes | Measure-Object -Minimum).Minimum
    $maxBackend = ($backendTimes | Measure-Object -Maximum).Maximum
    
    Write-Host "  Avg Response Time: $avgBackend ms"  
    Write-Host "  Min Response Time: $minBackend ms"
    Write-Host "  Max Response Time: $maxBackend ms"
}

Write-Host ""
Write-Host "🌐 Frontend Results:" -ForegroundColor Cyan
Write-Host "  Successful: $frontendSuccess/20" -ForegroundColor Green
Write-Host "  Failed: $frontendFail/20" -ForegroundColor Red

if ($frontendTimes.Count -gt 0) {
    $avgFrontend = [math]::Round(($frontendTimes | Measure-Object -Average).Average, 2)
    $minFrontend = ($frontendTimes | Measure-Object -Minimum).Minimum
    $maxFrontend = ($frontendTimes | Measure-Object -Maximum).Maximum
    
    Write-Host "  Avg Response Time: $avgFrontend ms"
    Write-Host "  Min Response Time: $minFrontend ms"
    Write-Host "  Max Response Time: $maxFrontend ms"
}

# Overall assessment
$totalSuccess = $backendSuccess + $frontendSuccess  
$totalRequests = 40
$successRate = [math]::Round(($totalSuccess / $totalRequests) * 100, 2)

Write-Host ""
Write-Host "🎯 Overall Performance:" -ForegroundColor Yellow
Write-Host "  Success Rate: $successRate%"

if ($successRate -ge 95) {
    Write-Host "  Status: 🟢 EXCELLENT" -ForegroundColor Green
} elseif ($successRate -ge 90) {
    Write-Host "  Status: 🟡 GOOD" -ForegroundColor Yellow  
} else {
    Write-Host "  Status: 🔴 NEEDS IMPROVEMENT" -ForegroundColor Red
}

# Cleanup
Write-Host ""
Write-Host "🧹 Cleaning up..." -ForegroundColor Cyan
docker-compose -f docker-compose.test.yml down | Out-Null
Write-Host "✅ Performance test completed!" -ForegroundColor Green
