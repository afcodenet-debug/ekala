// Run notification queue migration
// Usage: node scripts/run_notification_migration.js

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('Running notification queue migration...');

  try {
    // Open database (same path as other scripts)
    const db = new Database('data/database.db');

    // Read migration file
    const migrationPath = path.join(__dirname, '../backend/migrations/045_notification_queue.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 50) + '...');
      
      try {
        db.exec(statement);
        console.log('✓ Success');
      } catch (err) {
        // Ignore "already exists" errors
        if (err.message.includes('already exists')) {
          console.log('⚠ Already exists, skipping');
        } else {
          throw err;
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');
    
    // Verify table was created
    const result = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='notification_queue'"
    ).get();

    if (result) {
      console.log('✓ Table notification_queue exists');
    } else {
      console.log('✗ Table notification_queue not found');
    }

    // Show table schema
    const schema = db.prepare('PRAGMA table_info(notification_queue)').all();
    console.log('\nTable schema:');
    console.table(schema);

    // Show indexes
    const indexes = db.prepare("SELECT * FROM sqlite_master WHERE type='index' AND tbl_name='notification_queue'").all();
    if (indexes.length > 0) {
      console.log('\nIndexes:');
      console.table(indexes);
    }

    db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
