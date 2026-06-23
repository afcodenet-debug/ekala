/**
 * Test avec authentification réelle
 * 1. Login pour obtenir un token valide
 * 2. Test des endpoints critiques
 */
const http = require('http');

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function login() {
  console.log('1. Authentification...');
  
  const result = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'admin@ekala.africa',
    password: 'admin123'
  });

  if (result.status === 200 && result.data.token) {
    console.log('  ✓ Authentification réussie\n');
    return result.data.token;
  } else {
    console.log('  ❌ Échec de l\'authentification:', result.data);
    throw new Error('Auth failed');
  }
}

async function testEndpoints(token) {
  console.log('2. Test des endpoints...\n');
  
  const endpoints = [
    { path: '/api/products', method: 'GET', desc: 'Produits' },
    { path: '/api/categories', method: 'GET', desc: 'Catégories' },
    { path: '/api/tables', method: 'GET', desc: 'Tables' },
    { path: '/api/orders/active?waiter_id=31&role=admin', method: 'GET', desc: 'Commandes actives' },
    { path: '/api/dashboard/summary', method: 'GET', desc: 'Dashboard' },
    { path: '/api/expenses', method: 'GET', desc: 'Dépenses' }
  ];

  let passed = 0;
  let failed = 0;

  for (const ep of endpoints) {
    try {
      const result = await makeRequest({
        hostname: 'localhost',
        port: 3001,
        path: ep.path,
        method: ep.method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (result.status === 200) {
        console.log(`  ✅ ${ep.desc.padEnd(20)} - ${result.status}`);
        passed++;
      } else if (result.status === 403) {
        console.log(`  ❌ ${ep.desc.padEnd(20)} - ${result.status} (SUBSCRIPTION_REQUIRED)`);
        console.log(`     ${JSON.stringify(result.data).substring(0, 100)}`);
        failed++;
      } else {
        console.log(`  ⚠️  ${ep.desc.padEnd(20)} - ${result.status}`);
        failed++;
      }
    } catch (err) {
      console.log(`  ❌ ${ep.desc.padEnd(20)} - Erreur: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== RÉSUMÉ ===`);
  console.log(`Réussis: ${passed}/${endpoints.length}`);
  console.log(`Échoués: ${failed}/${endpoints.length}`);

  if (failed === 0) {
    console.log('\n✅ TOUS LES TESTS SONT PASSÉS !');
    console.log('Le système d\'abonnement fonctionne correctement.');
  } else {
    console.log('\n❌ CERTAINS TESTS ONT ÉCHOUÉ');
  }
}

async function main() {
  try {
    const token = await login();
    await testEndpoints(token);
  } catch (err) {
    console.error('Erreur:', err.message);
    process.exit(1);
  }
}

main();