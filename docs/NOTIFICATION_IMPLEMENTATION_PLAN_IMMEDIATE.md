# NOTIFICATION IMPLEMENTATION PLAN — SEMAINE 1

**Date:** 29 Juin 2026  
**Objectif:** Premier API endpoint fonctionnel  
**Durée:** 5 jours  
**Équipe:** 1-2 ingénieurs

---

## JOUR 1 : Setup environnement

### Matin (2h)
- [ ] Installer PostgreSQL local
- [ ] Installer Redis local
- [ ] Configurer .env avec credentials
- [ ] Tester connexion DB

### Après-midi (4h)
- [ ] Créer database `ekala_notifications`
- [ ] Créer user dédié
- [ ] Configurer migrations
- [ ] Tester connexion depuis app

**Livrable:** Environnement de dev opérationnel

---

## JOUR 2 : Database schema

### Matin (3h)
- [ ] Créer migration 001: notifications table
  ```sql
  CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    title VARCHAR(100) NOT NULL,
    message VARCHAR(500) NOT NULL,
    body TEXT,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    dismissed BOOLEAN DEFAULT FALSE,
    archived BOOLEAN DEFAULT FALSE,
    actionable BOOLEAN DEFAULT FALSE,
    payload JSONB,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    read_at TIMESTAMP,
    expires_at TIMESTAMP
  );
  ```

### Après-midi (3h)
- [ ] Créer migration 002: notification_recipients table
- [ ] Créer migration 003: notification_preferences table
- [ ] Créer indexes
- [ ] Tester migrations

**Livrable:** Schema DB complet

---

## JOUR 3 : Repository pattern

### Matin (3h)
- [ ] Créer `src/server/notifications/repositories/NotificationRepository.ts`
- [ ] Implémenter CRUD basique
- [ ] Créer tests unitaires

### Après-midi (3h)
- [ ] Créer `NotificationRecipientRepository.ts`
- [ ] Créer `NotificationPreferenceRepository.ts`
- [ ] Tester repositories

**Livrable:** Repositories fonctionnels

---

## JOUR 4 : API Routes

### Matin (3h)
- [ ] Créer `src/server/routes/notifications.routes.ts`
- [ ] Implémenter POST /api/notifications/commands/create
- [ ] Implémenter GET /api/notifications/queries/list
- [ ] Tester avec Postman/curl

### Après-midi (3h)
- [ ] Implémenter POST /api/notifications/commands/mark-as-read
- [ ] Implémenter GET /api/notifications/queries/{id}
- [ ] Ajouter validation
- [ ] Tester endpoints

**Livrable:** 4 API endpoints fonctionnels

---

## JOUR 5 : Intégration + Tests

### Matin (3h)
- [ ] Connecter API aux repositories
- [ ] Connecter Event Bus
- [ ] Tester flow complet

### Après-midi (3h)
- [ ] Tests manuels E2E
- [ ] Documenter API
- [ ] Commit + push

**Livrable:** Système basique fonctionnel

---

## CRITÈRES DE SUCCÈS

### Fonctionnels
- [ ] POST /api/notifications/commands/create fonctionne
- [ ] GET /api/notifications/queries/list retourne notifications
- [ ] POST /api/notifications/commands/mark-as-read fonctionne
- [ ] Notifications persistées en DB
- [ ] Event Bus émet événements

### Techniques
- [ ] Tests manuels passent
- [ ] Pas d'erreur console
- [ ] Code commité
- [ ] Documentation API à jour

---

## DÉCISIONS À PRENDRE

### D1: Database
**Question:** PostgreSQL ou SQLite?  
**Recommandation:** PostgreSQL (meilleure performance, features)  
**Décision requise:** Valider avec équipe

### D2: ORM
**Question:** Prisma, TypeORM, ou raw SQL?  
**Recommandation:** Prisma (meilleure DX, type safety)  
**Décision requise:** Valider avec équipe

### D3: Validation
**Question:** Zod, Joi, ou class-validator?  
**Recommandation:** Zod (meilleure DX, TypeScript native)  
**Décision requise:** Valider avec équipe

---

## PROCHAINES ÉTAPES (SEMAINE 2)

1. **Policy Engine basique**
   - Recipient resolution
   - Channel selection
   - Template selection

2. **Delivery basique**
   - Email channel (déjà existant)
   - Toast channel (frontend)
   - Badge channel (frontend)

3. **Frontend**
   - Refactorer NotificationCenter
   - Créer NotificationBadge
   - Connecter aux API

---

## NOTES

**Approche:** Incremental, testée, validée à chaque étape  
**Risque:** Faible (scope limité, validation continue)  
**Rollback:** Possible à tout moment (git revert)

**Communication:**
- Daily standup: 15min
- Demo vendredi: 30min
- Documentation: Continue

---

**FIN DU DOCUMENT**

*Ce document fait partie du Notification Design System officiel d'Ekala.*