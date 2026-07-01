# UX/UI Refactor Plan — Ekala Tenant Premium SaaS

## 1. Current State Analysis

### Current Sidebar Structure
```
Flat menu with 3 sections:
- Operations: Dashboard, POS, Orders Live, Floor Plan
- Inventory: Sales History, Stock, Categories, Analytics
- Pilotage: Team, Reports, Expenses, System Access, Settings, Voucher Validation, Billing
```

### Current Routing (App.tsx)
```
/* → ProtectedRoute
  / → Dashboard
  /dashboard → Dashboard
  /tables → TablesPage
  /staff → Staff (owner, admin, manager)
  /pos → POS
  /orders → OrdersPage
  /sales → SalesHistoryPage (owner, admin, manager, cashier)
  /analytics → InventoryAnalyticsPage (owner, admin, manager)
  /categories → CategoriesPage (owner, admin, manager)
  /products → ProductsPage (owner, admin, manager)
  /products/:id → ProductDetailsPage (owner, admin, manager)
  /reports → Reports (owner, admin, manager, cashier)
  /expenses → Expenses (owner, admin, manager, cashier)
  /users → UsersPage (owner, admin)
  /admin/payments → AdminPaymentsPage (owner, admin)
  /settings → SettingsPage (owner, admin)
  /billing → BillingPageV2
  /admin/vouchers → AdminVouchersPage (owner, admin)
```

## 2. Target State Architecture

### New Sidebar Structure (Target)
```
Dashboard

Operations
├── Orders
├── Inventory
├── Tables
├── Customers

Sales
├── Transactions
├── Reports
├── Analytics

Team
├── Users
├── Roles (redirect → Users with roles tab)

Business
├── Company Profile (old Settings)
├── Branches

Settings
├── Subscription
├── Security
├── Integrations
```

### Removed from Sidebar
- Billing (moved to Settings > Subscription)
- Voucher Validation (removed from tenant, only admin)
- Voucher Management (removed from tenant, only admin)
- POS (removed from sidebar, kept route for direct access)
- Categories (removed from sidebar, kept route accessible)

### New Routing Structure
```
/settings/subscription → SubscriptionPremiumPage (new)
/settings/security → SettingsSecuritySection (part of settings)
/settings/integrations → SettingsIntegrationsSection (part of settings)
/settings → redirects to Settings > Company Profile
```

## 3. Components to Create

### NEW COMPONENTS

| Component | File | Description |
|-----------|------|-------------|
| `PlanBadge` | `src/components/PlanBadge.tsx` | Badge in header showing plan type with color |
| `BusinessHealthCard` | `src/components/BusinessHealthCard.tsx` | Card on dashboard showing plan, status, renewal, users, branches |
| `SubscriptionPremiumPage` | `src/pages/settings/SubscriptionPremiumPage.tsx` | Premium subscription settings page |
| `SettingsLayout` | `src/pages/settings/SettingsLayout.tsx` | Tabs/layout for Settings section |
| `SecurityPage` | `src/pages/settings/SecurityPage.tsx` | Security settings (password, 2FA, sessions) |
| `IntegrationsPage` | `src/pages/settings/IntegrationsPage.tsx` | Integrations settings |
| `SettingsWrapper` | `src/pages/settings/SettingsWrapper.tsx` | Redirects old /settings to /settings/company |

### COMPONENTS TO MODIFY

| Component | Changes |
|-----------|---------|
| `Sidebar.tsx` | Complete restructure, remove billing/voucher, new groupings |
| `App.tsx` | Add new routes for settings/*, remove old billing/voucher routes |
| `Dashboard.tsx` | Add BusinessHealthCard component |

### COMPONENTS TO KEEP (no changes)
- All feature pages (Orders, Inventory, Tables, etc.)
- POS (route kept, just removed from sidebar)
- All existing business logic, RBAC checks

## 4. Plan Badge Design System

```
STARTER  → Blue (#3b82f6)    → bg-blue-500/10 border-blue-500/30
BUSINESS → Amber (#f59e0b)   → bg-amber-500/10 border-amber-500/30
ENTERPRISE → Purple (#a78bfa) → bg-purple-500/10 border-purple-500/30
ULTIMATE  → Emerald (#10b981) → bg-emerald-500/10 border-emerald-500/30
TRIAL     → Gray (#6b7280)    → bg-gray-500/10 border-gray-500/30
```

## 5. Glassmorphism Design Tokens

```css
/* Light glassmorphism card */
.glass-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

/* Dark mode glass */
.dark .glass-card {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
```

## 6. Plugin Architecture (No Business Logic Changes)

```
Sidebar
  ├── filter out billing/voucher items
  ├── reorganize into new sections
  ├── preserve RBAC role filtering
  └── preserve onClick/onClose handlers

App.tsx
  ├── Add SettingsLayout wrapper
  ├── Add /settings/* sub-routes
  ├── Remove /billing route (redirect to /settings/subscription)
  ├── Remove /admin/vouchers route from tenant
  └── Keep all existing feature routes unchanged

Dashboard
  ├── Inject BusinessHealthCard above KPI grid
  └── Keep all existing KPI/chart/activity logic
```

## 7. Migration Steps (No Regression Guarantee)

1. ✅ Create PlanBadge component (non-breaking, just adds to layout)
2. ✅ Create BusinessHealthCard component (non-breaking, just adds to dashboard)
3. ✅ Create SettingsLayout, SecurityPage, IntegrationsPage
4. ✅ Create SubscriptionPremiumPage (new page, new route)
5. ✅ Restructure Sidebar (remove items, regroup)
6. ✅ Update App.tsx routes
7. ✅ Remove old billing route
8. ✅ Remove old voucher validation route from tenant
9. 🔄 Test each step individually

## 8. Responsive Breakpoints

```
320px  → Very small phones (baseline)
480px  → Standard phones
640px  → Large phones / small phablets
768px  → Tablets portrait
1024px → Tablets landscape / small laptops
1200px → Standard desktop
```

All new components follow the same responsive pattern as existing components.

## 9. Premium African Aesthetic

- Colors inspired by African landscapes (savanna gold, deep earth, vibrant green)
- Warm gold accent (#D4AF37) retained for premium feel
- Deep charcoal backgrounds (#09090f)
- Smooth animations (cubic-bezier transitions)
- Rounded corners (12px-16px)
- Subtle gradient overlays
- Glassmorphism cards with backdrop blur

## 10. File Inventory

### Files to Create:
1. `src/components/PlanBadge.tsx`
2. `src/components/BusinessHealthCard.tsx`
3. `src/pages/settings/SettingsLayout.tsx`
4. `src/pages/settings/SettingsWrapper.tsx`
5. `src/pages/settings/SubscriptionPremiumPage.tsx`
6. `src/pages/settings/SecurityPage.tsx`
7. `src/pages/settings/IntegrationsPage.tsx`

### Files to Modify:
1. `src/components/Sidebar.tsx` — Restructure menu
2. `src/App.tsx` — Update routes

### Files to Keep Unchanged:
All feature pages, stores, server routes, API clients, business logic, RBAC middleware