const jwt = require('jsonwebtoken');
const https = require('https');

// Générer un token JWT valide avec le secret du .env
const JWT_SECRET = 'XVP3ucktAC82JpQ17891+UAlyO8ywEfK8Y/9RsPYlvo6DhI5ph1nxu+Fo6uYa1O3cy2zs9DmPZXpiui3xCSxrA==';
const token = jwt.sign(
  { 
    sub: 12, 
    tenant_id: 6, 
    role: 'admin',
    email: 'test@example.com'
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('Token généré:', token);
console.log('\nTestons la création de produit...\n');

// Test de création de produit
const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/products',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
};

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
    
    if (res.statusCode === 201) {
      console.log('\n✅ Produit créé avec succès !');
      console.log('Vérifiez dans Supabase dans 30 secondes maximum.');
      console.log('Ou regardez les logs du serveur pour voir le sync se déclencher.');
    } else {
      console.log('\n❌ Erreur lors de la création');
    }
  });
});

req.on('error', (e) => {
  console.error('Erreur de connexion:', e.message);
});

const productData = JSON.stringify({
  name: 'Test Sync ' + new Date().toISOString(),
  selling_price: 1000,
  buying_price: 700,
  stock_quantity: 10,
  category_id: 1
});

req.write(productData);
req.end();