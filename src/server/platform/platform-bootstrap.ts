// =============================================================================
// Platform Bootstrap — Création automatique du Super Admin
// =============================================================================
// S'exécute au démarrage du serveur
// Variables d'environnement:
//   PLATFORM_ADMIN_EMAIL    (default: admin@ekala.africa)
//   PLATFORM_ADMIN_PASSWORD (default: généré aléatoirement si non défini)
// =============================================================================

import * as bcrypt from 'bcryptjs';
import { db } from '../db/database';

const DEFAULT_ADMIN_EMAIL = 'admin@ekala.africa';
const DEFAULT_ADMIN_PASSWORD = 'AdminEkala2026!'; // Mot de passe par défaut sécurisé

export async function bootstrapPlatform(): Promise<void> {
  if (!db) {
    console.warn('[PlatformBootstrap] DB unavailable, skipping.');
    return;
  }

  function hasTable(tableName: string): boolean {
    try {
      const row = db.prepare(`
        SELECT 1 FROM sqlite_master
        WHERE type = 'table' AND name = ? LIMIT 1
      `).get(tableName) as any;
      return !!row;
    } catch {
      return false;
    }
  }

  try {
    console.log('[PlatformBootstrap] Vérification du super admin...');

    // Vérifier si la colonne is_platform_user existe (migration 038 appliquée)
    const tableInfo = db.prepare("PRAGMA table_info('users')").all() as any[];
    const hasIsPlatformUser = tableInfo.some((col: any) => col.name === 'is_platform_user');
    
    if (!hasIsPlatformUser) {
      console.log('[PlatformBootstrap] Migration 038 non appliquée. Application...');
      db.prepare("ALTER TABLE users ADD COLUMN is_platform_user BOOLEAN DEFAULT FALSE").run();
      db.prepare("CREATE INDEX IF NOT EXISTS idx_users_is_platform_user ON users(is_platform_user)").run();
      console.log('[PlatformBootstrap] Colonne is_platform_user ajoutée');
    }

    // Vérifier les colonnes disponibles dans users
    const userColumns = db.prepare("PRAGMA table_info('users')").all() as any[];
    const columnNames = userColumns.map((c: any) => c.name);
    const hasStatusColumn = columnNames.includes('status');
    const hasFullName = columnNames.includes('full_name');
    const hasUpdatedAt = columnNames.includes('updated_at');

    // Vérifier si un super admin existe déjà
    let existingAdmin: any = null;
    try {
      existingAdmin = db.prepare(
        "SELECT id, email, role, is_platform_user, is_active, status FROM users WHERE is_platform_user = 1 LIMIT 1"
      ).get() as any;
    } catch (e) {
      console.log('[PlatformBootstrap] Table users pas encore prête, attente...');
    }

    if (existingAdmin) {
      console.log(`[PlatformBootstrap] Super admin déjà existant: ${existingAdmin.email}`);
      console.log(`[PlatformBootstrap]    Role: ${existingAdmin.role}`);
      console.log(`[PlatformBootstrap]    Active: ${existingAdmin.is_active}`);
      console.log(`[PlatformBootstrap]    Status: ${existingAdmin.status}`);
      
      const adminEmail = process.env.PLATFORM_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
      
      // Vérifier que le super admin est actif
      if (existingAdmin.is_active !== 1 || existingAdmin.status !== 'active') {
        console.log('[PlatformBootstrap] Réactivation du super admin...');
        try {
          db.prepare("UPDATE users SET is_active = 1, status = 'active', updated_at = ? WHERE id = ?")
            .run(new Date().toISOString(), existingAdmin.id);
          console.log('[PlatformBootstrap] ✅ Super admin réactivé');
        } catch (e) {
          console.error('[PlatformBootstrap] Impossible de réactiver le super admin:', e);
        }
      }
      
      if (existingAdmin.email !== adminEmail) {
        try {
          db.prepare("UPDATE users SET email = ?, updated_at = ? WHERE id = ?")
            .run(adminEmail, new Date().toISOString(), existingAdmin.id);
          console.log(`[PlatformBootstrap] Email super admin mis à jour: ${adminEmail}`);
        } catch (e) {
          console.log('[PlatformBootstrap] Impossible de mettre à jour l\'email:', e);
        }
      }
      
      return;
    }

    // Lire les variables d'environnement
    const adminEmail = (process.env.PLATFORM_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase().trim();
    const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    // Créer le super admin avec les colonnes disponibles
    const now = new Date().toISOString();
    
    // Construire la requête dynamiquement selon les colonnes disponibles
    // Objectif: garantir exactement (insertColumns.length === insertValues.length)
    const insertColumns: string[] = [];
    const insertValues: any[] = [];

    const add = (col: string, val: any) => {
      insertColumns.push(col);
      insertValues.push(val);
    };

    add('email', adminEmail);
    // users.username est NOT NULL dans le schéma SQLite
    if (columnNames.includes('username')) {
      // Nom de login stable, non basé sur l’email pour éviter les variations
      add('username', 'super_admin');
    }

    // users.pin_code est NOT NULL dans le schéma SQLite (seedAdmin utilise '1234')
    if (columnNames.includes('pin_code')) {
      add('pin_code', '1234');
    }

    add('password_hash', passwordHash);
    // users.role est contraint (check) à: owner/admin/manager/cashier/waiter
    // On conserve le caractère "platform" via is_platform_user=1 plutôt que via le rôle.
    add('role', 'owner');
    add('is_platform_user', 1);
    add('tenant_id', null);
    add('created_at', now);

    if (hasFullName) add('full_name', 'Ekala Super Admin');
    if (hasStatusColumn) add('status', 'active');
    if (hasUpdatedAt) add('updated_at', now);

    const placeholders = insertColumns.map(() => '?').join(', ');

    const result = db.prepare(
      `INSERT INTO users (${insertColumns.join(', ')}) VALUES (${placeholders})`
    ).run(...insertValues);

    console.log(`[PlatformBootstrap] ✅ Super admin créé avec succès!`);
    console.log(`[PlatformBootstrap]    Email: ${adminEmail}`);
    console.log(`[PlatformBootstrap]    Mot de passe: ${process.env.PLATFORM_ADMIN_PASSWORD ? '(défini via variable d\'environnement)' : adminPassword}`);
    console.log(`[PlatformBootstrap]    URL: /platform/login`);
    console.log('');

    // Logger dans l'audit
    try {
      if (hasTable('billing_audit_logs')) {
        db.prepare(`
          INSERT INTO billing_audit_logs (tenant_id, user_id, action, entity_type, entity_id, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(null, null, 'bootstrap_super_admin', 'user', result.lastInsertRowid, JSON.stringify({ email: adminEmail, role: 'super_admin' }), now);
      }
    } catch (e) {
      // Table peut ne pas exister
    }

    // Créer la configuration par défaut si pas déjà faite
    try {
      db.prepare(`CREATE TABLE IF NOT EXISTS platform_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_key TEXT UNIQUE NOT NULL,
        config_value TEXT,
        description TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`).run();

      const defaultConfigs = [
        ['platform.name', 'Ekala Platform', 'Nom de la plateforme'],
        ['platform.support_email', 'support@ekala.africa', 'Email de support'],
        ['platform.admin_email', adminEmail, 'Email du super admin'],
        ['platform.bootstrap_complete', 'true', 'Indique si le bootstrap est terminé'],
        ['platform.version', '1.0.0', 'Version de la plateforme'],
        ['voucher.verification_hours', '24', 'Heures pour valider un voucher'],
        ['voucher.expiration_hours', '48', 'Heures avant expiration du voucher'],
        ['subscription.default_trial_days', '7', 'Jours d\'essai par défaut'],
        ['subscription.grace_period_days', '7', 'Jours de grâce après expiration'],
      ];

      for (const [key, value, description] of defaultConfigs) {
        db.prepare(`
          INSERT OR IGNORE INTO platform_config (config_key, config_value, description)
          VALUES (?, ?, ?)
        `).run(key, value, description);
      }

      console.log('[PlatformBootstrap] Configuration par défaut créée');
    } catch (e) {
      console.error('[PlatformBootstrap] Erreur création config:', e);
    }

  } catch (error) {
    console.error('[PlatformBootstrap] Erreur fatale:', error);
  }
}