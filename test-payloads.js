// Test payloads for the Hogan RO API v2
// Run with: node test-payloads.js

const baseUrl = 'http://localhost:3000';

// Test payloads we used previously
const testPayloads = {
  // Health check
  health: {
    method: 'GET',
    endpoint: '/health',
    description: 'Health check endpoint'
  },

  // Create a new user
  createUser: {
    method: 'POST',
    endpoint: '/api/users',
    description: 'Create a new user',
    payload: {
      email: 'john.doe@example.com',
      password: 'SecurePassword123!',
      first_name: 'John',
      last_name: 'Doe',
      role: 'user',
      is_active: true
    }
  },

  // Create a new supplier
  createSupplier: {
    method: 'POST',
    endpoint: '/api/suppliers',
    description: 'Create a new supplier',
    payload: {
      name: 'ACME Corporation',
      contact_name: 'Jane Smith',
      contact_email: 'jane.smith@acme.com',
      contact_phone: '+1-555-123-4567',
      address: '123 Business Ave',
      city: 'New York',
      state: 'NY',
      zip_code: '10001',
      country: 'USA',
      tax_id: 'TAX123456789',
      payment_terms: 'Net 30',
      notes: 'Preferred supplier for office supplies',
      is_active: true
    }
  },

  // Create a new permission
  createPermission: {
    method: 'POST',
    endpoint: '/api/permissions',
    description: 'Create a new permission',
    payload: {
      name: 'View Purchase Orders',
      description: 'Allows viewing purchase order information',
      resource: 'purchase_orders',
      action: 'read'
    }
  },

  // Create a new role
  createRole: {
    method: 'POST',
    endpoint: '/api/roles',
    description: 'Create a new role',
    payload: {
      name: 'Purchase Manager',
      description: 'Can manage purchase orders and suppliers',
      is_system_role: false
    }
  },

  // Create a purchase order (this would need a valid supplier_id)
  createPurchaseOrder: {
    method: 'POST',
    endpoint: '/api/purchase-orders',
    description: 'Create a new purchase order',
    payload: {
      po_number: 'PO-2025-001',
      supplier_id: '00000000-0000-0000-0000-000000000000', // Would need actual supplier ID
      status: 'draft',
      order_date: '2025-09-26T10:00:00Z',
      expected_delivery_date: '2025-10-15T10:00:00Z',
      total_amount: 1250.00,
      currency: 'USD',
      notes: 'Quarterly office supplies order',
      items: [
        {
          description: 'Office Paper - A4, 500 sheets',
          quantity: 10,
          unit_price: 25.00,
          total_price: 250.00,
          notes: 'White, 80gsm'
        },
        {
          description: 'Blue Pens - Pack of 12',
          quantity: 5,
          unit_price: 15.00,
          total_price: 75.00
        },
        {
          description: 'Desk Chair - Ergonomic',
          quantity: 2,
          unit_price: 450.00,
          total_price: 900.00,
          notes: 'Black, adjustable height'
        }
      ]
    }
  },

  // Get users with pagination and filtering
  getUsers: {
    method: 'GET',
    endpoint: '/api/users?page=1&limit=10&role=user&active=true',
    description: 'Get users with filters'
  },

  // Get suppliers
  getSuppliers: {
    method: 'GET',
    endpoint: '/api/suppliers?page=1&limit=10&active=true',
    description: 'Get active suppliers'
  },

  // Get purchase orders
  getPurchaseOrders: {
    method: 'GET',
    endpoint: '/api/purchase-orders?page=1&limit=10&status=draft',
    description: 'Get draft purchase orders'
  }
};

async function makeRequest(test) {
  try {
    const options = {
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (test.payload) {
      options.body = JSON.stringify(test.payload);
    }

    console.log(`\n🧪 Testing: ${test.description}`);
    console.log(`📡 ${test.method} ${test.endpoint}`);
    
    if (test.payload) {
      console.log(`📦 Payload:`, JSON.stringify(test.payload, null, 2));
    }

    const response = await fetch(`${baseUrl}${test.endpoint}`, options);
    const data = await response.text();

    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    try {
      const jsonData = JSON.parse(data);
      console.log(`✅ Response:`, JSON.stringify(jsonData, null, 2));
    } catch {
      console.log(`✅ Response:`, data);
    }

    return { success: response.ok, status: response.status, data };
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting API Tests for Hogan RO API v2');
  console.log('=' .repeat(50));

  // Test health endpoint first
  await makeRequest(testPayloads.health);

  // Test other endpoints (these will likely fail due to auth requirements, but will show the structure)
  await makeRequest(testPayloads.getUsers);
  await makeRequest(testPayloads.getSuppliers);
  await makeRequest(testPayloads.getPurchaseOrders);

  console.log('\n📝 Note: POST endpoints require authentication tokens.');
  console.log('💡 Use the Swagger docs at http://localhost:3000/docs to test authenticated endpoints.');
  console.log('\n🔗 Full test payloads available above for copy-paste into Swagger UI.');
}

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
  runTests().catch(console.error);
}

// Export payloads for use in other scripts
if (typeof module !== 'undefined') {
  module.exports = testPayloads;
}