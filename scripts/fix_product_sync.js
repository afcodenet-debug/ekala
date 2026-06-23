/**
 * Diagnostic + Fix complet pour la sync des produits vers Supabase
 * 1. Vérifie l'état de sync_outbox
 * 2. Force le re-queue des produits en 'done' vers 'pending'
 * 3. Déclenche un sync immédiat via l'API
 */
const http = require('http');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.resolve(__dirname, '..', 'data', 'database.db');
const API_BASE = 'http://localhost:3001';

function main() {
  console.log('=== FIX PRODUCT SYNC ===\n');
  
  // 1. État actuel
  const db = new Database(DB_PATH);
  const before = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM sync_outbox
    WHERE entity = 'product'
    GROUP BY status
  `).all();
  
  console.log('État sync_outbox (AVANT):');
  console.table(before);
  
  // 2. Force re-queue
  const result = db.prepare(`
    UPDATE sync_outbox 
    SET status = 'pending', 
        retry_count = 0, 
        last_error = NULL,
        updated_at = datetime('now')
    WHERE entity = 'product'
      AND status = 'done'
  `).run();
  
  console.log(`\nRe-queued: ${result.changes} products\n`);
  
  // 3. État après
  const after = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM sync_outbox
    WHERE entity = 'product'
    GROUP BY status
  `).all();
  
  console.log('État sync_outbox (APRÈS):');
  console.table(after);
  
  db.close();
  
  // 4. Déclencher sync immédiat via API
  console.log('\nDéclenchement du sync via API...');
  triggerSync();
}

function triggerSync() {
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/sync/trigger',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  };
  
  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('Réponse API:', res.statusCode, data);
      console.log('\n=== SYNC DÉCLENCHÉ ===');
      console.log('Vérifiez les logs du serveur pour voir [SUPABASE PUSH]');
    });
  });
  
  req.on('error', (err) => {
    console.error('Erreur API:', err.message);
    console.log('\nSi le serveur n\'est pas accessible, redémarrez-le avec: npm run dev');
  });
  
  req.write(JSON.stringify({ tenant_id: 16 }));
  req.end();
}

main();