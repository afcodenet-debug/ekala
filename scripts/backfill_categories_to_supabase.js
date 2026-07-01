#!/usr/bin/env node
/**
 * Backfill categories from SQLite (source of truth) to Supabase
 * This ensures all categories that exist in SQLite are also in Supabase
 */

const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || './data/database.db';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const db = new Database(SQLITE_DB_PATH);

async function backfillCategories() {
  console.log('🔄 Starting category backfill from SQLite to Supabase...\n');

  try {
    // 1. Get all categories from SQLite (source of truth)
    const sqliteCategories = db.prepare(`
      SELECT id, name, description, display_order, is_active, tenant_id, remote_id, created_at, updated_at
      FROM categories
      WHERE deleted_at IS NULL
      ORDER BY id
    `).all();

    console.log(`📊 Found ${sqliteCategories.length} categories in SQLite\n`);

    // 2. Get all categories from Supabase
    const { data: supabaseCategories, error: fetchError } = await supabase
      .from('categories')
      .select('id, name, tenant_id, description, created_at, updated_at')
      .order('name', { ascending: true });

    if (fetchError) {
      console.error('❌ Error fetching Supabase categories:', fetchError);
      process.exit(1);
    }

    console.log(`📊 Found ${supabaseCategories.length} categories in Supabase\n`);

    // 3. Create a map of Supabase categories by (name, tenant_id) for easy lookup
    const supabaseMap = new Map();
    (supabaseCategories || []).forEach(cat => {
      const key = `${cat.name}-${cat.tenant_id}`;
      supabaseMap.set(key, cat);
    });

      // 4. Compare and find missing categories
    const toInsert = [];
    const toUpdate = [];

    for (const sqliteCat of sqliteCategories) {
      const key = `${sqliteCat.name}-${sqliteCat.tenant_id}`;
      const remoteCat = supabaseMap.get(key);

      if (!remoteCat) {
        // Category exists in SQLite but not in Supabase - needs to be inserted
        toInsert.push({
          name: sqliteCat.name,
          description: sqliteCat.description,
          tenant_id: sqliteCat.tenant_id,
          created_at: sqliteCat.created_at,
          updated_at: sqliteCat.updated_at,
        });
        console.log(`➕ Will INSERT: "${sqliteCat.name}" (tenant ${sqliteCat.tenant_id})`);
      } else {
        // Category exists in both - check if update needed
        console.log(`✅ Already exists: "${sqliteCat.name}" (tenant ${sqliteCat.tenant_id})`);
      }
    }

    // 5. Insert missing categories
    if (toInsert.length > 0) {
      console.log(`\n🚀 Inserting ${toInsert.length} missing categories to Supabase...\n`);

      const { data: inserted, error: insertError } = await supabase
        .from('categories')
        .insert(toInsert)
        .select('id, name, tenant_id');

      if (insertError) {
        console.error('❌ Error inserting categories:', insertError);
        process.exit(1);
      }

      console.log(`✅ Successfully inserted ${inserted?.length || 0} categories:\n`);
      (inserted || []).forEach(cat => {
        console.log(`   - ${cat.name} (tenant ${cat.tenant_id}) → remote_id: ${cat.id}`);
      });

      // 6. Update remote_id in SQLite for newly inserted categories
      if (inserted && inserted.length > 0) {
        const updateStmt = db.prepare(`
          UPDATE categories
          SET remote_id = ?
          WHERE name = ? AND tenant_id = ? AND remote_id IS NULL
        `);

        const updateMany = db.transaction(() => {
          inserted.forEach(remoteCat => {
            const sqliteCat = sqliteCategories.find(
              c => c.name === remoteCat.name && c.tenant_id === remoteCat.tenant_id
            );
            if (sqliteCat) {
              const result = updateStmt.run(remoteCat.id, remoteCat.name, remoteCat.tenant_id);
              console.log(`\n🔗 Updated remote_id for "${remoteCat.name}" (local id: ${sqliteCat.id} → remote id: ${remoteCat.id})`);
            }
          });
        });

        updateMany();
      }
    } else {
      console.log('\n✅ All categories already exist in Supabase. No action needed.');
    }

    console.log('\n🎉 Category backfill completed successfully!');

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run the backfill
backfillCategories().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});