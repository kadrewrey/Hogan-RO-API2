# Test script for server connectivity
# Save as test-server.ps1 and run separately

Write-Host "🔍 Testing Hogan RO API v2 Server Connectivity" -ForegroundColor Green
Write-Host "=" * 50

# Test 1: Check if port 3002 is listening
Write-Host "`n1. Checking if port 3002 is listening..." -ForegroundColor Yellow
try {
    $connection = Test-NetConnection -ComputerName 127.0.0.1 -Port 3002 -InformationLevel Quiet
    if ($connection) {
        Write-Host "✅ Port 3002 is OPEN and listening" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Port 3002 is CLOSED or not listening" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "❌ Error testing port: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Get process info
Write-Host "`n2. Finding process on port 3002..." -ForegroundColor Yellow
try {
    $netConnection = Get-NetTCPConnection -LocalPort 3002 -ErrorAction SilentlyContinue
    if ($netConnection) {
        $process = Get-Process -Id $netConnection.OwningProcess -ErrorAction SilentlyContinue
        Write-Host "✅ Process: $($process.ProcessName) (PID: $($process.Id))" -ForegroundColor Green
        Write-Host "   Local Address: $($netConnection.LocalAddress):$($netConnection.LocalPort)" -ForegroundColor Cyan
        Write-Host "   State: $($netConnection.State)" -ForegroundColor Cyan
    }
    else {
        Write-Host "❌ No process found listening on port 3002" -ForegroundColor Red
    }
}
catch {
    Write-Host "⚠️  Could not get process info: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Test 3: Test HTTP connectivity using IPv4 explicitly
Write-Host "`n3. Testing HTTP connectivity (IPv4)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:3002/health" -Method GET -TimeoutSec 5
    Write-Host "✅ Health endpoint responded successfully!" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor Cyan
}
catch {
    Write-Host "❌ Health endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
    
    # Try with localhost instead
    Write-Host "   Trying with localhost..." -ForegroundColor Yellow
    try {
        $response2 = Invoke-RestMethod -Uri "http://localhost:3002/health" -Method GET -TimeoutSec 5
        Write-Host "✅ Health endpoint works with localhost!" -ForegroundColor Green
        Write-Host "Response: $($response2 | ConvertTo-Json -Compress)" -ForegroundColor Cyan
    }
    catch {
        Write-Host "❌ Health endpoint also failed with localhost: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 4: Test API endpoint with sample payload
Write-Host "`n4. Testing API endpoint (this should require auth)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:3002/api/users" -Method GET -TimeoutSec 5
    Write-Host "✅ Users endpoint responded (unexpected - should require auth)" -ForegroundColor Yellow
}
catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✅ Users endpoint correctly requires authentication (401 Unauthorized)" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️  Users endpoint error: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host "`n🎉 Server connectivity test completed!" -ForegroundColor Green
Write-Host "💡 If all tests passed, your server is ready for testing!" -ForegroundColor Cyan
Write-Host "📚 Visit http://127.0.0.1:3002/docs for Swagger UI" -ForegroundColor Cyan