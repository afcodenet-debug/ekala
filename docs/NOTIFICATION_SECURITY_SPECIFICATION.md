# NOTIFICATION SECURITY SPECIFICATION — EKALA

**Version:** 1.0.0  
**Date:** 29 Juin 2026  
**Statut:** OFFICIEL  
**Niveau:** Enterprise  
**Compliance:** GDPR, SOC 2, ISO 27001

---

## TABLE DES MATIÈRES

1. [Vue d'ensemble](#1-vue-densemble)
2. [RBAC](#2-rbac)
3. [ABAC](#3-abac)
4. [Multi-tenant Isolation](#4-multi-tenant-isolation)
5. [Authorization Matrix](#5-authorization-matrix)
6. [Authentication assumptions](#6-authentication-assumptions)
7. [Encryption at Rest](#7-encryption-at-rest)
8. [Encryption in Transit](#8-encryption-in-transit)
9. [Notification Integrity](#9-notification-integrity)
10. [Replay Protection](#10-replay-protection)
11. [Audit Integrity](#11-audit-integrity)
12. [Data Retention](#12-data-retention)
13. [GDPR / Privacy](#13-gdpr--privacy)
14. [PII Classification](#14-pii-classification)
15. [Secret Management](#15-secret-management)
16. [Security Monitoring](#16-security-monitoring)
17. [Incident Response](#17-incident-response)

---

## 1. VUE D'ENSEMBLE

### 1.1 Philosophie

**Security by Design:**
- Sécurité intégrée dès la conception
- Defense in depth
- Zero trust architecture
- Least privilege principle

### 1.2 Principes

**Confidentiality:**
- Chiffrement des données sensibles
- Accès basé sur les rôles
- Isolation multi-tenant

**Integrity:**
- Protection contre la modification
- Audit trail complet
- Signature des événements

**Availability:**
- Protection DDoS
- Rate limiting
- Circuit breakers

**Accountability:**
- Traçabilité complète
- Audit logging
- Non-repudiation

---

## 2. RBAC

### 2.1 Définition

**Role-Based Access Control:** Contrôle d'accès basé sur les rôles

### 2.2 Rôles

**Owner:**
- Permissions: *
- Accès: Full
- Portée: Tenant

**Admin:**
- Permissions: notification:*, user:*, tenant:*
- Accès: Full sauf platform
- Portée: Tenant

**Manager:**
- Permissions: notification:read, notification:write, order:*, inventory:*
- Accès: Opérationnel
- Portée: Tenant

**Cashier:**
- Permissions: notification:read, order:read, order:write
- Accès: Limité
- Portée: Tenant

**Waiter:**
- Permissions: notification:read, order:read, table:read
- Accès: Très limité
- Portée: Tenant

**Customer:**
- Permissions: notification:read, notification:write (own)
- Accès: Lecture seule + actions propres
- Portée: Own notifications

### 2.3 Permissions

**Notification Permissions:**
- notification:read - Lire notifications
- notification:write - Créer/modifier notifications
- notification:delete - Supprimer notifications
- notification:admin - Administrer notifications

**Resource Permissions:**
- order:read, order:write, order:delete
- inventory:read, inventory:write
- table:read, table:write
- staff:read, staff:write
- billing:read, billing:write

### 2.4 Implementation

**Token Claims:**
```json
{
  "userId": "uuid",
  "tenantId": "uuid",
  "roles": ["manager"],
  "permissions": ["notification:read", "order:write"],
  "expiresAt": "ISO8601"
}
```

**Middleware:**
- Vérifier JWT
- Extraire roles/permissions
- Vérifier accès ressource
- Log décision

---

## 3. ABAC

### 3.1 Définition

**Attribute-Based Access Control:** Contrôle d'accès basé sur les attributs

### 3.2 Attributs

**User Attributes:**
- userId
- tenantId
- roles[]
- permissions[]
- department
- location
- deviceType

**Resource Attributes:**
- resourceType
- resourceOwner
- resourceTenant
- resourceSensitivity
- resourceCategory

**Environment Attributes:**
- ipAddress
- timeOfDay
- dayOfWeek
- location
- deviceTrusted

### 3.3 Policies

**Exemple 1: Time-based**
```
IF user.role == "cashier"
  AND environment.timeOfDay NOT IN ["08:00", "22:00"]
  AND resource.type == "notification"
THEN DENY
```

**Exemple 2: Location-based**
```
IF user.location != resource.location
  AND resource.sensitivity == "confidential"
THEN DENY
```

**Exemple 3: Device-based**
```
IF environment.deviceTrusted == false
  AND resource.sensitivity IN ["confidential", "restricted"]
THEN DENY
```

---

## 4. MULTI-TENANT ISOLATION

### 4.1 Strategy

**Shared Database, Shared Schema:**
- Une seule base de données
- tenant_id sur toutes les tables
- Isolation logique

### 4.2 Implementation

**Query Pattern:**
```sql
SELECT * FROM notifications
WHERE tenant_id = :tenantId
  AND user_id = :userId
```

**Cache Pattern:**
```
Key: notification:{tenantId}:{userId}:{notificationId}
```

**Queue Pattern:**
```
Queue: notifications-{tenantId}
```

### 4.3 Validation

**Every Request:**
- Vérifier X-Tenant-ID header
- Vérifier JWT tenant_id claim
- Valider cohérence
- Reject si mismatch

**Every Query:**
- Ajouter tenant_id filter
- Vérifier résultats
- Log accès

### 4.4 Isolation Levels

**Row-Level Security:**
- Chaque ligne a tenant_id
- Filtre automatique
- Pas de cross-tenant access

**Column-Level Security:**
- PII columns chiffrées
- Accès restreint
- Audit logging

---

## 5. AUTHORIZATION MATRIX

### 5.1 Matrice complète

| Action | Owner | Admin | Manager | Cashier | Waiter | Customer |
|--------|-------|-------|---------|---------|--------|----------|
| Create notification | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ (own) |
| Read own notifications | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Read all notifications | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Update notification | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete notification | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Execute action | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (own) |
| Update preferences | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (own) |
| View audit logs | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage policies | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage channels | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### 5.2 Rules

**Read:**
- Users can read own notifications
- Managers can read tenant notifications
- Admins can read all tenant notifications
- Owners can read everything

**Write:**
- Only authorized roles can create
- Only owner/admin can update
- Only owner/admin can delete

**Execute:**
- Users can execute actions on own notifications
- Managers can execute on tenant notifications

---

## 6. AUTHENTICATION ASSUMPTIONS

### 6.1 Methods

**Primary: JWT**
- Algorithm: RS256
- Expiration: 1h
- Refresh: 7 jours
- Storage: HttpOnly cookie

**Fallback: Session**
- Server-side session
- Expiration: 24h
- Storage: Redis

**Service-to-Service: API Key**
- Header: X-API-Key
- Rotation: 90 jours
- Storage: Vault

### 6.2 Token Structure

**JWT Payload:**
```json
{
  "sub": "user-uuid",
  "tenantId": "tenant-uuid",
  "roles": ["manager"],
  "permissions": ["notification:read"],
  "iat": 1234567890,
  "exp": 1234567890
}
```

**Claims:**
- sub: Subject (user ID)
- tenantId: Tenant ID
- roles: Array of roles
- permissions: Array of permissions
- iat: Issued at
- exp: Expiration

### 6.3 Validation

**Every Request:**
1. Verify JWT signature
2. Check expiration
3. Extract claims
4. Validate tenant
5. Check permissions

**Failure:**
- Invalid signature → 401
- Expired → 401
- Missing claims → 403
- Invalid tenant → 403

---

## 7. ENCRYPTION AT REST

### 7.1 Strategy

**Database Encryption:**
- AES-256-GCM
- Key rotation: 90 jours
- Per-tenant keys (optionnel)

**File Encryption:**
- Attachments chiffrées
- AES-256-CBC
- Key per file

### 7.2 Implementation

**Sensitive Fields:**
- email
- phone
- address
- payment info

**Encryption:**
```sql
-- Champs chiffrés
email_encrypted: BYTEA
phone_encrypted: BYTEA

-- Déchiffrement
SELECT decrypt(email_encrypted, key) as email
FROM users
WHERE user_id = :userId
```

### 7.3 Key Management

**Storage:**
- AWS KMS / HashiCorp Vault
- Never in code
- Rotation automatique

**Access:**
- Only authorized services
- Audit logging
- Break-glass procedure

---

## 8. ENCRYPTION IN TRANSIT

### 8.1 Strategy

**TLS 1.3:**
- Minimum version: TLS 1.3
- Cipher suites: Modern only
- Certificate: Let's Encrypt / ACM

**mTLS (optionnel):**
- Service-to-service
- Client certificates
- Mutual authentication

### 8.2 Implementation

**REST API:**
- HTTPS only
- HSTS header
- TLS 1.3

**WebSocket:**
- WSS only
- TLS 1.3
- Certificate validation

**Internal:**
- gRPC with TLS
- Service mesh (Istio)

### 8.3 Headers

**Security Headers:**
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

---

## 9. NOTIFICATION INTEGRITY

### 9.1 Strategy

**HMAC Signature:**
- Algorithm: HMAC-SHA256
- Secret: Per-tenant
- Payload: Notification content

### 9.2 Implementation

**Signature:**
```javascript
const signature = HMAC-SHA256(
  secret,
  JSON.stringify({
    notificationId,
    title,
    message,
    timestamp
  })
);
```

**Verification:**
```javascript
const expected = HMAC-SHA256(secret, payload);
if (signature !== expected) {
  throw new Error('Invalid signature');
}
```

### 9.3 Usage

**Webhooks:**
- Signature dans header
- Vérification obligatoire
- Reject si invalide

**Push Notifications:**
- Signature APNS/FCM
- Vérification côté client

---

## 10. REPLAY PROTECTION

### 10.1 Strategy

**Nonce:**
- Unique per request
- Stocké 24h
- Reject si duplicate

**Timestamp:**
- Max 5min drift
- Reject si trop ancien

### 10.2 Implementation

**Nonce:**
```
Header: X-Nonce: UUID
Storage: Redis: nonce:{nonce} (TTL: 24h)

Check:
IF EXISTS(nonce:{nonce}) THEN REJECT
ELSE STORE nonce:{nonce} = 1 (TTL: 24h)
```

**Timestamp:**
```
Header: X-Timestamp: ISO8601
Check:
IF NOW() - timestamp > 5min THEN REJECT
```

---

## 11. AUDIT INTEGRITY

### 11.1 Strategy

**Immutable Log:**
- Append-only
- No updates
- No deletes
- Hash chain

### 11.2 Implementation

**Log Entry:**
```json
{
  "auditId": "uuid",
  "timestamp": "ISO8601",
  "tenantId": "uuid",
  "userId": "uuid",
  "action": "notification.read",
  "resource": "notification:uuid",
  "ipAddress": "string",
  "userAgent": "string",
  "previousHash": "hash",
  "currentHash": "hash"
}
```

**Hash Chain:**
```
Block N: hash = SHA256(Block N-1 hash + Block N data)
```

### 11.3 Storage

**Database:**
- Table: audit_logs
- Partitioned by month
- Retention: 7 ans

**Backup:**
- Daily backup
- Immutable storage
- WORM (Write Once Read Many)

---

## 12. DATA RETENTION

### 12.1 Policies

**Notifications:**
- Active: 30 jours
- Archived: 90 jours
- Deleted: 7 ans (audit)

**Audit Logs:**
- Retention: 7 ans
- Immutable
- Backup quotidien

**Preferences:**
- Retention: Jusqu'à suppression compte
- Backup quotidien

### 12.2 Implementation

**Auto-deletion:**
```sql
-- Supprimer notifications archivées > 90 jours
DELETE FROM notifications
WHERE archived = true
  AND archivedAt < NOW() - INTERVAL '90 days';

-- Supprimer logs > 7 ans
DELETE FROM audit_logs
WHERE timestamp < NOW() - INTERVAL '7 years';
```

**Backup:**
- Daily full backup
- Incremental every hour
- Retention: 30 jours
- Offsite backup

---

## 13. GDPR / PRIVACY

### 13.1 Compliance

**Data Subject Rights:**
- Right to access
- Right to rectification
- Right to erasure
- Right to portability
- Right to object

### 13.2 Implementation

**Data Access:**
```
GET /api/notifications/gdpr/export
Response: JSON with all user data
```

**Data Deletion:**
```
POST /api/notifications/gdpr/delete
Body: {userId: "uuid"}
Response: 202 Accepted
```

**Data Portability:**
```
GET /api/notifications/gdpr/export?format=json
Response: JSON file
```

### 13.3 Privacy by Design

**Data Minimization:**
- Collecter seulement nécessaire
- Pas de données sensibles inutiles

**Purpose Limitation:**
- Utiliser seulement pour notification
- Pas de partage tiers

**Storage Limitation:**
- Retention limits
- Auto-deletion

---

## 14. PII CLASSIFICATION

### 14.1 Levels

**Public:**
- Notification title
- Notification message
- Category
- Priority

**Internal:**
- User ID
- Tenant ID
- Timestamps
- Metadata

**Confidential:**
- Email
- Phone
- Address
- Device info

**Restricted:**
- Payment info
- Security alerts
- Health data

### 14.2 Handling

**Public:**
- No encryption
- Logging allowed

**Internal:**
- Encryption at rest
- Logging allowed

**Confidential:**
- Encryption at rest
- Encryption in transit
- Logging restricted

**Restricted:**
- Encryption at rest
- Encryption in transit
- No logging
- Access control strict

---

## 15. SECRET MANAGEMENT

### 15.1 Strategy

**Vault:**
- AWS Secrets Manager / HashiCorp Vault
- Centralized
- Audit logging
- Rotation automatique

### 15.2 Secrets

**API Keys:**
- Storage: Vault
- Rotation: 90 jours
- Access: Service accounts

**JWT Secrets:**
- Storage: Vault
- Rotation: 30 jours
- Algorithm: RS256

**Database Credentials:**
- Storage: Vault
- Rotation: 30 jours
- Access: Application only

**Third-Party:**
- SMTP credentials
- Push certificates
- Webhook secrets
- Storage: Vault

### 15.3 Rotation

**Automatic:**
- JWT: 30 jours
- API Keys: 90 jours
- Database: 30 jours

**Manual:**
- Emergency rotation
- Break-glass procedure
- Notification équipe

---

## 16. SECURITY MONITORING

### 16.1 Metrics

**Authentication:**
- Failed login attempts
- Token refresh rate
- Session duration

**Authorization:**
- Access denied count
- Permission violations
- Role escalations

**Data:**
- Encryption failures
- Decryption failures
- Data exfiltration attempts

**Anomalies:**
- Unusual access patterns
- Rate limit violations
- Geographic anomalies

### 16.2 Alerting

**Critical:**
- Multiple failed auth
- Data breach attempt
- Unauthorized access

**High:**
- Rate limit exceeded
- Unusual pattern
- Encryption failure

**Medium:**
- Failed login
- Permission violation

### 16.3 Dashboards

**Real-time:**
- Active sessions
- Failed authentications
- Access denied

**Daily:**
- Security events
- Anomalies detected
- Incidents

---

## 17. INCIDENT RESPONSE

### 17.1 Severity Levels

**P0 - Critical:**
- Data breach
- System compromise
- Service down

**P1 - High:**
- Security vulnerability
- Unauthorized access
- Data leak

**P2 - Medium:**
- Failed authentication spike
- Anomaly detected

**P3 - Low:**
- Policy violation
- Configuration issue

### 17.2 Response Process

**Detection:**
- Monitoring alert
- User report
- Automated detection

**Triage:**
- Assess severity
- Assign owner
- Notify stakeholders

**Containment:**
- Isolate affected systems
- Block suspicious IPs
- Disable compromised accounts

**Eradication:**
- Remove malware
- Patch vulnerabilities
- Rotate secrets

**Recovery:**
- Restore services
- Verify integrity
- Monitor for recurrence

**Post-Mortem:**
- Root cause analysis
- Documentation
- Process improvement

### 17.3 Runbooks

**Data Breach:**
1. Detect
2. Contain
3. Assess
4. Notify (72h GDPR)
5. Remediate
6. Document

**Unauthorized Access:**
1. Detect
2. Block
3. Investigate
4. Rotate credentials
5. Notify user
6. Document

**DDoS Attack:**
1. Detect
2. Activate WAF
3. Rate limit
4. Block IPs
5. Monitor
6. Document

---

## CONCLUSION

Cette spécification définit la sécurité complète du système de notifications.

**Caractéristiques:**
- ✅ RBAC + ABAC
- ✅ Multi-tenant isolation
- ✅ Encryption (at rest + in transit)
- ✅ GDPR compliant
- ✅ Audit logging
- ✅ Incident response

**Prochaine étape:**
Implémenter selon cette spécification.

---

**FIN DU DOCUMENT**

*Ce document fait partie du Notification Design System officiel d'Ekala.*