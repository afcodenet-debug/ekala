/**
 * Test que le système d'abonnement fonctionne correctement
 * Vérifie que le tenant #16 peut accéder aux ressources sans erreur SUBSCRIPTION_REQUIRED
 */
const http = require('http');

const API_BASE = 'http://localhost:3001';

// Token d'authentification pour le tenant #16 (user 31, admin)
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3eGxuc2h0b3RwYWdzeXFlZ2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODc3MDcsImV4cCI6MjA5NDI2MzcwN30.l4mPXIjN3CQUf5htv_iDjwhQfSk-QrvnMbpY5RqSqpA';

function testEndpoint(path, description) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const result = {
          path,
          description,
          status: res.statusCode,
          success: res.statusCode === 200,
          error: res.statusCode === 403 ? data : null
        };
        resolve(result);
      });
    });

    req.on('error', (err) => {
      resolve({
        path,
        description,
        status: 0,
        success: false,
        error: err.message
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        path,
        description,
        status: 0,
        success: false,
        error: 'Timeout'
      });
    });

    req.end();
  });
}

async function main() {
  console.log('=== TEST SYSTÈME D\'ABONNEMENT ===\n');
  console.log('Tenant: #16 (MAKUTANO)');
  console.log('User: #31 (admin)');
  console.log('Plan: Essai Gratuit (trial_7d)');
  console.log('Statut: active\n');
  console.log('Test des endpoints critiques...\n');

  const tests = [
    { path: '/api/products', description: 'Produits' },
    { path: '/api/categories', description: 'Catégories' },
    { path: '/api/tables', description: 'Tables' },
    { path: '/api/orders/active?waiter_id=31&role=admin', description: 'Commandes actives' },
    { path: '/api/dashboard/summary', description: 'Dashboard' },
    { path: '/api/expenses', description: 'Dépenses' }
  ];

  const results = [];
  for (const test of tests) {
    const result = await testEndpoint(test.path, test.description);
    results.push(result);
    
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${test.description.padEnd(20)} - ${result.status}`);
    
    if (result.error) {
      console.log(`   Erreur: ${result.error.substring(0, 100)}`);
    }
  }

  console.log('\n=== RÉSUMÉ ===');
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log(`Réussis: ${successCount}/${results.length}`);
  console.log(`Échoués: ${failCount}/${results.length}`);
  
  if (failCount === 0) {
    console.log('\n✅ TOUS LES TESTS SONT PASSÉS !');
    console.log('Le système d\'abonnement fonctionne correctement.');
  } else {
    console.log('\n❌ CERTAINS TESTS ONT ÉCHOUÉ');
    console.log('Vérifiez les erreurs ci-dessus.');
  }
}

main();