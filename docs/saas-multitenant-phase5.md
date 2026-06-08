# Phase 5 — Auth Flow Professionnel : Documentation

## Problème résolu

Un nouveau tenant (restaurant) qui s'inscrit sur `/signup` et paie son abonnement ne pouvait pas se connecter car il n'avait pas de **code PIN**. Le login par PIN existant était conçu uniquement pour le **staff**, pas pour le propriétaire.

## Solution : double système d'authentification

| Mode | Public | Méthode | Utilisé par |
|------|--------|---------|-------------|
| **Admin** | Connexion sécurisée | Email + Mot de passe (≥8 car., 1 majuscule, 1 chiffre) | Propriétaire, Manager |
| **Staff** | Connexion rapide | Code PIN 4 chiffres (inchangé) | Serveurs, Caissiers |

## Flow complet (après correction)

```
/signup → POST /api/tenants → tenant créé
   ↓
/checkout → POST /api/tenants/:id/checkout → paiement mock/live
   ↓  (paiement confirmé)
/setup-account?tenant_id=X&email=Y&tenant_name=Z
   ↓  (étape 1 : mot de passe)
   ↓  (étape 2 : code PIN 4 chiffres)
POST /api/auth/setup → user créé (password_hash + pin_code)
   ↓
/login → email pré-rempli via ?email=X&setup=ok
   ↓  (mot de passe)
/dashboard → tout connecté avec tenant_id + tenant_name
```

## Fichiers créés / modifiés

| Fichier | Statut | Rôle |
|---------|--------|------|
| `src/pages/saas/SetupAccountPage.tsx` | **Créé** | Page en 2 étapes (password + PIN) après paiement |
| `src/server/routes/auth-setup.ts` | **Créé** | Routes backend : `/auth/setup`, `/auth/login/email`, `/auth/login/pin` |
| `backend/migrations/013_auth_refactor.sql` | **Créé** | Migration : ajoute `password_hash`, `tenant_id`, `has_setup_pin` sur `users` |
| `src/server/server.ts` | Modifié | Branchement des routes auth-setup |
| `src/App.tsx` | Modifié | Route `/setup-account` ajoutée |
| `src/stores/useAuthStore.ts` | Modifié | Interface `User` enrichie avec `tenant_id`, `tenant_name`, `tenant_slug` |
| `src/pages/auth/LoginPage.tsx` | Modifié | Lien "Pas encore de compte ?" → `/signup` |
| `src/pages/saas/CheckoutPage.tsx` | Modifié | Redirige vers `/setup-account` après paiement |
| `docs/saas-multitenant-phase5.md` | **Créé** | Cette documentation |

## Routes API Phase 5

| Méthode | URL | Description |
|---------|-----|-------------|
| `POST` | `/api/auth/setup` | Crée le compte admin (email + password + PIN). Vérifie le tenant. |
| `POST` | `/api/auth/login/email` | Connexion admin avec email + mot de passe. Retourne tenant_id + tenant_name. |
| `POST` | `/api/auth/login/pin` | Connexion staff avec PIN (inchangé mais amélioré avec tenant info). |

## Sécurité

- **Mots de passe** : hashés avec PBKDF2 (salt + 1000 itérations + SHA-512)
- **PIN** : stocké en clair (compatible avec l'existant, à migrer vers hash en Phase 6)
- **Validation** : mot de passe ≥ 8 car., 1 majuscule, 1 chiffre. PIN = 4 chiffres.
- **Tenant** : chaque utilisateur est lié à un tenant_id via la relation tenant_users

## À faire en Phase 6 (améliorations futures)

- [ ] Refactor LoginPage : double onglet "Admin" (email/password) + "Staff" (PIN)
- [ ] Afficher le tenant_name dans le Sidebar + Dashboard
- [ ] Page de réinitialisation de mot de passe
- [ ] Hacher le PIN en base de données aussi
- [ ] 2FA (Google Authenticator) pour les admins
- [ ] JWT refresh tokens pour les sessions longues
- [ ] Super-Admin Dashboard (lister/suspendre/activer les tenants)