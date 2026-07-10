/**
 * Script de migration: Corriger les remote_id des users
 * 
 * Usage: npx tsx scripts/fix_users_remote_ids.ts
 * 
 * Ce script:
 * 1. Récupère tous les users de SQLite
 * 2. Récupère tous les users de Supabase
 * 3. Crée un mapping par username
 * 4. Met à jour les remote_id dans SQLite
 */

import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SQLITE_PATH = process.env.SQLITE_PATH || './backend/database.sqlite';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env');
  console.error('   Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const db = new Database(SQLITE_PATH);

async function fixUsersRemoteIds() {
  console.log('🔍 Starting users remote_id fix...\n');

  try {
    // 1. Récupérer tous les users de SQLite
    console.log('📊 Fetching users from SQLite...');
    const sqliteUsers = db.prepare(`
      SELECT id, username, full_name, email, role, remote_id
      FROM users
    `).all() as any[];

    console.log(`   Found ${sqliteUsers.length} users in SQLite\n`);

    // 2. Récupérer tous les users de Supabase (pas de filtre sur le rôle)
    console.log('📊 Fetching users from Supabase...');
    const { data: supabaseUsers, error: supabaseError } = await supabase
      .from('users')
      .select('id, username, full_name, email, role');

    if (supabaseError) {
      console.error('❌ Error fetching Supabase users:', supabaseError);
      process.exit(1);
    }

    console.log(`   Found ${supabaseUsers?.length || 0} users in Supabase\n`);

    if (!supabaseUsers || supabaseUsers.length === 0) {
      console.warn('⚠️  No users found in Supabase. Exiting.');
      process.exit(0);
    }

    // 3. Créer un mapping par username
    const supabaseMap = new Map<string, number>();
    for (const user of supabaseUsers) {
      if (user.username) {
        supabaseMap.set(user.username.toLowerCase(), user.id);
      }
      if (user.email) {
        supabaseMap.set(user.email.toLowerCase(), user.id);
      }
    }

    // 4. Mettre à jour les remote_id dans SQLite
    console.log('🔄 Updating remote_id in SQLite...\n');
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    const updateStmt = db.prepare(`
      UPDATE users
      SET remote_id = ?
      WHERE id = ? AND remote_id IS NULL
    `);

    for (const sqliteUser of sqliteUsers) {
      // Chercher le match dans Supabase par username ou email
      const remoteId = 
        supabaseMap.get(sqliteUser.username?.toLowerCase() || '') ||
        supabaseMap.get(sqliteUser.email?.toLowerCase() || '');

      if (remoteId) {
        try {
          const result = updateStmt.run(remoteId, sqliteUser.id);
          if (result.changes > 0) {
            console.log(`   ✅ ${sqliteUser.username} (ID: ${sqliteUser.id} → remote_id: ${remoteId})`);
            updated++;
          } else {
            skipped++;
          }
        } catch (err) {
          console.error(`   ❌ Error updating ${sqliteUser.username}:`, err);
          errors++;
        }
      } else {
        console.log(`   ⚠️  ${sqliteUser.username} - No match in Supabase`);
        skipped++;
      }
    }

    // 5. Résumé
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Total users in SQLite: ${sqliteUsers.length}`);
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⚠️  Skipped (no match): ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log('='.repeat(60));

    if (updated > 0) {
      console.log('\n✅ Fix completed successfully!');
      console.log('   You can now test waiter assignment in cloud mode.');
    } else {
      console.log('\n⚠️  No users were updated.');
    }

    // 6. Vérification
    console.log('\n🔍 Verification:');
    const stillNull = db.prepare(`
      SELECT COUNT(*) as count
      FROM users
      WHERE remote_id IS NULL
    `).get() as any;

    console.log(`   Users with remote_id NULL: ${stillNull.count}`);

    if (stillNull.count > 0) {
      console.log('\n⚠️  Some users still have NULL remote_id:');
      const usersWithoutRemote = db.prepare(`
        SELECT id, username, role
        FROM users
        WHERE remote_id IS NULL
      `).all() as any[];
      
      for (const user of usersWithoutRemote) {
        console.log(`   - ${user.username} (ID: ${user.id}, Role: ${user.role})`);
      }
      
      console.log('\n💡 These users need to be created in Supabase first.');
    }

  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Exécuter le script
fixUsersRemoteIds().catch(err => {
  console.error('❌ Unhandled error:', err);
  process.exit(1);
});