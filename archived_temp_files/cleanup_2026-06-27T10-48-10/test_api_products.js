/**
 * Test API to check how many products are returned
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
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
    req.end();
  });
}

async function testAPI() {
  console.log('🧪 Testing API endpoints...\n');

  try {
    // Test products endpoint
    console.log('1️⃣ GET /api/products');
    const result = await makeRequest('/api/products');
    console.log(`   Status: ${result.status}`);
    
    if (result.status === 200 && Array.isArray(result.data)) {
      console.log(`   ✅ Found ${result.data.length} products`);
      result.data.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.name} (tenant_id: ${p.tenant_id})`);
      });
    } else {
      console.log('   ❌ Unexpected response:', JSON.stringify(result.data, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAPI();