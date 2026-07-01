const Database = require('better-sqlite3');
const path = require('path');

// Try both possible database paths
const paths = [
  path.join(__dirname, '..', 'data', 'database.db'),
  path.join(__dirname, '..', 'backend', 'database.sqlite')
];

for (const dbPath of paths) {
  console.log(`\n=== Checking: ${dbPath} ===`);
  
  try {
    const db = new Database(dbPath, { readonly: true });
    
    // Check if plans table exists
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='plans'").all();
    console.log('Table plans exists:', tables.length > 0);
    
    if (tables.length > 0) {
      // Get schema
      const schema = db.prepare("PRAGMA table_info(plans)").all();
      console.log('Columns:', schema.map(c => c.name).join(', '));
      
      // Count
      const count = db.prepare('SELECT COUNT(*) as count FROM plans').get().count;
      console.log('Records:', count);
      
      // Try query
      try {
        const plans = db.prepare('SELECT * FROM plans LIMIT 1').all();
        console.log('Query test: OK');
      } catch (e) {
        console.log('Query test FAILED:', e.message);
      }
    }
    
    db.close();
  } catch (e) {
    console.log('Error:', e.message);
  }
}