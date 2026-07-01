// Script pour vider le cache des abonnements
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5173,
  path: '/api/admin/clear-subscription-cache',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

console.log('=== VIDANGE DU CACHE D\'ABONNEMENT ===\n');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
    
    if (res.statusCode === 200) {
      console.log('\n✅ Cache vidé avec succès !');
      console.log('\nMaintenant, rechargez la page http://localhost:5173/settings/subscription');
      console.log('Les données devraient s\'afficher correctement.');
    } else {
      console.log('\n❌ Erreur lors du vidage du cache');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Erreur de connexion:', error.message);
  console.log('\nAssurez-vous que le serveur backend est démarré sur le port 5173');
});

req.write(JSON.stringify({}));
req.end();