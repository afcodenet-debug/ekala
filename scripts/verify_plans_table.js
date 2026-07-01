const Database = require('better-sqlite3');
const db = new Database('data/database.db');

// Check if plans table exists
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='plans'").all();
console.log('Tables found:', tables);

if (tables.length > 0) {
  const plans = db.prepare('SELECT * FROM plans').all();
  console.log('Plans in database:', plans);
} else {
  console.log('Table plans does not exist');
}

db.close();