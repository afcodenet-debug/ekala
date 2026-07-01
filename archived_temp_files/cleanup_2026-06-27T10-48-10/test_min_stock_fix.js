/**
 * Test script to verify minimum_stock default value fix
 * This tests that products can be created with custom min stock values
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';

// Test data
const testProduct1 = {
  name: 'Test Product - Default Min Stock',
  barcode: 'TEST001',
  category_id: 1,
  buying_price: 10,
  selling_price: 20,
  stock_quantity: 50,
  unit: 'pcs',
  description: 'Test product with default minimum_stock (should be 0)'
};

const testProduct2 = {
  name: 'Test Product - Custom Min Stock 10',
  barcode: 'TEST002',
  category_id: 1,
  buying_price: 15,
  selling_price: 30,
  stock_quantity: 100,
  minimum_stock: 10,
  unit: 'pcs',
  description: 'Test product with custom minimum_stock = 10'
};

const testProduct3 = {
  name: 'Test Product - Custom Min Stock 25',
  barcode: 'TEST003',
  category_id: 1,
  buying_price: 20,
  selling_price: 40,
  stock_quantity: 200,
  minimum_stock: 25,
  unit: 'pcs',
  description: 'Test product with custom minimum_stock = 25'
};

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testProductCreation() {
  console.log('🧪 Testing minimum_stock fix...\n');

  try {
    // Test 1: Create product without minimum_stock (should default to 0)
    console.log('1️⃣ Creating product without minimum_stock field...');
    const result1 = await makeRequest('/api/products', 'POST', testProduct1);
    
    if (result1.status === 201 || result1.status === 200) {
      console.log('✅ Product 1 created successfully');
      console.log('   Response:', JSON.stringify(result1.data, null, 2));
      
      if (result1.data.minimum_stock === 0) {
        console.log('✅ minimum_stock is correctly set to 0 (default)\n');
      } else {
        console.log(`❌ ERROR: minimum_stock is ${result1.data.minimum_stock}, expected 0\n`);
      }
    } else {
      console.log(`❌ Failed to create product 1: ${result1.status}`);
      console.log('   Response:', result1.data, '\n');
    }

    // Test 2: Create product with minimum_stock = 10
    console.log('2️⃣ Creating product with minimum_stock = 10...');
    const result2 = await makeRequest('/api/products', 'POST', testProduct2);
    
    if (result2.status === 201 || result2.status === 200) {
      console.log('✅ Product 2 created successfully');
      console.log('   Response:', JSON.stringify(result2.data, null, 2));
      
      if (result2.data.minimum_stock === 10) {
        console.log('✅ minimum_stock is correctly set to 10\n');
      } else {
        console.log(`❌ ERROR: minimum_stock is ${result2.data.minimum_stock}, expected 10\n`);
      }
    } else {
      console.log(`❌ Failed to create product 2: ${result2.status}`);
      console.log('   Response:', result2.data, '\n');
    }

    // Test 3: Create product with minimum_stock = 25
    console.log('3️⃣ Creating product with minimum_stock = 25...');
    const result3 = await makeRequest('/api/products', 'POST', testProduct3);
    
    if (result3.status === 201 || result3.status === 200) {
      console.log('✅ Product 3 created successfully');
      console.log('   Response:', JSON.stringify(result3.data, null, 2));
      
      if (result3.data.minimum_stock === 25) {
        console.log('✅ minimum_stock is correctly set to 25\n');
      } else {
        console.log(`❌ ERROR: minimum_stock is ${result3.data.minimum_stock}, expected 25\n`);
      }
    } else {
      console.log(`❌ Failed to create product 3: ${result3.status}`);
      console.log('   Response:', result3.data, '\n');
    }

    console.log('✨ Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run tests
testProductCreation();