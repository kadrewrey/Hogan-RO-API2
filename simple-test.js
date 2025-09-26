// simple-test.js - Test the API endpoints
const http = require('http');

function makeHttpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function testEndpoints() {
  console.log('🚀 Testing Hogan RO API v2 Endpoints');
  console.log('=' + '='.repeat(40));

  try {
    // Test 1: Health endpoint
    console.log('\n1. Testing Health Endpoint');
    const healthOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/health',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const healthResult = await makeHttpRequest(healthOptions);
    console.log(`   Status: ${healthResult.status}`);
    console.log(`   Response:`, JSON.stringify(healthResult.data, null, 2));

    // Test 2: Try to get users (will show auth requirement)
    console.log('\n2. Testing Users Endpoint (should require auth)');
    const usersOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/users',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const usersResult = await makeHttpRequest(usersOptions);
    console.log(`   Status: ${usersResult.status}`);
    console.log(`   Response:`, JSON.stringify(usersResult.data, null, 2));

    // Test 3: Show sample payloads
    console.log('\n3. Sample Payloads for Testing:');
    
    const samplePayloads = {
      createUser: {
        email: 'john.doe@example.com',
        password: 'SecurePassword123!',
        first_name: 'John',
        last_name: 'Doe',
        role: 'user',
        is_active: true
      },
      createSupplier: {
        name: 'ACME Corporation',
        contact_name: 'Jane Smith',
        contact_email: 'jane.smith@acme.com',
        contact_phone: '+1-555-123-4567',
        address: '123 Business Ave',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        country: 'USA',
        is_active: true
      },
      createPurchaseOrder: {
        po_number: 'PO-2025-001',
        supplier_id: 'replace-with-actual-supplier-uuid',
        status: 'draft',
        order_date: '2025-09-26T10:00:00Z',
        total_amount: 1250.00,
        currency: 'USD',
        items: [
          {
            description: 'Office Paper - A4, 500 sheets',
            quantity: 10,
            unit_price: 25.00,
            total_price: 250.00
          }
        ]
      }
    };

    console.log('   Create User Payload:');
    console.log('  ', JSON.stringify(samplePayloads.createUser, null, 2));
    
    console.log('\n   Create Supplier Payload:');
    console.log('  ', JSON.stringify(samplePayloads.createSupplier, null, 2));
    
    console.log('\n   Create Purchase Order Payload:');
    console.log('  ', JSON.stringify(samplePayloads.createPurchaseOrder, null, 2));

  } catch (error) {
    console.error('❌ Error testing endpoints:', error.message);
  }

  console.log('\n✅ Test completed!');
  console.log('💡 Use Swagger UI at http://localhost:3000/docs for interactive testing');
}

testEndpoints();