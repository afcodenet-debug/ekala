const http = require('http');

console.log('=== Testing API endpoints directly ===\n');

const endpoints = [
  'http://localhost:3001/api/billing/plans',
  'http://localhost:3001/api/billing/status'
];

function testEndpoint(url) {
  return new Promise((resolve, reject) => {
    console.log(`Testing: ${url}`);
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`  Status: ${res.statusCode}`);
        console.log(`  Headers:`, res.headers);
        console.log(`  Body: ${data || '(empty)'}`);
        console.log('');
        resolve({ url, status: res.statusCode, body: data });
      });
    }).on('error', (err) => {
      console.log(`  Error: ${err.message}\n`);
      reject(err);
    });
  });
}

async function runTests() {
  for (const endpoint of endpoints) {
    try {
      await testEndpoint(endpoint);
    } catch (e) {
      console.log(`Failed to test ${endpoint}\n`);
    }
  }
}

runTests();