
const Database = require('better-sqlite3');
const db = new Database('data/database.db');

console.log('--- USER SYNC FIXER ---');

// 1. Identify users that are failing in sync_outbox with "User does not exist" or similar
const failedItems = db.prepare(`
  SELECT record_id, last_error FROM sync_outbox 
  WHERE entity = 'tenant_user' AND status = 'failed'
`).all();

const usersToClear = new Set();
failedItems.forEach(item => {
  const match = item.last_error.match(/User (\d+) does not exist/);
  if (match) {
    usersToClear.add(Number(match[1]));
  }
});

if (usersToClear.size > 0) {
  console.log(`Found ${usersToClear.size} potential invalid user IDs in Supabase:`, Array.from(usersToClear));
  
  db.transaction(() => {
    for (const userId of usersToClear) {
      // Find the local user that has this remote_id
      const localUser = db.prepare('SELECT id, full_name FROM users WHERE remote_id = ?').get(userId);
      if (localUser) {
        console.log(`Clearing remote_id for local user #${localUser.id} (${localUser.full_name}) - was linked to remote #${userId}`);
        db.prepare('UPDATE users SET remote_id = NULL WHERE id = ?').run(localUser.id);
        
        // Also queue a fresh insert for this user
        // (GenericSync will handle it in the next run)
      }
    }
    
    // 2. Reset failed tenant_user items so they can be retried with the corrected user IDs
    const resetTu = db.prepare("UPDATE sync_outbox SET status = 'pending', retry_count = 0, last_error = NULL WHERE entity = 'tenant_user' AND status = 'failed'").run();
    console.log(`Reset ${resetTu.changes} failed tenant_user sync items.`);
  })();
} else {
  console.log('No "User does not exist" errors found in outbox. Clearing ALL failed tenant_user items just in case.');
  db.prepare("UPDATE sync_outbox SET status = 'pending', retry_count = 0, last_error = NULL WHERE entity = 'tenant_user' AND status = 'failed'").run();
}

console.log('Fix completed. Next sync run will re-push users and then tenant_users.');
db.close();
