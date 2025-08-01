# EscaShop Performance Load Test
# ==============================

param(
    [int]$Requests = 100,
    [int]$Concurrency = 10,
    [string]$BackendUrl = "http://localhost:5001",
    [string]$FrontendUrl = "http://localhost:3001"
)

Write-Host "🚀 EscaShop Performance Load Test" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""

# Initialize results
$results = @{
    TotalRequests = 0
    SuccessfulRequests = 0
    FailedRequests = 0
    ResponseTimes = @()
    StartTime = Get-Date
}

# Function to perform a single HTTP request
function Invoke-LoadTestRequest {
    param([string]$Url)
    
    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec 10 -UseBasicParsing
        $stopwatch.Stop()
        
        $script:results.TotalRequests++
        
        if ($response.StatusCode -eq 200) {
            $script:results.SuccessfulRequests++
        } else {
            $script:results.FailedRequests++
        }
        
        $script:results.ResponseTimes += $stopwatch.ElapsedMilliseconds
    }
    catch {
        $script:results.TotalRequests++
        $script:results.FailedRequests++
        Write-Warning "Request failed: $($_.Exception.Message)"
    }
}

# Function to run load test
function Start-LoadTest {
    param([string]$Endpoint, [int]$NumRequests, [int]$MaxConcurrency)
    
    Write-Host "🔥 Testing $Endpoint with $NumRequests requests (max $MaxConcurrency concurrent)" -ForegroundColor Yellow
    
    # Create job pool
    $jobs = @()
    $activeJobs = 0
    $completedRequests = 0
    
    for ($i = 1; $i -le $NumRequests; $i++) {
        # Wait if we've hit the concurrency limit
        while ($activeJobs -ge $MaxConcurrency) {
            $jobs | Where-Object { $_.State -eq 'Completed' } | ForEach-Object {
                Receive-Job -Job $_ | Out-Null
                Remove-Job -Job $_
                $script:activeJobs--
                $script:completedRequests++
            }
            Start-Sleep -Milliseconds 10
        }
        
        # Start new job
        $job = Start-Job -ScriptBlock {
            param($url)
            try {
                $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
                $response = Invoke-WebRequest -Uri $url -TimeoutSec 10 -UseBasicParsing
                $stopwatch.Stop()
                return @{
                    Success = $response.StatusCode -eq 200
                    ResponseTime = $stopwatch.ElapsedMilliseconds
                    StatusCode = $response.StatusCode
                }
            }
            catch {
                return @{
                    Success = $false
                    ResponseTime = 0
                    Error = $_.Exception.Message
                }
            }
        } -ArgumentList $Endpoint
        
        $jobs += $job
        $activeJobs++
        
        # Progress indicator
        if ($i % 10 -eq 0) {
            Write-Progress -Activity "Load Testing" -Status "$i of $NumRequests requests sent" -PercentComplete (($i / $NumRequests) * 100)
        }
    }
    
    # Wait for all jobs to complete
    Write-Host "⏳ Waiting for all requests to complete..." -ForegroundColor Yellow
    $jobs | Wait-Job | Out-Null
    
    # Collect results
    $successCount = 0
    $failCount = 0
    $responseTimes = @()
    
    foreach ($job in $jobs) {
        $result = Receive-Job -Job $job
        if ($result.Success) {
            $successCount++
            $responseTimes += $result.ResponseTime
        } else {
            $failCount++
        }
        Remove-Job -Job $job
    }
    
    Write-Progress -Activity "Load Testing" -Completed
    
    return @{
        TotalRequests = $NumRequests
        SuccessfulRequests = $successCount
        FailedRequests = $failCount
        ResponseTimes = $responseTimes
    }
}

# Start the test environment
Write-Host "🔧 Starting test environment..." -ForegroundColor Cyan
try {
    docker-compose -f docker-compose.test.yml up -d
    Start-Sleep -Seconds 10  # Wait for services to be ready
    
    Write-Host "✅ Test environment is ready" -ForegroundColor Green
    Write-Host ""
    
    # Test Backend Health Endpoint
    Write-Host "🎯 Testing Backend Performance" -ForegroundColor Magenta
    $backendResults = Start-LoadTest -Endpoint "$BackendUrl/health" -NumRequests $Requests -MaxConcurrency $Concurrency
    
    # Test Frontend Root Endpoint
    Write-Host ""
    Write-Host "🎯 Testing Frontend Performance" -ForegroundColor Magenta  
    $frontendResults = Start-LoadTest -Endpoint $FrontendUrl -NumRequests $Requests -MaxConcurrency $Concurrency
    
    # Calculate and display results
    Write-Host ""
    Write-Host "📊 Performance Test Results" -ForegroundColor Green
    Write-Host "===========================" -ForegroundColor Green
    
    # Backend Results
    Write-Host ""
    Write-Host "🔧 Backend Results:" -ForegroundColor Cyan
    Write-Host "  Total Requests: $($backendResults.TotalRequests)"
    Write-Host "  Successful: $($backendResults.SuccessfulRequests)" -ForegroundColor Green
    Write-Host "  Failed: $($backendResults.FailedRequests)" -ForegroundColor Red
    
    if ($backendResults.ResponseTimes.Count -gt 0) {
        $avgBackend = ($backendResults.ResponseTimes | Measure-Object -Average).Average
        $minBackend = ($backendResults.ResponseTimes | Measure-Object -Minimum).Minimum
        $maxBackend = ($backendResults.ResponseTimes | Measure-Object -Maximum).Maximum
        
        Write-Host "  Avg Response Time: $([math]::Round($avgBackend, 2)) ms"
        Write-Host "  Min Response Time: $minBackend ms"
        Write-Host "  Max Response Time: $maxBackend ms"
    }
    
    # Frontend Results
    Write-Host ""
    Write-Host "🌐 Frontend Results:" -ForegroundColor Cyan
    Write-Host "  Total Requests: $($frontendResults.TotalRequests)"
    Write-Host "  Successful: $($frontendResults.SuccessfulRequests)" -ForegroundColor Green
    Write-Host "  Failed: $($frontendResults.FailedRequests)" -ForegroundColor Red
    
    if ($frontendResults.ResponseTimes.Count -gt 0) {
        $avgFrontend = ($frontendResults.ResponseTimes | Measure-Object -Average).Average
        $minFrontend = ($frontendResults.ResponseTimes | Measure-Object -Minimum).Minimum
        $maxFrontend = ($frontendResults.ResponseTimes | Measure-Object -Maximum).Maximum
        
        Write-Host "  Avg Response Time: $([math]::Round($avgFrontend, 2)) ms"
        Write-Host "  Min Response Time: $minFrontend ms"
        Write-Host "  Max Response Time: $maxFrontend ms"
    }
    
    # Overall Performance Assessment
    Write-Host ""
    Write-Host "🎯 Performance Assessment:" -ForegroundColor Yellow
    
    $totalSuccess = $backendResults.SuccessfulRequests + $frontendResults.SuccessfulRequests
    $totalRequests = $backendResults.TotalRequests + $frontendResults.TotalRequests
    $successRate = [math]::Round(($totalSuccess / $totalRequests) * 100, 2)
    
    Write-Host "  Overall Success Rate: $successRate%"
    
    if ($successRate -ge 95) {
        Write-Host "  🟢 Performance Status: EXCELLENT" -ForegroundColor Green
    } elseif ($successRate -ge 90) {
        Write-Host "  🟡 Performance Status: GOOD" -ForegroundColor Yellow
    } elseif ($successRate -ge 80) {
        Write-Host "  🟠 Performance Status: MODERATE" -ForegroundColor Yellow
    } else {
        Write-Host "  🔴 Performance Status: POOR" -ForegroundColor Red
    }
    
    # Recommendations
    Write-Host "💡 Recommendations:" -ForegroundColor Magenta
    
    if ($avgBackend -gt 100) {
        Write-Host "  - Backend response time is high. Consider optimizing database queries and caching."
    }
    
    if ($avgFrontend -gt 500) {
        Write-Host "  - Frontend loading time is high. Consider optimizing bundle size and implementing CDN."
    }
    
    if ($successRate -lt 95) {
        Write-Host "  - Some requests failed. Check error logs and increase resource limits if needed."
    }
    
    Write-Host ""
    Write-Host "✅ Performance testing completed!" -ForegroundColor Green
    
} catch {
    Write-Error "Failed to start test environment: $($_.Exception.Message)"
} finally {
    # Clean up
    Write-Host ""
    Write-Host "🧹 Cleaning up test environment..." -ForegroundColor Cyan
    docker-compose -f docker-compose.test.yml down | Out-Null
    Write-Host "✅ Cleanup completed" -ForegroundColor Green
}
