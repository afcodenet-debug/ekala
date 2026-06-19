
const Database = require('better-sqlite3');
const { initializeSyncV2 } = require('../src/sync');
require('dotenv').config();

const db = new Database('data/database.db');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const orchestrator = initializeSyncV2(db, supabaseUrl, supabaseKey);

async function runSync() {
  console.log('Triggering manual sync...');
  await orchestrator.triggerSync();
  console.log('Sync finished.');
  db.close();
}

runSync().catch(err => {
  console.error('Sync failed:', err);
  db.close();
});
