# 🧪 Server Testing Guide - Hogan RO API v2

## ✅ Server Status Checks

The server is now configured to run on **port 3002** and bind to **0.0.0.0** (all interfaces).

### 1. Check if Port 3002 is Listening

**PowerShell Commands:**

```powershell
# Test port connectivity
Test-NetConnection 127.0.0.1 -Port 3002

# Check what's listening on port 3002
Get-NetTCPConnection -LocalPort 3002 -ErrorAction SilentlyContinue

# Alternative using netstat
netstat -ano | findstr :3002
```

**Expected Output:** Should show a listener on 0.0.0.0:3002

### 2. Start the Server

```bash
npm run dev
```

**Expected Console Output:**

```
🚀 Hogan RO API v2 running on http://0.0.0.0:3002
📚 API Documentation available at http://0.0.0.0:3002/docs
```

## 🔍 HTTP Connectivity Tests

### Test 1: Health Check (IPv4 Explicit)

**PowerShell:**

```powershell
# IPv4 explicit test
Invoke-RestMethod -Uri "http://127.0.0.1:3002/health" -Method GET

# IPv6 test (if needed)
Invoke-RestMethod -Uri "http://[::1]:3002/health" -Method GET

# Localhost test
Invoke-RestMethod -Uri "http://localhost:3002/health" -Method GET
```

**curl:**

```bash
curl -X GET http://127.0.0.1:3002/health
curl -X GET http://localhost:3002/health
```

**Expected Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-09-26T...",
  "database": "connected",
  "version": "2.0.0"
}
```

### Test 2: API Endpoints (Should Require Auth)

**PowerShell:**

```powershell
# This should return 401 Unauthorized
Invoke-RestMethod -Uri "http://127.0.0.1:3002/api/users" -Method GET
```

**curl:**

```bash
curl -X GET http://127.0.0.1:3002/api/users
```

**Expected Response:** `401 Unauthorized` or authentication error

## 📝 Test Payloads for API Endpoints

### Create User (POST /api/users)

**PowerShell:**

```powershell
$payload = @{
    email = "john.doe@example.com"
    password = "SecurePassword123!"
    first_name = "John"
    last_name = "Doe"
    role = "user"
    is_active = $true
} | ConvertTo-Json

$headers = @{
    Authorization = "Bearer YOUR_JWT_TOKEN"
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "http://127.0.0.1:3002/api/users" -Method POST -Body $payload -Headers $headers
```

**curl:**

```bash
curl -X POST http://127.0.0.1:3002/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "email": "john.doe@example.com",
    "password": "SecurePassword123!",
    "first_name": "John",
    "last_name": "Doe",
    "role": "user",
    "is_active": true
  }'
```

### Create Supplier (POST /api/suppliers)

**PowerShell:**

```powershell
$payload = @{
    name = "ACME Corporation"
    contact_name = "Jane Smith"
    contact_email = "jane.smith@acme.com"
    contact_phone = "+1-555-123-4567"
    address = "123 Business Ave"
    city = "New York"
    state = "NY"
    zip_code = "10001"
    country = "USA"
    tax_id = "TAX123456789"
    payment_terms = "Net 30"
    notes = "Preferred supplier for office supplies"
    is_active = $true
} | ConvertTo-Json

$headers = @{
    Authorization = "Bearer YOUR_JWT_TOKEN"
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "http://127.0.0.1:3002/api/suppliers" -Method POST -Body $payload -Headers $headers
```

### Create Purchase Order (POST /api/purchase-orders)

**PowerShell:**

```powershell
$payload = @{
    po_number = "PO-2025-001"
    supplier_id = "REPLACE_WITH_ACTUAL_SUPPLIER_UUID"
    status = "draft"
    order_date = "2025-09-26T10:00:00Z"
    expected_delivery_date = "2025-10-15T10:00:00Z"
    total_amount = 1250.00
    currency = "USD"
    notes = "Quarterly office supplies order"
    items = @(
        @{
            description = "Office Paper - A4, 500 sheets"
            quantity = 10
            unit_price = 25.00
            total_price = 250.00
            notes = "White, 80gsm"
        },
        @{
            description = "Blue Pens - Pack of 12"
            quantity = 5
            unit_price = 15.00
            total_price = 75.00
        },
        @{
            description = "Desk Chair - Ergonomic"
            quantity = 2
            unit_price = 450.00
            total_price = 900.00
            notes = "Black, adjustable height"
        }
    )
} | ConvertTo-Json -Depth 3

$headers = @{
    Authorization = "Bearer YOUR_JWT_TOKEN"
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "http://127.0.0.1:3002/api/purchase-orders" -Method POST -Body $payload -Headers $headers
```

## 🌐 Swagger UI Testing

**Open in Browser:**

- http://127.0.0.1:3002/docs
- http://localhost:3002/docs

Use the **"Authorize"** button to add your JWT token, then test all endpoints interactively.

## 🚨 Troubleshooting

### Server Won't Start

```bash
# Check if port is in use
netstat -ano | findstr :3002

# Kill process if needed
Get-Process -Id (Get-NetTCPConnection -LocalPort 3002).OwningProcess | Stop-Process -Force

# Check server logs
npm run dev
```

### Connection Refused

1. **Check binding**: Server binds to `0.0.0.0:3002` (all interfaces)
2. **Try IPv4 explicit**: Use `127.0.0.1` instead of `localhost`
3. **Check firewall**: Usually not needed for localhost
4. **Verify process**: Ensure node.js process is running

### Database Connection Issues

```bash
# Check DATABASE_URL in .env
# Ensure PostgreSQL is running
# Check network connectivity to database
```

## ✅ Success Indicators

1. **Port 3002 is listening** ✓
2. **Health endpoint returns 200 OK** ✓
3. **API endpoints return 401 without auth** ✓
4. **Swagger UI loads** ✓
5. **Server logs show no errors** ✓

## 🔧 Server Configuration

- **Port**: 3002
- **Host**: 0.0.0.0 (all interfaces)
- **Environment**: Development
- **Database**: PostgreSQL (configured via DATABASE_URL)
- **CORS**: Enabled for localhost:3001, localhost:3002, 127.0.0.1:3002

Your server should now be fully testable on this machine! 🎉
