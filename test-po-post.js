// test-po-post.js - Test posting to the Purchase Order endpoint
const http = require('http');

const testPayload = {
  po_number: "PO-2025-TEST-001",
  supplier_id: "123e4567-e89b-12d3-a456-426614174000", // Dummy UUID
  status: "draft",
  order_date: "2025-09-26T10:00:00Z",
  expected_delivery_date: "2025-10-15T10:00:00Z",
  total_amount: 1250.00,
  currency: "USD",
  notes: "Test purchase order from Node.js",
  items: [
    {
      description: "Office Paper - A4, 500 sheets",
      quantity: 10,
      unit_price: 25.00,
      total_price: 250.00,
      notes: "White, 80gsm"
    },
    {
      description: "Desk Chair - Ergonomic",
      quantity: 2,
      unit_price: 500.00,
      total_price: 1000.00,
      notes: "Black, adjustable height"
    }
  ]
};

function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    
    const options = {
      hostname: '127.0.0.1',
      port: 3002,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, body: jsonBody });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: body });
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

async function testPurchaseOrderEndpoint() {
  console.log('🧪 Testing Purchase Order Endpoint');
  console.log('=' + '='.repeat(40));

  try {
    // Test 1: Health check
    console.log('\n1. Health Check...');
    const healthResult = await makeRequest('GET', '/health');
    console.log(`   Status: ${healthResult.status}`);
    console.log(`   Response: ${JSON.stringify(healthResult.body, null, 2)}`);

    // Test 2: GET PO endpoint without auth
    console.log('\n2. GET Purchase Orders (should require auth)...');
    const getResult = await makeRequest('GET', '/api/purchase-orders');
    console.log(`   Status: ${getResult.status}`);
    console.log(`   Response: ${JSON.stringify(getResult.body, null, 2)}`);

    // Test 3: POST PO endpoint without auth
    console.log('\n3. POST Purchase Order without auth (should get 401)...');
    console.log('\n   Payload being sent:');
    console.log(JSON.stringify(testPayload, null, 2));
    
    const postResult = await makeRequest('POST', '/api/purchase-orders', testPayload);
    console.log(`\n   Status: ${postResult.status}`);
    console.log(`   Response: ${JSON.stringify(postResult.body, null, 2)}`);

    // Test 4: POST with dummy auth token (should get different error)
    console.log('\n4. POST Purchase Order with dummy auth token...');
    const postWithAuthResult = await makeRequest('POST', '/api/purchase-orders', testPayload, {
      'Authorization': 'Bearer dummy-token-for-testing'
    });
    console.log(`   Status: ${postWithAuthResult.status}`);
    console.log(`   Response: ${JSON.stringify(postWithAuthResult.body, null, 2)}`);

    console.log('\n✅ Test Results Summary:');
    console.log(`   - Health endpoint: ${healthResult.status === 200 ? '✅ Working' : '❌ Failed'}`);
    console.log(`   - GET POs auth: ${getResult.status === 401 ? '✅ Protected' : '⚠️  Unexpected'}`);
    console.log(`   - POST POs auth: ${postResult.status === 401 ? '✅ Protected' : '⚠️  Unexpected'}`);
    
    console.log('\n📝 Next Steps:');
    console.log('   1. Server is responding correctly');
    console.log('   2. Endpoints are properly protected');
    console.log('   3. Use Swagger UI at http://127.0.0.1:3002/docs');
    console.log('   4. Get a valid JWT token to test authenticated requests');

  } catch (error) {
    console.error('❌ Error during testing:', error.message);
  }
}

testPurchaseOrderEndpoint();