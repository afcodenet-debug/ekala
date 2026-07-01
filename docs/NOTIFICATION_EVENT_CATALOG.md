# NOTIFICATION EVENT CATALOG — EKALA

**Version:** 1.0.0  
**Date:** 29 Juin 2026  
**Statut:** OFFICIEL  
**Niveau:** Enterprise

---

## TABLE DES MATIÈRES

1. [Orders](#1-orders)
2. [Kitchen](#2-kitchen)
3. [Tables](#3-tables)
4. [Reservations](#4-reservations)
5. [Inventory](#5-inventory)
6. [Suppliers](#6-suppliers)
7. [Billing](#7-billing)
8. [Subscription](#8-subscription)
9. [Staff](#9-staff)
10. [Customers](#10-customers)
11. [Platform](#11-platform)
12. [Security](#12-security)
13. [QR Ordering](#13-qr-ordering)
14. [Analytics](#14-analytics)
15. [Synchronisation](#15-synchronisation)
16. [Offline](#16-offline)
17. [Maintenance](#17-maintenance)

---

## 1. ORDERS

### 1.1 OrderCreated

**Objectif:** Notifier qu'une nouvelle commande a été créée

**Déclencheur:** Client passe une commande (POS, en ligne, QR code)

**Priorité:** Medium

**Sévérité:** Info

**Catégorie:** Order

**Rôles concernés:**
- Cashier: Oui
- Waiter: Oui
- Kitchen: Oui
- Manager: Oui

**Canaux autorisés:**
- Toast: Non
- Badge: Oui
- Push: Non
- Email: Non
- Center: Oui

**TTL:** 7 jours

**Fusion:** Oui (avec autres OrderCreated, < 5min)

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir commande"
- Secondary: "Assigner serveur"
- Dismiss: "Ignorer"

**Règles métier:**
- Si commande > 100€ → High priority
- Si commande takeaway → notifier kitchen
- Si commande livraison → notifier delivery

---

### 1.2 OrderReady

**Objectif:** Notifier qu'une commande est prête

**Déclencheur:** Kitchen marque commande comme prête

**Priorité:** High

**Sévérité:** Success

**Catégorie:** Order

**Rôles concernés:**
- Waiter: Oui
- Cashier: Oui
- Customer: Oui (si app)

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Non
- Center: Oui

**TTL:** 24h

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir commande"
- Secondary: "Assigner serveur"
- Dismiss: "Ignorer"

**Règles métier:**
- Auto-dismiss après 30min
- Si non récupérée après 30min → alerte staff

---

### 1.3 OrderPaid

**Objectif:** Notifier qu'une commande a été payée

**Déclencheur:** Paiement confirmé

**Priorité:** Low

**Sévérité:** Success

**Catégorie:** Order

**Rôles concernés:**
- Cashier: Oui
- Manager: Oui
- Accounting: Oui

**Canaux autorisés:**
- Toast: Non
- Badge: Non
- Push: Non
- Email: Oui (reçu)
- Center: Oui

**TTL:** 30 jours

**Fusion:** Oui (avec autres OrderPaid, < 1h)

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir reçu"
- Secondary: "Télécharger PDF"
- Dismiss: "Ignorer"

**Règles métier:**
- Si paiement échoué → PaymentFailed
- Si remboursement → RefundProcessed

---

### 1.4 OrderCancelled

**Objectif:** Notifier qu'une commande a été annulée

**Déclencheur:** Annulation par client ou staff

**Priorité:** High

**Sévérité:** Warning

**Catégorie:** Order

**Rôles concernés:**
- Cashier: Oui
- Kitchen: Oui
- Manager: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Oui
- Center: Oui

**TTL:** 7 jours

**Fusion:** Non

**Escalade:** Oui (si > 3 annulations/heure)

**Actions disponibles:**
- Primary: "Voir détails"
- Secondary: "Contacter client"
- Dismiss: "Ignorer"

**Règles métier:**
- Si annulation < 5min avant → alerte manager
- Si annulation client → notifier kitchen
- Track taux d'annulation

---

### 1.5 PaymentFailed

**Objectif:** Notifier qu'un paiement a échoué

**Déclencheur:** Erreur de paiement (carte refusée, timeout, etc.)

**Priorité:** Critical

**Sévérité:** Error

**Catégorie:** Billing

**Rôles concernés:**
- Cashier: Oui
- Customer: Oui
- Manager: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Oui
- Center: Oui

**TTL:** 30 jours

**Fusion:** Non

**Escalade:** Oui (après 2 échecs)

**Actions disponibles:**
- Primary: "Réessayer"
- Secondary: "Voir détails"
- Dismiss: "Ignorer"

**Règles métier:**
- Retry automatique 3x
- Après 3 échecs → alerte manager
- Si client → notifier client

---

## 2. KITCHEN

### 2.1 OrderReceived

**Objectif:** Notifier kitchen d'une nouvelle commande

**Déclencheur:** Commande créée et envoyée en cuisine

**Priorité:** High

**Sévérité:** Info

**Catégorie:** Order

**Rôles concernés:**
- Kitchen: Oui

**Canaux autorisés:**
- Toast: Oui (KDS)
- Badge: Oui
- Push: Oui
- Email: Non
- Center: Oui

**TTL:** 4h

**Fusion:** Oui (même table, < 2min)

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir commande"
- Secondary: "Marquer prêt"
- Dismiss: "Ignorer"

**Règles métier:**
- Si commande urgente → Critical
- Si commande takeaway → priorité élevée
- Affichage KDS (Kitchen Display System)

---

### 2.2 OrderPrepared

**Objectif:** Notifier que la commande est préparée

**Déclencheur:** Chef marque commande comme prête

**Priorité:** High

**Sévérité:** Success

**Catégorie:** Order

**Rôles concernés:**
- Waiter: Oui
- Cashier: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Non
- Center: Oui

**TTL:** 24h

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir commande"
- Secondary: "Assigner serveur"
- Dismiss: "Ignorer"

**Règles métier:**
- Auto-dismiss après 30min
- Si non récupérée → alerte waiter

---

### 2.3 KitchenAlert

**Objectif:** Alerte kitchen (stock manquant, erreur, etc.)

**Déclencheur:** Système ou staff

**Priorité:** Critical

**Sévérité:** Error

**Catégorie:** Inventory

**Rôles concernés:**
- Kitchen: Oui
- Manager: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Oui
- Center: Oui

**TTL:** 24h

**Fusion:** Non

**Escalade:** Oui (après 5min)

**Actions disponibles:**
- Primary: "Voir détails"
- Secondary: "Commander"
- Dismiss: "Ignorer"

**Règles métier:**
- Si stock manquant → LowStock
- Si erreur équipement → SystemError

---

## 3. TABLES

### 3.1 TableAssigned

**Objectif:** Notifier assignation d'une table

**Déclencheur:** Table assignée à un waiter

**Priorité:** Low

**Sévérité:** Info

**Catégorie:** Table

**Rôles concernés:**
- Waiter: Oui

**Canaux autorisés:**
- Toast: Non
- Badge: Non
- Push: Non
- Email: Non
- Center: Oui

**TTL:** 24h

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir table"
- Secondary: "Voir commandes"
- Dismiss: "Ignorer"

**Règles métier:**
- Si table VIP → High priority
- Si table grande capacité → notifier manager

---

### 3.2 TableReady

**Objectif:** Notifier qu'une table est prête

**Déclencheur:** Table nettoyée et prête

**Priorité:** Medium

**Sévérité:** Success

**Catégorie:** Table

**Rôles concernés:**
- Waiter: Oui
- Host: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Non
- Center: Oui

**TTL:** 1h

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Assigner clients"
- Secondary: "Voir détails"
- Dismiss: "Ignorer"

**Règles métier:**
- Si réservation → notifier host
- Si walk-in → notifier waiter disponible

---

### 3.3 TableCleaned

**Objectif:** Notifier qu'une table a été nettoyée

**Déclencheur:** Table marquée comme nettoyée

**Priorité:** Low

**Sévérité:** Info

**Catégorie:** Table

**Rôles concernés:**
- Host: Oui
- Waiter: Oui

**Canaux autorisés:**
- Toast: Non
- Badge: Non
- Push: Non
- Email: Non
- Center: Oui

**TTL:** 1h

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir table"
- Secondary: "Assigner"
- Dismiss: "Ignorer"

**Règles métier:**
- Update statut table
- Notifier host pour assignation

---

## 4. RESERVATIONS

### 4.1 NewReservation

**Objectif:** Notifier d'une nouvelle réservation

**Déclencheur:** Client réserve une table

**Priorité:** Medium

**Sévérité:** Info

**Catégorie:** Table

**Rôles concernés:**
- Host: Oui
- Manager: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Oui (confirmation)
- Center: Oui

**TTL:** 7 jours

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir détails"
- Secondary: "Assigner table"
- Dismiss: "Ignorer"

**Règles métier:**
- Si réservation > 10 personnes → notifier manager
- Si réservation VIP → High priority
- Envoyer confirmation email/SMS

---

### 4.2 ReservationConfirmed

**Objectif:** Confirmer réservation au client

**Déclencheur:** Manager confirme réservation

**Priorité:** Medium

**Sévérité:** Success

**Catégorie:** Table

**Rôles concernés:**
- Customer: Oui
- Host: Oui

**Canaux autorisés:**
- Toast: Non
- Badge: Non
- Push: Oui
- Email: Oui
- Center: Oui

**TTL:** 7 jours

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir détails"
- Secondary: "Modifier"
- Dismiss: "Ignorer"

**Règles métier:**
- Envoyer confirmation
- Ajouter rappel 24h avant

---

### 4.3 ReservationCancelled

**Objectif:** Notifier annulation réservation

**Déclencheur:** Client ou staff annule

**Priorité:** Medium

**Sévérité:** Warning

**Catégorie:** Table

**Rôles concernés:**
- Host: Oui
- Manager: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Oui
- Center: Oui

**TTL:** 7 jours

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir détails"
- Secondary: "Contacter client"
- Dismiss: "Ignorer"

**Règles métier:**
- Track taux d'annulation
- Si annulation tardive (< 1h) → alerte

---

## 5. INVENTORY

### 5.1 LowStock

**Objectif:** Alerter stock faible

**Déclencheur:** Stock < seuil minimum

**Priorité:** High

**Sévérité:** Warning

**Catégorie:** Inventory

**Rôles concernés:**
- Manager: Oui
- Kitchen: Oui (si ingrédient)
- Cashier: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Oui
- Center: Oui

**TTL:** 24h

**Fusion:** Oui (même produit, < 5min)

**Escalade:** Oui (après 2h sans action)

**Actions disponibles:**
- Primary: "Commander"
- Secondary: "Voir détails"
- Dismiss: "Ignorer"

**Règles métier:**
- Cooldown 5min
- Si stock = 0 → OutOfStock
- Auto-commande si activé

---

### 5.2 OutOfStock

**Objectif:** Alerter rupture de stock

**Déclencheur:** Stock = 0

**Priorité:** Critical

**Sévérité:** Error

**Catégorie:** Inventory

**Rôles concernés:**
- Manager: Oui
- Kitchen: Oui
- Cashier: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Oui
- Center: Oui

**TTL:** 48h

**Fusion:** Oui (même produit, < 10min)

**Escalade:** Oui (immédiate)

**Actions disponibles:**
- Primary: "Commander maintenant"
- Secondary: "Voir alternatives"
- Dismiss: "Ignorer"

**Règles métier:**
- Désactiver vente produit
- Alerte fournisseur automatique
- Si ingrédient critique → alerte chef

---

### 5.3 StockReceived

**Objectif:** Notifier réception stock

**Déclencheur:** Stock réceptionné et vérifié

**Priorité:** Low

**Sévérité:** Success

**Catégorie:** Inventory

**Rôles concernés:**
- Manager: Oui
- Kitchen: Oui

**Canaux autorisés:**
- Toast: Non
- Badge: Non
- Push: Non
- Email: Non
- Center: Oui

**TTL:** 7 jours

**Fusion:** Oui (même produit, < 1h)

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir détails"
- Secondary: "Mettre à jour stock"
- Dismiss: "Ignorer"

**Règles métier:**
- Update inventory
- Si stock suffisant → résoudre LowStock

---

## 6. SUPPLIERS

### 6.1 SupplierOrderPlaced

**Objectif:** Notifier commande fournisseur passée

**Déclencheur:** Commande envoyée au fournisseur

**Priorité:** Low

**Sévérité:** Info

**Catégorie:** Inventory

**Rôles concernés:**
- Manager: Oui

**Canaux autorisés:**
- Toast: Non
- Badge: Non
- Push: Non
- Email: Oui
- Center: Oui

**TTL:** 30 jours

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir commande"
- Secondary: "Suivre livraison"
- Dismiss: "Ignorer"

**Règles métier:**
- Track livraison
- Alert si retard

---

### 6.2 SupplierDeliveryDelayed

**Objectif:** Alerter retard livraison fournisseur

**Déclencheur:** Livraison en retard (> 24h)

**Priorité:** High

**Sévérité:** Warning

**Catégorie:** Inventory

**Rôles concernés:**
- Manager: Oui
- Kitchen: Oui (si ingrédient)

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Oui
- Center: Oui

**TTL:** 48h

**Fusion:** Non

**Escalade:** Oui (après 48h)

**Actions disponibles:**
- Primary: "Contacter fournisseur"
- Secondary: "Voir alternatives"
- Dismiss: "Ignorer"

**Règles métier:**
- Chercher fournisseur alternatif
- Alerte si retard critique

---

## 7. BILLING

### 7.1 InvoiceGenerated

**Objectif:** Notifier génération facture

**Déclencheur:** Facture générée (fin de mois, commande)

**Priorité:** Medium

**Sévérité:** Info

**Catégorie:** Billing

**Rôles concernés:**
- Customer: Oui
- Manager: Oui
- Accounting: Oui

**Canaux autorisés:**
- Toast: Non
- Badge: Non
- Push: Oui
- Email: Oui
- Center: Oui

**TTL:** 30 jours

**Fusion:** Oui (même client, < 1h)

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir facture"
- Secondary: "Télécharger PDF"
- Dismiss: "Ignorer"

**Règles métier:**
- Envoyer facture par email
- Si non payée après 30 jours → PaymentFailed

---

### 7.2 PaymentReceived

**Objectif:** Notifier réception paiement

**Déclencheur:** Paiement confirmé

**Priorité:** Low

**Sévérité:** Success

**Catégorie:** Billing

**Rôles concernés:**
- Customer: Oui
- Manager: Oui
- Accounting: Oui

**Canaux autorisés:**
- Toast: Non
- Badge: Non
- Push: Oui
- Email: Oui (reçu)
- Center: Oui

**TTL:** 30 jours

**Fusion:** Oui (même client, < 1h)

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir reçu"
- Secondary: "Télécharger PDF"
- Dismiss: "Ignorer"

**Règles métier:**
- Update balance
- Envoyer reçu

---

### 7.3 SubscriptionExpiring

**Objectif:** Alerter expiration abonnement

**Déclencheur:** Abonnement expire dans 7 jours

**Priorité:** High

**Sévérité:** Warning

**Catégorie:** Billing

**Rôles concernés:**
- Customer: Oui
- Manager: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Oui
- Center: Oui

**TTL:** 7 jours

**Fusion:** Non

**Escalade:** Oui (après 3 jours)

**Actions disponibles:**
- Primary: "Renouveler"
- Secondary: "Voir plans"
- Dismiss: "Ignorer"

**Règles métier:**
- Rappel à 7, 3, 1 jour
- Si non renouvelé → désactiver compte

---

## 8. SUBSCRIPTION

### 8.1 SubscriptionCreated

**Objectif:** Notifier création abonnement

**Déclencheur:** Nouvel abonnement créé

**Priorité:** Medium

**Sévérité:** Success

**Catégorie:** Billing

**Rôles concernés:**
- Customer: Oui
- Manager: Oui

**Canaux autorisés:**
- Toast: Non
- Badge: Non
- Push: Oui
- Email: Oui
- Center: Oui

**TTL:** 30 jours

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir abonnement"
- Secondary: "Gérer"
- Dismiss: "Ignorer"

**Règles métier:**
- Envoyer confirmation
- Activer accès immédiatement

---

### 8.2 SubscriptionCancelled

**Objectif:** Notifier annulation abonnement

**Déclencheur:** Abonnement annulé

**Priorité:** High

**Sévérité:** Warning

**Catégorie:** Billing

**Rôles concernés:**
- Customer: Oui
- Manager: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Oui
- Center: Oui

**TTL:** 30 jours

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir détails"
- Secondary: "Réactiver"
- Dismiss: "Ignorer"

**Règles métier:**
- Garder accès jusqu'à fin période
- Proposer réactivation

---

## 9. STAFF

### 9.1 NewStaffMember

**Objectif:** Notifier nouveau membre équipe

**Déclencheur:** Nouveau staff ajouté

**Priorité:** Medium

**Sévérité:** Info

**Catégorie:** Staff

**Rôles concernés:**
- Manager: Oui
- Admin: Oui

**Canaux autorisés:**
- Toast: Non
- Badge: Non
- Push: Non
- Email: Oui
- Center: Oui

**TTL:** 7 jours

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir profil"
- Secondary: "Assigner rôle"
- Dismiss: "Ignorer"

**Règles métier:**
- Envoyer credentials
- Assigner rôle par défaut

---

### 9.2 LeaveRequest

**Objectif:** Notifier demande de congé

**Déclencheur:** Staff demande congé

**Priorité:** High

**Sévérité:** Info

**Catégorie:** Staff

**Rôles concernés:**
- Manager: Oui
- Admin: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Oui
- Center: Oui

**TTL:** 7 jours

**Fusion:** Non

**Escalade:** Oui (après 48h sans réponse)

**Actions disponibles:**
- Primary: "Approuver"
- Secondary: "Rejeter"
- Dismiss: "Ignorer"

**Règles métier:**
- Si urgence → alerte manager
- Check disponibilité équipe

---

### 9.3 ShiftAssigned

**Objectif:** Notifier assignation shift

**Déclencheur:** Shift assigné à staff

**Priorité:** Medium

**Sévérité:** Info

**Catégorie:** Staff

**Rôles concernés:**
- Staff: Oui
- Manager: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Oui
- Center: Oui

**TTL:** 7 jours

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir shift"
- Secondary: "Échanger"
- Dismiss: "Ignorer"

**Règles métier:**
- Envoyer rappel 24h avant
- Permettre échange

---

## 10. CUSTOMERS

### 10.1 NewCustomer

**Objectif:** Notifier nouveau client

**Déclencheur:** Premier achat ou inscription

**Priorité:** Low

**Sévérité:** Success

**Catégorie:** Customer

**Rôles concernés:**
- Manager: Oui
- Marketing: Oui

**Canaux autorisés:**
- Toast: Non
- Badge: Non
- Push: Non
- Email: Oui
- Center: Oui

**TTL:** 30 jours

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir profil"
- Secondary: "Envoyer bienvenue"
- Dismiss: "Ignorer"

**Règles métier:**
- Envoyer email bienvenue
- Ajouter à CRM

---

### 10.2 CustomerFeedback

**Objectif:** Notifier nouveau feedback client

**Déclencheur:** Client laisse feedback

**Priorité:** Medium

**Sévérité:** Info

**Catégorie:** Customer

**Rôles concernés:**
- Manager: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Oui
- Center: Oui

**TTL:** 30 jours

**Fusion:** Non

**Escalade:** Oui (si note < 3/5)

**Actions disponibles:**
- Primary: "Voir feedback"
- Secondary: "Répondre"
- Dismiss: "Ignorer"

**Règles métier:**
- Si note < 3/5 → alerte manager
- Si note > 4/5 → remercier client

---

## 11. PLATFORM

### 11.1 SystemMaintenance

**Objectif:** Notifier maintenance système

**Déclencheur:** Maintenance planifiée

**Priorité:** High

**Sévérité:** Warning

**Catégorie:** System

**Rôles concernés:**
- Tous: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Oui
- Center: Oui
- Banner: Oui

**TTL:** 24h

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir détails"
- Secondary: "Planifier"
- Dismiss: "Ignorer"

**Règles métier:**
- Banner sticky
- Rappel 1h avant
- Update statut système

---

### 11.2 SystemUpdate

**Objectif:** Notifier mise à jour système

**Déclencheur:** Nouvelle version déployée

**Priorité:** Medium

**Sévérité:** Info

**Catégorie:** System

**Rôles concernés:**
- Admin: Oui
- Manager: Oui

**Canaux autorisés:**
- Toast: Non
- Badge: Non
- Push: Non
- Email: Oui
- Center: Oui

**TTL:** 7 jours

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir changelog"
- Secondary: "Mettre à jour"
- Dismiss: "Ignorer"

**Règles métier:**
- Envoyer changelog
- Proposer mise à jour

---

### 11.3 NewFeature

**Objectif:** Annoncer nouvelle fonctionnalité

**Déclencheur:** Nouvelle feature déployée

**Priorité:** Low

**Sévérité:** Info

**Catégorie:** System

**Rôles concernés:**
- Tous: Oui

**Canaux autorisés:**
- Toast: Non
- Badge: Non
- Push: Non
- Email: Oui
- Center: Oui

**TTL:** 30 jours

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Essayer"
- Secondary: "En savoir plus"
- Dismiss: "Ignorer"

**Règles métier:**
- Highlight nouvelle feature
- Tutorial intégré

---

## 12. SECURITY

### 12.1 SecurityAlert

**Objectif:** Alerter problème de sécurité

**Déclencheur:** Détection anomalie sécurité

**Priorité:** Critical

**Sévérité:** Error

**Catégorie:** System

**Rôles concernés:**
- Admin: Oui
- Owner: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Oui
- Center: Oui
- SMS: Oui

**TTL:** 90 jours

**Fusion:** Non

**Escalade:** Oui (immédiate)

**Actions disponibles:**
- Primary: "Voir détails"
- Secondary: "Bloquer accès"
- Dismiss: "Ignorer"

**Règles métier:**
- Audit complet
- Alert si critique
- Track dans security log

---

### 12.2 LoginAttempt

**Objectif:** Notifier tentative connexion

**Déclencheur:** Login réussi ou échoué

**Priorité:** Low

**Sévérité:** Info

**Catégorie:** Security

**Rôles concernés:**
- User: Oui
- Admin: Oui (si échec)

**Canaux autorisés:**
- Toast: Non
- Badge: Non
- Push: Oui
- Email: Oui (si échec)
- Center: Oui

**TTL:** 30 jours

**Fusion:** Non

**Escalade:** Oui (si 3 échecs)

**Actions disponibles:**
- Primary: "Voir activité"
- Secondary: "Sécuriser compte"
- Dismiss: "Ignorer"

**Règles métier:**
- Si 3 échecs → bloquer compte
- Si nouveau device → alerte user

---

## 13. QR ORDERING

### 13.1 QRScanned

**Objectif:** Notifier scan QR code

**Déclencheur:** Client scanne QR code table

**Priorité:** Medium

**Sévérité:** Info

**Catégorie:** Table

**Rôles concernés:**
- Waiter: Oui
- Kitchen: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Non
- Center: Oui

**TTL:** 2h

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir commande"
- Secondary: "Assigner serveur"
- Dismiss: "Ignorer"

**Règles métier:**
- Si table non assignée → assigner
- Notifier waiter disponible

---

### 13.2 QROrderPlaced

**Objectif:** Notifier commande via QR

**Déclencheur:** Client commande via QR

**Priorité:** High

**Sévérité:** Info

**Catégorie:** Order

**Rôles concernés:**
- Kitchen: Oui
- Waiter: Oui
- Cashier: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Non
- Center: Oui

**TTL:** 4h

**Fusion:** Oui (même table, < 5min)

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir commande"
- Secondary: "Assigner serveur"
- Dismiss: "Ignorer"

**Règles métier:**
- Même flux que OrderCreated
- Ajouter note "Commande QR"

---

## 14. ANALYTICS

### 14.1 DailyReport

**Objectif:** Envoyer rapport quotidien

**Déclencheur:** Fin de journée

**Priorité:** Low

**Sévérité:** Info

**Catégorie:** System

**Rôles concernés:**
- Manager: Oui
- Owner: Oui

**Canaux autorisés:**
- Toast: Non
- Badge: Non
- Push: Non
- Email: Oui
- Center: Oui

**TTL:** 7 jours

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir rapport"
- Secondary: "Télécharger PDF"
- Dismiss: "Ignorer"

**Règles métier:**
- Inclure: CA, commandes, stock
- Envoyer à 23h59

---

### 14.2 WeeklyReport

**Objectif:** Envoyer rapport hebdomadaire

**Déclencheur:** Fin de semaine

**Priorité:** Low

**Sévérité:** Info

**Catégorie:** System

**Rôles concernés:**
- Manager: Oui
- Owner: Oui

**Canaux autorisés:**
- Toast: Non
- Badge: Non
- Push: Non
- Email: Oui
- Center: Oui

**TTL:** 30 jours

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir rapport"
- Secondary: "Télécharger PDF"
- Dismiss: "Ignorer"

**Règles métier:**
- Inclure: CA, tendances, alertes
- Envoyer dimanche 23h59

---

## 15. SYNCHRONISATION

### 15.1 SyncCompleted

**Objectif:** Notifier fin de synchronisation

**Déclencheur:** Sync terminée avec succès

**Priorité:** Low

**Sévérité:** Success

**Catégorie:** System

**Rôles concernés:**
- Tous: Oui

**Canaux autorisés:**
- Toast: Non
- Badge: Non
- Push: Non
- Email: Non
- Center: Oui

**TTL:** 1 jour

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir détails"
- Secondary: "-"
- Dismiss: "Ignorer"

**Règles métier:**
- Afficher stats sync
- Si conflits → notifier

---

### 15.2 SyncFailed

**Objectif:** Alerter échec synchronisation

**Déclencheur:** Sync échoue

**Priorité:** High

**Sévérité:** Error

**Catégorie:** System

**Rôles concernés:**
- Admin: Oui
- Manager: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Oui
- Center: Oui

**TTL:** 7 jours

**Fusion:** Non

**Escalade:** Oui (après 3 échecs)

**Actions disponibles:**
- Primary: "Réessayer"
- Secondary: "Voir logs"
- Dismiss: "Ignorer"

**Règles métier:**
- Retry automatique
- Si 3 échecs → alerte admin

---

## 16. OFFLINE

### 16.1 OfflineMode

**Objectif:** Notifier mode hors-ligne

**Déclencheur:** Perte connexion réseau

**Priorité:** High

**Sévérité:** Warning

**Catégorie:** System

**Rôles concernés:**
- Tous: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Non
- Email: Non
- Center: Oui

**TTL:** Jusqu'à retour online

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "-"
- Secondary: "-"
- Dismiss: "Ignorer"

**Règles métier:**
- Mode lecture seule
- Queue actions
- Sync au retour

---

### 16.2 OnlineRestored

**Objectif:** Notifier retour en ligne

**Déclencheur:** Connexion rétablie

**Priorité:** Medium

**Sévérité:** Success

**Catégorie:** System

**Rôles concernés:**
- Tous: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Non
- Email: Non
- Center: Oui

**TTL:** 1h

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Synchroniser"
- Secondary: "-"
- Dismiss: "Ignorer"

**Règles métier:**
- Sync automatique
- Afficher notifications manquées

---

## 17. MAINTENANCE

### 17.1 ScheduledMaintenance

**Objectif:** Notifier maintenance planifiée

**Déclencheur:** Maintenance planifiée

**Priorité:** High

**Sévérité:** Warning

**Catégorie:** System

**Rôles concernés:**
- Tous: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Oui
- Center: Oui
- Banner: Oui

**TTL:** 24h

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir détails"
- Secondary: "Planifier"
- Dismiss: "Ignorer"

**Règles métier:**
- Banner sticky
- Rappel 1h avant
- Downtime estimé

---

### 17.2 MaintenanceCompleted

**Objectif:** Notifier fin de maintenance

**Déclencheur:** Maintenance terminée

**Priorité:** Medium

**Sévérité:** Success

**Catégorie:** System

**Rôles concernés:**
- Tous: Oui

**Canaux autorisés:**
- Toast: Oui
- Badge: Oui
- Push: Oui
- Email: Oui
- Center: Oui
- Banner: Oui

**TTL:** 24h

**Fusion:** Non

**Escalade:** Non

**Actions disponibles:**
- Primary: "Voir détails"
- Secondary: "-"
- Dismiss: "Ignorer"

**Règles métier:**
- Banner sticky
- Update statut système
- Si problème → SystemError

---

## CONCLUSION

Ce catalogue définit tous les événements métier officiels d'Ekala.

**Règles:**
- ✅ Utiliser ces événements
- ✅ Respecter ces spécifications
- ❌ Ne pas créer d'événements hors catalog
- ❌ Ne pas modifier événements sans validation

**Prochaine étape:**
Implémenter le Policy Engine selon ces événements.

---

**FIN DU DOCUMENT**

*Ce document fait partie du Notification Design System officiel d'Ekala.*