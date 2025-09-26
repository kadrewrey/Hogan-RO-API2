# API Test Payloads for Hogan RO API v2

## Base URL: http://localhost:3000

### 1. Health Check

```http
GET /health
```

Expected Response:

```json
{
  "status": "ok",
  "timestamp": "2025-09-26T...",
  "database": "connected",
  "version": "2.0.0"
}
```

### 2. Create User (POST /api/users)

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

**Payload:**

```json
{
  "email": "john.doe@example.com",
  "password": "SecurePassword123!",
  "first_name": "John",
  "last_name": "Doe",
  "role": "user",
  "is_active": true
}
```

### 3. Create Supplier (POST /api/suppliers)

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

**Payload:**

```json
{
  "name": "ACME Corporation",
  "contact_name": "Jane Smith",
  "contact_email": "jane.smith@acme.com",
  "contact_phone": "+1-555-123-4567",
  "address": "123 Business Ave",
  "city": "New York",
  "state": "NY",
  "zip_code": "10001",
  "country": "USA",
  "tax_id": "TAX123456789",
  "payment_terms": "Net 30",
  "notes": "Preferred supplier for office supplies",
  "is_active": true
}
```

### 4. Create Permission (POST /api/permissions)

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

**Payload:**

```json
{
  "name": "View Purchase Orders",
  "description": "Allows viewing purchase order information",
  "resource": "purchase_orders",
  "action": "read"
}
```

### 5. Create Role (POST /api/roles)

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

**Payload:**

```json
{
  "name": "Purchase Manager",
  "description": "Can manage purchase orders and suppliers",
  "is_system_role": false,
  "permissions": ["uuid-of-permission-1", "uuid-of-permission-2"]
}
```

### 6. Create Purchase Order (POST /api/purchase-orders)

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

**Payload:**

```json
{
  "po_number": "PO-2025-001",
  "supplier_id": "supplier-uuid-here",
  "status": "draft",
  "order_date": "2025-09-26T10:00:00Z",
  "expected_delivery_date": "2025-10-15T10:00:00Z",
  "total_amount": 1250.0,
  "currency": "USD",
  "notes": "Quarterly office supplies order",
  "items": [
    {
      "description": "Office Paper - A4, 500 sheets",
      "quantity": 10,
      "unit_price": 25.0,
      "total_price": 250.0,
      "notes": "White, 80gsm"
    },
    {
      "description": "Blue Pens - Pack of 12",
      "quantity": 5,
      "unit_price": 15.0,
      "total_price": 75.0
    },
    {
      "description": "Desk Chair - Ergonomic",
      "quantity": 2,
      "unit_price": 450.0,
      "total_price": 900.0,
      "notes": "Black, adjustable height"
    }
  ]
}
```

### 7. Get Users with Filters (GET /api/users)

```http
GET /api/users?page=1&limit=10&role=user&active=true&search=john
```

### 8. Get Suppliers (GET /api/suppliers)

```http
GET /api/suppliers?page=1&limit=10&active=true&city=New York
```

### 9. Get Purchase Orders (GET /api/purchase-orders)

```http
GET /api/purchase-orders?page=1&limit=10&status=draft&from_date=2025-09-01&to_date=2025-09-30
```

### 10. Update Purchase Order Status (PATCH /api/purchase-orders/:id/status)

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

**Payload:**

```json
{
  "status": "pending"
}
```

## Testing with Swagger UI

1. Open http://localhost:3000/docs
2. Use the "Authorize" button to add your JWT token
3. Copy-paste the payloads above into the request bodies
4. Execute the requests

## Testing with curl

```bash
# Health check
curl -X GET http://localhost:3000/health

# Get users (will require auth)
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Create supplier (will require auth)
curl -X POST http://localhost:3000/api/suppliers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "ACME Corporation",
    "contact_name": "Jane Smith",
    "contact_email": "jane.smith@acme.com",
    "is_active": true
  }'
```

## Authentication Flow

1. **First, create a user** (or use existing seed data)
2. **Login to get JWT token** via `/api/auth/login`
3. **Use the token** in Authorization header for protected endpoints

The server is running and ready to accept these payloads!
