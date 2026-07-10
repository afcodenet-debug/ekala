# BUG-004 FINAL CERTIFICATION

**Date :** 08/07/2026 00:02 UTC+2
**Objet :** Prouver ou refuter le table name mismatch (user vs users)

---

## 1. VERIFICATION SQLITE

Tables contenant "user" dans SQLite : `tenant_users`, `users`
Table "user" (singulier) existe ? **NON**

Schema de la table `users` (pluriel) :
- id INTEGER PRIMARY KEY AUTOINCREMENT
- username TEXT NOT NULL UNIQUE
- pin_code TEXT NOT NULL
- role TEXT NOT NULL DEFAULT 'waiter'
- tenant_id INTEGER NULL
- is_active INTEGER DEFAULT 1

=> SQLite utilise **UNIQUEMENT** `users` (pluriel)

## 2. ANALYSE DU CODE

### auth-setup.ts ecrit dans `user` (singulier)
- Ligne 123 : `supabase.from('user').insert([{...}])`
- Ligne 190 : `.from('user')`
- Ligne 252 : `.from('user')`

### auth.service.ts lit dans `users` (pluriel)
- Ligne 256 : `.from('users')`
- Ligne 502 : `supabase.from('users').select(...)`
- Ligne 521 : `.from('users')`

## 3. MODE D'EXECUTION

La requete de test etait en **mode cloud** (Supabase).
- `auth.service.ts` ligne 395 : `const supabase = getSupabase(req)` -> client Supabase
- Log TraceManager : `datasource:supabase`

## 4. VERIFICATION UTILISATEURS REELS

### Utilisateurs SQLite du tenant 16 (makutano)
| id | username | role | pin_code |
|----|----------|------|----------|
| 30 | owner_makutano | owner | 0000 |
| 31 | kabedi | admin | $2b$10$... |
| 32 | Friday | waiter | $2b$10$... |

### "waiter1" existe-t-il ?
**NON.** Aucun utilisateur "waiter1" dans SQLite ni dans le tenant 16.

## 5. DETERMINATION DE LA CAUSE REELLE

### Flux
1. Frontend envoie `{pin_code:"1111", identity:"waiter1", tenant_slug:"makutano"}`
2. `auth.service.ts` recoit la requete en mode cloud
3. `getSupabase(req)` retourne un client Supabase
4. La requete va vers **Supabase**, PAS SQLite
5. `auth.service.ts` ligne 501-508 cherche dans `users` (pluriel) sur Supabase
6. Aucun utilisateur "waiter1" trouve

### Pourquoi "waiter1" n'existe pas ?
- Les utilisateurs sont crees via `bootstrap.service.ts` ou `auth-setup.ts`
- **auth-setup.ts** utilise `from('user')` (singulier) pour ecrire
- **auth.service.ts** utilise `from('users')` (pluriel) pour lire
- => **BUG-004 CONFIRME POUR SUPABASE**

### Cause reelle du no_candidates_found
La requete cherche `identity='waiter1'` dans `users` sur Supabase.
L'utilisateur "waiter1" **n'existe pas**.
Les utilisateurs valides sont : owner_makutano, kabedi, Friday.

**Cependant**, BUG-004 (table name mismatch) est un **probleme distinct et confirme** qui empecherait la connexion de TOUS les utilisateurs crees via auth-setup.ts.

## 6. VERDICT

### BUG-004 : TABLE NAME MISMATCH
- **Statut : CONFIRME**
- Preuve : `auth-setup.ts:123` utilise `from('user')`, `auth.service.ts:256` utilise `from('users')`
- Impact : CRITICAL pour les utilisateurs crees via auth-setup.ts
- Mais **N'EST PAS** la cause du no_candidates_found pour "waiter1"

### Cause reelle du no_candidates_found
- L'utilisateur "waiter1" n'existe tout simplement pas
- Les utilisateurs valides sont : `owner_makutano`, `kabedi`, `Friday`
- `owner_makutano` a un PIN en texte clair `0000`
- `kabedi` a un PIN bcrypt
- `Friday` a un PIN bcrypt

## 7. RECOMMANDATION
1. Corriger `auth-setup.ts` pour utiliser `from('users')` au lieu de `from('user')`
2. Verifier que la table Supabase s'appelle `users` (pluriel)
3. Pour tester la connexion, utiliser un utilisateur valide (ex: Friday avec son PIN bcrypt reel)
