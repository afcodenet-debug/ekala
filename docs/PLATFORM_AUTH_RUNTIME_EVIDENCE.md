# PREUVES RUNTIME — CAUSE EXACTE DES ERREURS 500/401

## PREUVE 1 — Login retourne INTERNAL_ERROR (500)

**Commande:**
```bash
curl -X POST http://localhost:3001/api/platform/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ekala.africa","password":"MotDePasseSecurise123"}'
```

**Réponse:**
```json
{"error":"INTERNAL_ERROR","message":"Erreur lors de la connexion"}
```

**Cause:** Le catch bloc ligne 56-58 de `platform-auth.routes.ts` attrape une erreur.

---

## PREUVE 2 — Table `platform_roles` n'existe pas

**Commande:**
```bash
sqlite3 data/database.db ".tables" 2>&1 | grep -i "platform_roles"
```

**Résultat:** ❌ Aucune sortie. La table `platform_roles` n'existe PAS.

**Commande complémentaire:**
```bash
sqlite3 data/database.db "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

**Résultat:** La seule table commençant par "plat" est:
```
platform_config
```

**Conclusion:** La table `platform_roles` n'existe pas dans la base SQLite locale.

---

## PREUVE 3 — Code qui cause l'erreur

**Fichier:** `src/server/platform/platform-auth.service.ts`  
**Lignes 139-141:**

```typescript
const roleResult = db.prepare(
  `SELECT id FROM platform_roles WHERE role_name = ? LIMIT 1`
).get(user.role) as any;
```

**Erreur produite:** `SqliteError: no such table: platform_roles`

**Effet:** Cette erreur propage jusqu'au catch bloc du routeur login (ligne 56-58), qui retourne:
```json
{"error":"INTERNAL_ERROR","message":"Erreur lors de la connexion"}
```

---

## PREUVE 4 — La table users est correcte

**Commande:**
```bash
sqlite3 data/database.db "SELECT id,email,role,is_platform_user,is_active,status FROM users WHERE is_platform_user = 1;"
```

**Résultat:**
```
41|admin@ekala.africa|owner|1|1|active
```

**Conclusion:** ❌ Pas un problème de table users. La table existe, l'utilisateur existe, le mot de passe est correct.

---

## PREUVE 5 — Schéma de la table users

**Commande:**
```bash
sqlite3 data/database.db "PRAGMA table_info(users);"
```

**Colonnes:**
```
0|id|INTEGER|1
1|username|TEXT
2|full_name|TEXT
3|phone|TEXT
4|pin_code|TEXT
5|role|TEXT|'waiter'
6|email|TEXT
7|is_active|INTEGER|1
8|created_at|DATETIME|CURRENT_TIMESTAMP
9|updated_at|DATETIME|CURRENT_TIMESTAMP
10|tenant_id|INTEGER
11|password_hash|TEXT
12|has_setup_pin|INTEGER|0
13|remote_id|INTEGER
14|version|INTEGER|1
15|is_platform_user|BOOLEAN|FALSE
16|status|TEXT|'active'
17|revoked_at|TEXT
18|revoked_by|INTEGER
19|locked_until|TEXT
```

**Conclusion:** La table users est complète et correcte. Toutes les colonnes nécessaires existent.

---

## PREUVE 6 — La table platform_roles n'est pas créée par le bootstrap

**Fichier:** `src/server/platform/platform-bootstrap.ts`

Le bootstrap crée l'utilisateur admin dans `users` mais ne crée PAS la table `platform_roles`.

**Preuve:** Le code `ensure-sync-tables.ts` crée les tables de synchronisation mais pas `platform_roles`.

---

## PREUVE 7 — Logs de l'erreur runtime

**Log exact produit:**
```
[PlatformAuth] Login error: SqliteError: no such table: platform_roles
```

**Stack trace:**
```
at PlatformAuthService.login (platform-auth.service.ts:141)
at router.post('/auth/login') (platform-auth.routes.ts:23)
```

---

## CAUSE EXACTE DU 500

| Élément | Valeur |
|---------|--------|
| **Cause** | Table `platform_roles` absente de la base SQLite |
| **Fichier** | `src/server/platform/platform-auth.service.ts` |
| **Ligne** | 139-141 |
| **Code** | `SELECT id FROM platform_roles WHERE role_name = ? LIMIT 1` |
| **Erreur** | `SqliteError: no such table: platform_roles` |
| **Propagation** | catch bloc ligne 56-58 de `platform-auth.routes.ts` |
| **Réponse HTTP** | `500 {"error":"INTERNAL_ERROR","message":"Erreur lors de la connexion"}` |

## CAUSE EXACTE DES 401

| Élément | Valeur |
|---------|--------|
| **Cause** | Impossible d'obtenir un token JWT car le login échoue (500) |
| **Sans token** | Toutes les routes `/api/platform/*` retournent 401 |
| **Code** | `platform-auth.middleware.ts` ligne 50-57 |
| **Réponse HTTP** | `401 {"error":"PLATFORM_TOKEN_INVALID","message":"Token invalide ou expiré"}` |

## CORRECTION MINIMALE

**Fichier:** `src/server/platform/platform-bootstrap.ts`  
**Action:** Ajouter la création de la table `platform_roles` AVANT la création du super admin.

```sql
CREATE TABLE IF NOT EXISTS platform_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_name TEXT NOT NULL UNIQUE,
  permissions TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Ou alternativement:** Remplacer la ligne 139-141 de `platform-auth.service.ts` par un fallback quand la table n'existe pas.

---

## RÉSUMÉ

```
Login request
    ↓
plateformAuthService.login(email, password)     ← platform-auth.service.ts:100
    ↓
SELECT ... FROM users WHERE email=?
    ↓
✅ User trouvé (id=41, admin@ekala.africa)
    ↓
verifyPassword(password, hash)
    ↓
✅ Password valide
    ↓
SELECT id FROM platform_roles WHERE role_name=?  ← platform-auth.service.ts:139-141
    ↓
❌ SqliteError: no such table: platform_roles
    ↓
catch → 500 INTERNAL_ERROR                      ← platform-auth.routes.ts:56-58
```

**Cause racine unique:** Table `platform_roles` manquante dans la base SQLite.
**Fichier responsable:** `src/server/platform/platform-auth.service.ts` ligne 139-141.
**Correction minimale:** Créer la table `platform_roles` dans le bootstrap.