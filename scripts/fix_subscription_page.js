// Script à exécuter dans la console du navigateur (F12 > Console)
// pour vider le cache et recharger les données d'abonnement

console.log('=== FIX SUBSCRIPTION PAGE ===\n');

// 1. Vider le localStorage
localStorage.removeItem('ekala-auth');
console.log('✅ localStorage vidé');

// 2. Recharger la page
console.log('🔄 Rechargement de la page...');
setTimeout(() => {
  location.reload();
}, 500);