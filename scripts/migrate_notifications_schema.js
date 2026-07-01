#!/usr/bin/env node

/**
 * Migration script for notifications table
 * Migrates from old schema to new V3 schema
 */

const Database = require('better-sqlite3');
const path = require('path');

const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'database.db');

console.log('📊 Database path:', dbPath);

let db;
try {
  db = new Database(dbPath);
  console.log('✅ Database connected\n');
} catch (error) {
  console.error('❌ Failed to connect to database:', error.message);
  process.exit(1);
}

// Check current table structure
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Checking current notifications table...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const tableInfo = db.prepare("PRAGMA table_info(notifications)").all();
const columns = tableInfo.map(c => c.name);

console.log('Current columns:', columns.join(', '));

// Check if already migrated
const hasNewSchema = columns.includes('notification_id') && columns.includes('tenant_id');

if (hasNewSchema) {
  console.log('\n✅ Table already has V3 schema. No migration needed.');
  db.close();
  process.exit(0);
}

console.log('\n⚠️  Table has old schema. Starting migration...\n');

// Start migration
const transaction = db.transaction(() => {
  console.log('1️⃣  Creating new notifications table with V3 schema...');
  
  // Create new table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications_new (
      notification_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      body TEXT,
      category TEXT NOT NULL DEFAULT 'system',
      priority TEXT NOT NULL DEFAULT 'medium',
      severity TEXT NOT NULL DEFAULT 'info',
      type TEXT NOT NULL DEFAULT 'alert',
      status TEXT NOT NULL DEFAULT 'created',
      read INTEGER DEFAULT 0,
      dismissed INTEGER DEFAULT 0,
      archived INTEGER DEFAULT 0,
      actionable INTEGER DEFAULT 0,
      requires_response INTEGER DEFAULT 0,
      response_deadline TEXT,
      toast INTEGER DEFAULT 1,
      badge INTEGER DEFAULT 1,
      banner INTEGER DEFAULT 0,
      center INTEGER DEFAULT 1,
      push INTEGER DEFAULT 0,
      email INTEGER DEFAULT 0,
      sms INTEGER DEFAULT 0,
      merged INTEGER DEFAULT 0,
      merged_into TEXT,
      merge_count INTEGER DEFAULT 0,
      language TEXT DEFAULT 'fr',
      timezone TEXT DEFAULT 'Africa/Lusaka',
      sensitivity TEXT DEFAULT 'internal',
      encrypted INTEGER DEFAULT 0,
      audited INTEGER DEFAULT 1,
      source TEXT,
      source_id TEXT,
      event_type TEXT,
      event_version TEXT,
      payload TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      scheduled_at TEXT,
      expires_at TEXT,
      read_at TEXT,
      processed_at TEXT,
      archived_at TEXT,
      deleted_at TEXT
    )
  `);

  console.log('2️⃣  Migrating data from old table...');

  // Migrate data
  const insert = db.prepare(`
    INSERT INTO notifications_new (
      notification_id, tenant_id, user_id, title, message, body,
      category, priority, severity, type, status,
      read, dismissed, archived, actionable, requires_response,
      toast, badge, banner, center, push, email, sms,
      language, timezone, sensitivity, encrypted, audited,
      source, source_id, event_type, event_version,
      payload, metadata,
      created_at, updated_at, read_at, deleted_at
    )
    SELECT 
      CASE 
        WHEN id IS NOT NULL THEN CAST(id AS TEXT)
        ELSE 'legacy-' || rowid
      END as notification_id,
      'default' as tenant_id,
      COALESCE(user_id, 'system') as user_id,
      title,
      message,
      NULL as body,
      COALESCE(type, 'system') as category,
      COALESCE(priority, 'medium') as priority,
      'info' as severity,
      COALESCE(notification_type, 'alert') as type,
      CASE 
        WHEN read_at IS NOT NULL THEN 'read'
        ELSE 'created'
      END as status,
      CASE WHEN read_at IS NOT NULL THEN 1 ELSE 0 END as read,
      0 as dismissed,
      0 as archived,
      0 as actionable,
      0 as requires_response,
      1 as toast,
      1 as badge,
      0 as banner,
      1 as center,
      0 as push,
      0 as email,
      0 as sms,
      'fr' as language,
      'Africa/Lusaka' as timezone,
      'internal' as sensitivity,
      0 as encrypted,
      1 as audited,
      NULL as source,
      link as source_id,
      NULL as event_type,
      NULL as event_version,
      COALESCE(metadata, '{}') as payload,
      '{}' as metadata,
      created_at,
      updated_at,
      read_at,
      NULL as deleted_at
    FROM notifications
  `);

  const result = insert.run();
  console.log(`   ✅ Migrated ${result.changes} notifications`);

  console.log('3️⃣  Dropping old table...');
  db.exec('DROP TABLE notifications');

  console.log('4️⃣  Renaming new table...');
  db.exec('ALTER TABLE notifications_new RENAME TO notifications');

  console.log('5️⃣  Creating indexes...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user 
      ON notifications(tenant_id, user_id, created_at DESC)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_notifications_category 
      ON notifications(tenant_id, category, created_at DESC)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_notifications_priority 
      ON notifications(tenant_id, priority, created_at DESC)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_notifications_read 
      ON notifications(tenant_id, read, created_at DESC)
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_notifications_unread 
      ON notifications(tenant_id, user_id, created_at DESC) 
      WHERE read = 0 AND deleted_at IS NULL
  `);

  console.log('6️⃣  Verifying migration...');
  
  const count = db.prepare('SELECT COUNT(*) as count FROM notifications').get();
  console.log(`   ✅ Total notifications: ${count.count}`);

  const sample = db.prepare('SELECT * FROM notifications LIMIT 1').get();
  if (sample) {
    console.log('   ✅ Sample notification:', {
      id: sample.notification_id,
      title: sample.title,
      category: sample.category,
      priority: sample.priority
    });
  }
});

console.log('Starting migration transaction...\n');
try {
  transaction();
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Migration completed successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
} catch (error) {
  console.error('\n❌ Migration failed:', error);
  db.close();
  process.exit(1);
}

// Verify final structure
console.log('Final table structure:');
const finalColumns = db.prepare("PRAGMA table_info(notifications)").all();
console.log('Columns:', finalColumns.map(c => c.name).join(', '));

db.close();
console.log('\n✅ Database connection closed');