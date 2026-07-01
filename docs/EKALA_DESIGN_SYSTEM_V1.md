# EKALA DESIGN SYSTEM ENTERPRISE V1
## Design System de Niveau International

**Version:** 1.0  
**Date:** 2026-06-24  
**Status:** Design System Specification  
**Target:** Restaurants, Bars, Hôtels, Fast-foods, Night clubs, Cafés, Resorts (Afrique)

**Comparables:** Stripe Dashboard, Shopify Admin, Linear, Notion, Vercel, HubSpot, Lightspeed

---

## TABLE DES MATIÈRES

1. [Brand Identity](#1-brand-identity)
2. [Color System](#2-color-system)
3. [Dark Theme](#3-dark-theme)
4. [Typography](#4-typography)
5. [Spacing System](#5-spacing-system)
6. [Border Radius](#6-border-radius)
7. [Shadows](#7-shadows)
8. [Glassmorphism Rules](#8-glassmorphism-rules)
9. [Layout Rules](#9-layout-rules)
10. [Sidebar Rules](#10-sidebar-rules)
11. [Dashboard Rules](#11-dashboard-rules)
12. [Table Rules](#12-table-rules)
13. [KPI Cards Rules](#13-kpi-cards-rules)
14. [Analytics Cards Rules](#14-analytics-cards-rules)
15. [Charts Rules](#15-charts-rules)
16. [Modal Rules](#16-modal-rules)
17. [Drawer Rules](#17-drawer-rules)
18. [Empty States](#18-empty-states)
19. [Loading States](#19-loading-states)
20. [Error States](#20-error-states)
21. [Notifications](#21-notifications)
22. [Toasts](#22-toasts)
23. [Badges](#23-badges)
24. [Status Indicators](#24-status-indicators)
25. [Plan Badges](#25-plan-badges)
26. [Subscription Visual Language](#26-subscription-visual-language)
27. [Billing Visual Language](#27-billing-visual-language)
28. [Customer Success Visual Language](#28-customer-success-visual-language)
29. [Mobile Responsive Rules](#29-mobile-responsive-rules)
30. [Accessibility Rules](#30-accessibility-rules)
31. [UI Component Library](#31-ui-component-library)
32. [Visual Hierarchy](#32-visual-hierarchy)
33. [Uniformity Rules](#33-uniformity-rules)
34. [Anti-Patterns](#34-anti-patterns)

---

## 1. BRAND IDENTITY

### 1.1 Vision Visuelle
Ekala incarne l'élégance moderne africaine. Notre design évoque la confiance, l'innovation et le professionnalisme, tout en restant accessible et chaleureux. Nous combinons l'esthétique premium des leaders mondiaux (Stripe, Shopify) avec des touches culturelles africaines subtiles.

### 1.2 Valeurs Visuelles
- **Premium:** Design épuré, raffiné, attention aux détails
- **Moderne:** Tendances 2026+, glassmorphism, animations fluides
- **Africain:** Couleurs chaudes (or, terracotta), motifs subtils
- **Accessible:** Contraste optimal, lisibilité parfaite
- **Scalable:** Système cohérent, réutilisable, extensible

### 1.3 Personality
- **Professionnel:** Sérieux, fiable, expert
- **Innovant:** Moderne, cutting-edge, tech-forward
- **Chaleureux:** Accueillant, humain, accessible
- **Ambitieux:** Growth mindset, excellence, leadership

### 1.4 Tone
- **Clair:** Pas de jargon, communication simple
- **Direct:** Concise, efficace, action-oriented
- **Encourageant:** Positif, motivant, empowerment
- **Respectueux:** Inclusif, culturellement aware

---

## 2. COLOR SYSTEM

### 2.1 Primary Palette (Gold - Brand)

**Usage:** Actions principales, accents, highlights, CTAs

```
Gold-50:  #fefce8  (backgrounds légers)
Gold-100: #fef9c3  (hover states)
Gold-200: #fef08a  (borders légers)
Gold-300: #fde047  (icons, secondary actions)
Gold-400: #facc15  (highlights)
Gold-500: #D4AF37  (PRIMARY - main actions, links)
Gold-600: #ca8a04  (hover states)
Gold-700: #a16207  (active states)
Gold-800: #854d0e  (dark backgrounds)
Gold-900: #713f12  (darkest backgrounds)
```

**Contrast Ratios:**
- Gold-500 on Dark (#09090f): 7.2:1 (AAA)
- Gold-500 on White: 3.8:1 (AA)

### 2.2 Secondary Palette (Blue - Trust)

**Usage:** Liens, informations, éléments secondaires

```
Blue-50:  #eff6ff  (backgrounds légers)
Blue-100: #dbeafe  (hover states)
Blue-200: #bfdbfe  (borders légers)
Blue-300: #93c5fd  (icons)
Blue-400: #60a5fa  (highlights)
Blue-500: #3b82f6  (PRIMARY - links, info)
Blue-600: #2563eb  (hover states)
Blue-700: #1d4ed8  (active states)
Blue-800: #1e40af  (dark backgrounds)
Blue-900: #1e3a8a  (darkest backgrounds)
```

### 2.3 Success Palette (Green - Positive)

**Usage:** Succès, confirmations, états positifs

```
Green-50:  #f0fdf4  (backgrounds légers)
Green-100: #dcfce7  (hover states)
Green-200: #bbf7d0  (borders légers)
Green-300: #86efac  (icons)
Green-400: #4ade80  (highlights)
Green-500: #10b981  (PRIMARY - success)
Green-600: #059669  (hover states)
Green-700: #047857  (active states)
Green-800: #065f46  (dark backgrounds)
Green-900: #064e3b  (darkest backgrounds)
```

### 2.4 Warning Palette (Amber - Caution)

**Usage:** Avertissements, attention, états à surveiller

```
Amber-50:  #fffbeb  (backgrounds légers)
Amber-100: #fef3c7  (hover states)
Amber-200: #fde68a  (borders légers)
Amber-300: #fcd34d  (icons)
Amber-400: #fbbf24  (highlights)
Amber-500: #f59e0b  (PRIMARY - warning)
Amber-600: #d97706  (hover states)
Amber-700: #b45309  (active states)
Amber-800: #92400e  (dark backgrounds)
Amber-900: #78350f  (darkest backgrounds)
```

### 2.5 Danger Palette (Red - Error)

**Usage:** Erreurs, suppressions, états critiques

```
Red-50:  #fef2f2  (backgrounds légers)
Red-100: #fee2e2  (hover states)
Red-200: #fecaca  (borders légers)
Red-300: #fca5a5  (icons)
Red-400: #f87171  (highlights)
Red-500: #ef4444  (PRIMARY - error)
Red-600: #dc2626  (hover states)
Red-700: #b91c1c  (active states)
Red-800: #991b1b  (dark backgrounds)
Red-900: #7f1d1d  (darkest backgrounds)
```

### 2.6 Info Palette (Purple - Information)

**Usage:** Informations, tips, contenu informatif

```
Purple-50:  #faf5ff  (backgrounds légers)
Purple-100: #f3e8ff  (hover states)
Purple-200: #e9d5ff  (borders légers)
Purple-300: #d8b4fe  (icons)
Purple-400: #c084fc  (highlights)
Purple-500: #a78bfa  (PRIMARY - info)
Purple-600: #9333ea  (hover states)
Purple-700: #7c3aed  (active states)
Purple-800: #6b21a8  (dark backgrounds)
Purple-900: #581c87  (darkest backgrounds)
```

### 2.7 Neutral Palette (Grays)

**Usage:** Textes, backgrounds, borders

```
Gray-50:  #f9fafb  (backgrounds légers)
Gray-100: #f3f4f6  (borders légers)
Gray-200: #e5e7eb  (borders)
Gray-300: #d1d5db  (borders forts)
Gray-400: #9ca3af  (texts désactivés)
Gray-500: #6b7280  (texts secondaires)
Gray-600: #4b5563  (texts)
Gray-700: #374151  (texts foncés)
Gray-800: #1f2937  (backgrounds foncés)
Gray-900: #111827  (backgrounds très foncés)
```

### 2.8 Semantic Colors

**Background:**
- Background Primary: #09090f (dark)
- Background Secondary: #0f0f17 (dark elevated)
- Background Tertiary: #16161f (dark card)
- Background Hover: rgba(255,255,255,0.03)

**Text:**
- Text Primary: #eeeef5
- Text Secondary: rgba(255,255,255,0.6)
- Text Tertiary: rgba(255,255,255,0.4)
- Text Disabled: rgba(255,255,255,0.2)

**Borders:**
- Border Default: rgba(255,255,255,0.08)
- Border Hover: rgba(255,255,255,0.12)
- Border Focus: rgba(212,175,55,0.5) (Gold)
- Border Error: rgba(239,68,68,0.5) (Red)

---

## 3. DARK THEME

### 3.1 Palette Officielle

**Backgrounds:**
```
--bg-primary:      #09090f  (main background)
--bg-secondary:    #0f0f17  (elevated surfaces)
--bg-tertiary:     #16161f  (cards, modals)
--bg-elevated:     #1c1c27  (dropdowns, popovers)
--bg-hover:        rgba(255,255,255,0.03)
--bg-active:       rgba(255,255,255,0.05)
```

**Text:**
```
--text-primary:    #eeeef5
--text-secondary:  rgba(255,255,255,0.6)
--text-tertiary:   rgba(255,255,255,0.4)
--text-disabled:   rgba(255,255,255,0.2)
--text-inverse:    #09090f
```

**Borders:**
```
--border-default:  rgba(255,255,255,0.08)
--border-hover:    rgba(255,255,255,0.12)
--border-focus:    rgba(212,175,55,0.5)
--border-error:    rgba(239,68,68,0.5)
--border-success:  rgba(16,185,129,0.5)
```

**Accents:**
```
--accent-gold:     #D4AF37
--accent-blue:     #3b82f6
--accent-green:    #10b981
--accent-red:      #ef4444
--accent-purple:   #a78bfa
--accent-amber:    #f59e0b
```

### 3.2 Dark Theme Rules
- Tous les backgrounds doivent être dans la palette #09090f - #1c1c27
- Texte minimum contrast ratio: 4.5:1 (WCAG AA)
- Bordures subtiles (opacité 0.08-0.12)
- Accents Gold (#D4AF37) pour les éléments interactifs
- Éviter le blanc pur (#fff) sauf pour les icônes importantes

---

## 4. TYPOGRAPHY

### 4.1 Font Family

**Primary:** Inter (Google Fonts)
- Weights: 300 (Light), 400 (Regular), 500 (Medium), 600 (Semibold), 700 (Bold), 800 (Extrabold)

**Secondary (optional):** DM Sans
- Pour les headings et displays

**Monospace:** JetBrains Mono
- Pour les codes, montants, données

### 4.2 Type Scale

**Display:**
- Size: 48px
- Weight: 800 (Extrabold)
- Line Height: 1.1
- Letter Spacing: -0.02em
- Usage: Hero sections, empty states

**H1:**
- Size: 36px
- Weight: 700 (Bold)
- Line Height: 1.2
- Letter Spacing: -0.01em
- Usage: Page titles

**H2:**
- Size: 28px
- Weight: 600 (Semibold)
- Line Height: 1.3
- Letter Spacing: -0.01em
- Usage: Section titles

**H3:**
- Size: 22px
- Weight: 600 (Semibold)
- Line Height: 1.4
- Letter Spacing: 0
- Usage: Card titles, subsection titles

**H4:**
- Size: 18px
- Weight: 600 (Semibold)
- Line Height: 1.4
- Letter Spacing: 0
- Usage: Component titles, widget titles

**Body:**
- Size: 15px
- Weight: 400 (Regular)
- Line Height: 1.6
- Letter Spacing: 0
- Usage: Main content, paragraphs

**Small:**
- Size: 13px
- Weight: 400 (Regular)
- Line Height: 1.5
- Letter Spacing: 0
- Usage: Secondary text, captions

**Caption:**
- Size: 11px
- Weight: 500 (Medium)
- Line Height: 1.4
- Letter Spacing: 0.05em
- Text Transform: uppercase
- Usage: Labels, metadata, timestamps

### 4.3 Typography Rules
- Toujours utiliser Inter comme font principale
- Éviter les weights < 300 ou > 800
- Line height minimum: 1.4 pour la lisibilité
- Letter spacing négatif pour les grands textes (display, H1, H2)
- Letter spacing positif pour les petits textes (caption)
- Text transform uppercase uniquement pour les captions

---

## 5. SPACING SYSTEM

### 5.1 Base Unit: 4px

**Scale:**
```
4px   - xs   (micro spacing, icon gaps)
8px   - sm   (tight spacing, inline elements)
12px  - md   (default spacing, component padding)
16px  - lg   (comfortable spacing, card padding)
20px  - xl   (generous spacing, section gaps)
24px  - 2xl  (large spacing, page padding)
32px  - 3xl  (extra large, major sections)
40px  - 4xl  (hero sections)
48px  - 5xl  (page breaks)
64px  - 6xl  (major sections)
80px  - 7xl  (hero, full-page sections)
```

### 5.2 Spacing Rules
- Utiliser uniquement les valeurs de la scale
- Padding par défaut: 16px (lg)
- Gap par défaut: 12px (md)
- Margin par défaut entre sections: 24px (2xl)
- Margin par défaut entre components: 16px (lg)

---

## 6. BORDER RADIUS

### 6.1 Scale

```
4px   - xs   (badges, tags, small elements)
6px   - sm   (buttons, inputs)
8px   - md   (cards, dropdowns)
10px  - lg   (modals, large cards)
12px  - xl   (sidebars, major components)
16px  - 2xl  (hero sections, special cards)
18px  - 3xl  (dashboard cards)
24px  - full (circles, avatars)
```

### 6.2 Border Radius Rules
- Buttons: 8px (md)
- Inputs: 8px (md)
- Cards: 18px (3xl) pour dashboard, 12px (xl) pour contenu
- Modals: 16px (2xl)
- Badges: 6px (sm)
- Avatars: 24px (full)
- Sidebar: 0px (pas de radius)

---

## 7. SHADOWS

### 7.1 Shadow Scale

**Elevation 0 (flat):**
```
box-shadow: none;
```

**Elevation 1 (subtle):**
```
box-shadow: 0 1px 2px rgba(0,0,0,0.3);
```

**Elevation 2 (low):**
```
box-shadow: 0 4px 8px rgba(0,0,0,0.3);
```

**Elevation 3 (medium):**
```
box-shadow: 0 8px 16px rgba(0,0,0,0.3);
```

**Elevation 4 (high):**
```
box-shadow: 0 12px 24px rgba(0,0,0,0.4);
```

**Elevation 5 (highest):**
```
box-shadow: 0 16px 40px rgba(0,0,0,0.5);
```

**Glow Effects (accents):**
```
Gold Glow:  0 0 20px rgba(212,175,55,0.3)
Blue Glow:  0 0 20px rgba(59,130,246,0.3)
Green Glow: 0 0 20px rgba(16,185,129,0.3)
Red Glow:   0 0 20px rgba(239,68,68,0.3)
```

### 7.2 Shadow Rules
- Cards: Elevation 2 par défaut, Elevation 3 au hover
- Modals: Elevation 5
- Dropdowns: Elevation 3
- Buttons: Elevation 1 (primary), 0 (secondary)
- Floating elements: Elevation 4

---

## 8. GLASSMORPHISM RULES

### 8.1 Glass Card

**Background:**
```css
background: linear-gradient(
  135deg,
  rgba(255,255,255,0.03) 0%,
  rgba(255,255,255,0.01) 100%
);
```

**Backdrop Filter:**
```css
backdrop-filter: blur(16px);
-webkit-backdrop-filter: blur(16px);
```

**Border:**
```css
border: 1px solid rgba(255,255,255,0.08);
```

**Border Radius:**
```css
border-radius: 18px;
```

### 8.2 Glass Modal

**Background:**
```css
background: rgba(15,15,23,0.95);
```

**Backdrop Filter:**
```css
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
```

**Border:**
```css
border: 1px solid rgba(255,255,255,0.1);
```

**Border Radius:**
```css
border-radius: 16px;
```

### 8.3 Glass Sidebar

**Background:**
```css
background: rgba(10,10,15,0.98);
```

**Backdrop Filter:**
```css
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
```

**Border:**
```css
border-right: 1px solid rgba(255,255,255,0.08);
```

### 8.4 Glassmorphism Rules
- Toujours utiliser backdrop-filter: blur() pour l'effet glass
- Background opacity: 0.03-0.05 pour les cards, 0.95 pour les modals
- Border opacity: 0.08-0.12
- Éviter glassmorphism sur les éléments avec beaucoup de contenu (performance)
- Fallback: background solide si backdrop-filter non supporté

---

## 9. LAYOUT RULES

### 9.1 Grid System

**Desktop (>1024px):**
- Sidebar: 260px (fixed)
- Main content: flex-1 (remaining space)
- Max width: 1400px (centered)
- Padding: 32px horizontal

**Tablet (768-1024px):**
- Sidebar: overlay (260px)
- Main content: 100%
- Max width: 100%
- Padding: 24px horizontal

**Mobile (<768px):**
- Sidebar: full-width overlay
- Main content: 100%
- Max width: 100%
- Padding: 16px horizontal

### 9.2 Container Rules
- Max width: 1400px pour le contenu principal
- Centered avec margin: 0 auto
- Padding responsive: 32px (desktop), 24px (tablet), 16px (mobile)

### 9.3 Flexbox Rules
- Utiliser flexbox pour les layouts simples
- Utiliser CSS Grid pour les layouts complexes (dashboard, galleries)
- Gap par défaut: 12px (md)
- Align items: center pour les lignes, stretch pour les colonnes

### 9.4 Z-Index Scale

```
z-0:  0   (base)
z-10: 10  (dropdowns)
z-20: 20  (stickers, badges)
z-30: 30  (modals backdrop)
z-40: 40  (modals)
z-50: 50  (sidebars, drawers)
z-60: 60  (notifications, toasts)
z-70: 70  (loading spinners)
z-80: 80  (tooltips)
z-90: 90  (floating buttons)
z-100: 100 (critical alerts)
```

---

## 10. SIDEBAR RULES

### 10.1 Dimensions

**Desktop:**
- Width: 260px
- Collapsed Width: 0px
- Min Width: 260px

**Tablet:**
- Width: min(300px, 88vw)
- Overlay mode

**Mobile:**
- Width: 100vw
- Full-screen overlay

### 10.2 Structure

```
┌─────────────────────────────┐
│ Logo + Brand Name    [Toggle]│ 60px
├─────────────────────────────┤
│                             │
│ ── EXECUTIVE ────────────── │
│ 📊 Dashboard                │
│                             │
│ ── GROWTH ───────────────── │
│ 🏢 Tenants          [123]  │
│ 💳 Subscriptions    [MRR]  │
│ 📄 Vouchers         [5]    │
│                             │
│ ── OPERATIONS ───────────── │
│ 👥 Customer Success         │
│ 🎧 Support Center    [12]  │
│ 🔌 Integrations            │
│                             │
│ ── INTELLIGENCE ─────────── │
│ 📊 Analytics               │
│ 🛡️ Audit & Compliance      │
│                             │
│ ── INFRASTRUCTURE ───────── │
│ ⚡ Sync & Infrastructure    │
│ ⚙️ Settings                 │
│                             │
├─────────────────────────────┤
│ 🔔 Notifications            │
│ 👤 User Profile             │
│ 🚪 Logout                   │
└─────────────────────────────┘
```

### 10.3 Behavior

**Desktop:**
- Collapsible (toggle button)
- Smooth transition: 240ms cubic-bezier(0.4, 0, 0.2, 1)
- Hover effects sur les items
- Active state: Gold accent

**Tablet:**
- Overlay mode
- Close button (X)
- Backdrop blur
- Swipe to close (optionnel)

**Mobile:**
- Full-screen overlay
- Swipe to close
- Backdrop blur
- Close button (X)

### 10.4 Sidebar Rules
- Background: #0a0a0f (darker than main)
- Border: 1px solid rgba(255,255,255,0.08)
- Section labels: uppercase, 10px, letter-spacing 0.12em
- Icons: 20px Lucide React
- Font: Inter, 13px, weight 500
- Hover: rgba(255,255,255,0.03)
- Active: Gold accent background + border

---

## 11. DASHBOARD RULES

### 11.1 Layout

**Header:**
- Height: auto
- Title: H1 (28px, weight 300)
- Subtitle: Small (12px, color: text-tertiary)
- Actions: Right-aligned, gap 12px

**KPI Cards Grid:**
- Columns: repeat(auto-fit, minmax(240px, 1fr))
- Gap: 16px
- Cards: Glassmorphism, border-radius 18px

**Charts Section:**
- Columns: repeat(auto-fit, minmax(400px, 1fr))
- Gap: 20px
- Cards: Glassmorphism, border-radius 18px

**Tables Section:**
- Full width
- Card: Glassmorphism, border-radius 18px
- Header: Gradient accent line (3px)

### 11.2 Dashboard Rules
- Max width: 1400px, centered
- Padding: 32px vertical, 24px horizontal
- Background: #09090f
- Cards: Glassmorphism avec accent line en haut
- Animations: fade-in 400ms avec stagger
- Hover: translateY(-4px) + box-shadow

---

## 12. TABLE RULES

### 12.1 Structure

**Header:**
- Background: rgba(255,255,255,0.02)
- Border bottom: 1px solid rgba(255,255,255,0.06)
- Text: Caption (11px, uppercase, letter-spacing 0.08em)
- Color: text-tertiary
- Padding: 12px 16px

**Rows:**
- Background: transparent
- Border bottom: 1px solid rgba(255,255,255,0.04)
- Hover: rgba(255,255,255,0.02)
- Padding: 16px

**Cells:**
- Text: Body (15px)
- Color: text-primary
- Vertical align: middle

### 12.2 Table Rules
- Border collapse: collapse
- Width: 100%
- Border radius: 12px (overflow: hidden)
- Header sticky: top 0, background: bg-tertiary
- Zebra striping: non (utiliser hover à la place)
- Sort indicators: Gold accent (#D4AF37)
- Pagination: Bottom, centered, gap 8px

---

## 13. KPI CARDS RULES

### 13.1 Structure

```
┌────────────────────────────────┐
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬  │ ← Accent line (3px)
│                        [Icon]  │ ← Icon (44x44, rounded 12px)
│                        [Trend] │ ← Trend badge (top-right)
│                                │
│ LABEL                           │ ← Caption (11px, uppercase)
│ 123,456                         │ ← Value (32px, bold)
│                                │
└────────────────────────────────┘
```

### 13.2 KPI Card Rules
- Background: Glassmorphism (gradient 135deg)
- Border: 1px solid rgba(255,255,255,0.08)
- Border radius: 18px
- Padding: 24px 28px
- Accent line: 3px, gradient (color 60% → 10%)
- Icon: 44x44, rounded 12px, background: color-10%, border: color-25%
- Trend badge: 10px, rounded 6px, background: success-10% or danger-10%
- Value: 32px, weight 700, letter-spacing -0.02em
- Label: 11px, uppercase, letter-spacing 0.08em, color: text-tertiary
- Hover: translateY(-4px) + box-shadow elevation 3
- Animation: fade-in 400ms avec stagger

---

## 14. ANALYTICS CARDS RULES

### 14.1 Structure

**Chart Card:**
```
┌────────────────────────────────┐
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬  │ ← Accent line
│ Title                   [Link] │ ← Header
│ Subtitle                       │ ← Subtitle
│                                │
│        [CHART AREA]            │ ← Chart (min-height 200px)
│                                │
└────────────────────────────────┘
```

**Metric Card:**
```
┌────────────────────────────────┐
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬  │
│ Title                   [Link] │
│ Subtitle                       │
│                                │
│ 123,456        ↑ 12%           │ ← Value + Trend
│ Label                          │
│                                │
│ ▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰▰  │ ← Mini chart (sparkline)
│                                │
└────────────────────────────────┘
```

### 14.2 Analytics Card Rules
- Background: Glassmorphism
- Border radius: 18px
- Padding: 24px 28px
- Accent line: 3px gradient
- Header: Flex, space-between
- Title: H4 (18px, semibold)
- Link: 12px, color: Gold (#D4AF37)
- Chart: Min-height 200px, responsive
- Colors: Blue (#3b82f6) par défaut, variations selon le contexte

---

## 15. CHARTS RULES

### 15.1 Color Palette

**Primary Chart Colors:**
```
Blue:    #3b82f6  (primary data)
Gold:    #D4AF37  (secondary data, highlights)
Green:   #10b981  (positive trends)
Red:     #ef4444  (negative trends)
Purple:  #a78bfa  (tertiary data)
Amber:   #f59e0b  (warnings)
```

**Chart Background:**
```
Grid lines: rgba(255,255,255,0.06)
Axis: rgba(255,255,255,0.1)
Labels: rgba(255,255,255,0.4)
```

### 15.2 Chart Types

**Line Chart:**
- Stroke width: 2px
- Fill: gradient (color 20% → transparent)
- Points: 4px radius, white border 2px
- Hover: 6px radius, glow effect

**Bar Chart:**
- Width: 40px (default), gap: 8px
- Border radius: 6px (top)
- Hover: brightness +20%

**Pie/Donut Chart:**
- Border radius: 4px (between segments)
- Inner radius (donut): 60%
- Labels: 11px, outside

**Area Chart:**
- Fill: gradient (color 30% → transparent)
- Stroke: 2px solid color

### 15.3 Chart Rules
- Min height: 200px
- Responsive: width 100%, height auto
- Tooltip: Glassmorphism, padding 12px 16px
- Legend: Bottom, horizontal, gap 16px
- Animations: 300ms ease-out

---

## 16. MODAL RULES

### 16.1 Structure

**Backdrop:**
```
background: rgba(0,0,0,0.6);
backdrop-filter: blur(8px);
-webkit-backdrop-filter: blur(8px);
```

**Modal Container:**
```
background: rgba(15,15,23,0.95);
backdrop-filter: blur(20px);
border: 1px solid rgba(255,255,255,0.1);
border-radius: 16px;
box-shadow: 0 16px 40px rgba(0,0,0,0.5);
max-width: 600px;
width: 90%;
max-height: 90vh;
overflow-y: auto;
```

**Header:**
```
padding: 24px 28px;
border-bottom: 1px solid rgba(255,255,255,0.08);
```

**Body:**
```
padding: 24px 28px;
```

**Footer:**
```
padding: 16px 28px;
border-top: 1px solid rgba(255,255,255,0.08);
display: flex;
justify-content: flex-end;
gap: 12px;
```

### 16.2 Modal Rules
- Animation: fade-in + scale (0.95 → 1)
- Duration: 200ms
- Close button: Top-right, 36x36px
- Focus trap: Oui
- Escape to close: Oui
- Click outside to close: Oui

---

## 17. DRAWER RULES

### 17.1 Structure

**Backdrop:**
```
background: rgba(0,0,0,0.5);
backdrop-filter: blur(4px);
```

**Drawer Container:**
```
background: #0f0f17;
border-left: 1px solid rgba(255,255,255,0.08);
width: 400px;
max-width: 90vw;
height: 100vh;
overflow-y: auto;
box-shadow: 4px 0 40px rgba(0,0,0,0.5);
```

**Header:**
```
padding: 24px;
border-bottom: 1px solid rgba(255,255,255,0.08);
```

**Body:**
```
padding: 24px;
```

**Footer:**
```
padding: 16px 24px;
border-top: 1px solid rgba(255,255,255,0.08);
```

### 17.2 Drawer Rules
- Animation: slide-in from right (300ms)
- Close button: Top-right
- Swipe to close (mobile)
- Max width: 400px (desktop), 90vw (mobile)

---

## 18. EMPTY STATES

### 18.1 Structure

```
┌────────────────────────────────┐
│                                │
│         [Icon 64x64]           │ ← Large icon, color: text-tertiary
│                                │
│      Title (H3, 18px)          │ ← Title
│   Subtitle (Small, 13px)       │ ← Description
│                                │
│    [Action Button]             │ ← Optional CTA
│                                │
└────────────────────────────────┘
```

### 18.2 Empty State Rules
- Icon: 64x64, color: text-tertiary
- Title: H3 (18px, semibold)
- Subtitle: Small (13px, color: text-secondary)
- Max width: 400px, centered
- Padding: 80px 24px
- Animation: fade-in 400ms

---

## 19. LOADING STATES

### 19.1 Spinner

**Structure:**
```
width: 40px;
height: 40px;
border-radius: 50%;
border: 3px solid rgba(255,255,255,0.1);
border-top-color: #D4AF37;
animation: spin 0.8s linear infinite;
```

**Animation:**
```css
@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### 19.2 Skeleton

**Structure:**
```
background: linear-gradient(
  90deg,
  rgba(255,255,255,0.03) 0%,
  rgba(255,255,255,0.06) 50%,
  rgba(255,255,255,0.03) 100%
);
border-radius: 8px;
animation: shimmer 2s infinite;
```

**Animation:**
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

### 19.3 Loading Rules
- Spinner: 40px (default), 24px (inline)
- Skeleton: border-radius 8px, animation 2s infinite
- Full-page loading: Centered, min-height 400px
- Inline loading: 24px spinner

---

## 20. ERROR STATES

### 20.1 Structure

```
┌────────────────────────────────┐
│                                │
│    [Error Icon 48x48]          │ ← Icon, color: Red-500
│                                │
│   Title (H3, 18px, Red)        │ ← "Something went wrong"
│   Subtitle (Small, 13px)       │ ← Description
│                                │
│    [Retry Button]              │ ← CTA
│                                │
└────────────────────────────────┘
```

### 20.2 Error Rules
- Icon: 48x48, color: Red-500
- Title: H3 (18px, semibold, color: Red-500)
- Subtitle: Small (13px, color: text-secondary)
- Max width: 400px, centered
- Padding: 60px 24px

---

## 21. NOTIFICATIONS

### 21.1 Structure

**Badge:**
```
width: 18px;
height: 18px;
border-radius: 50%;
background: #D4AF37;
color: #09090f;
font-size: 10px;
font-weight: 700;
display: flex;
align-items: center;
justify-content: center;
padding: 0 4px;
```

**Notification Item:**
```
┌────────────────────────────────┐
│ [Icon] Title            [Time] │
│        Subtitle                │
└────────────────────────────────┘
```

### 21.2 Notification Rules
- Badge: 18px, Gold background, dark text
- Unread: Background rgba(212,175,55,0.05)
- Read: Background transparent
- Hover: Background rgba(255,255,255,0.03)
- Icon: 16px, color: text-tertiary
- Title: 13px, weight 600
- Subtitle: 11px, color: text-tertiary
- Time: 10px, color: text-tertiary, caption style

---

## 22. TOASTS

### 22.1 Structure

```
┌────────────────────────────────┐
│ [Icon] Title                   │
│        Message                 │
│                        [Close] │
└────────────────────────────────┘
```

### 22.2 Toast Types

**Success:**
```
background: rgba(16,185,129,0.1);
border: 1px solid rgba(16,185,129,0.25);
icon: CheckCircle2, color: #10b981
```

**Error:**
```
background: rgba(239,68,68,0.1);
border: 1px solid rgba(239,68,68,0.25);
icon: AlertTriangle, color: #ef4444
```

**Warning:**
```
background: rgba(245,158,11,0.1);
border: 1px solid rgba(245,158,11,0.25);
icon: AlertTriangle, color: #f59e0b
```

**Info:**
```
background: rgba(59,130,246,0.1);
border: 1px solid rgba(59,130,246,0.25);
icon: Info, color: #3b82f6
```

### 22.3 Toast Rules
- Position: Bottom-right
- Width: 360px
- Padding: 16px 20px
- Border radius: 12px
- Animation: slide-in from right (300ms)
- Auto-dismiss: 5s (configurable)
- Close button: Top-right, 24x24px

---

## 23. BADGES

### 23.1 Structure

```
┌──────────────────┐
│  BADGE TEXT       │
└──────────────────┘
```

### 23.2 Badge Variants

**Default:**
```
background: rgba(255,255,255,0.1);
color: #eeeef5;
border: 1px solid rgba(255,255,255,0.15);
```

**Primary (Gold):**
```
background: rgba(212,175,55,0.1);
color: #D4AF37;
border: 1px solid rgba(212,175,55,0.25);
```

**Success:**
```
background: rgba(16,185,129,0.1);
color: #10b981;
border: 1px solid rgba(16,185,129,0.25);
```

**Warning:**
```
background: rgba(245,158,11,0.1);
color: #f59e0b;
border: 1px solid rgba(245,158,11,0.25);
```

**Danger:**
```
background: rgba(239,68,68,0.1);
color: #ef4444;
border: 1px solid rgba(239,68,68,0.25);
```

### 23.3 Badge Rules
- Padding: 4px 10px
- Border radius: 6px
- Font size: 11px
- Font weight: 600
- Letter spacing: 0.02em

---

## 24. STATUS INDICATORS

### 24.1 Structure

```
● Active
● Inactive
● Pending
● Error
```

### 24.2 Status Colors

**Active (Green):**
```
dot: 8px, background: #10b981, box-shadow: 0 0 6px #10b981
text: 11px, color: #10b981, uppercase, weight 700
```

**Inactive (Gray):**
```
dot: 8px, background: #6b7280, box-shadow: 0 0 6px #6b7280
text: 11px, color: #6b7280, uppercase, weight 700
```

**Pending (Amber):**
```
dot: 8px, background: #f59e0b, box-shadow: 0 0 6px #f59e0b
text: 11px, color: #f59e0b, uppercase, weight 700
```

**Error (Red):**
```
dot: 8px, background: #ef4444, box-shadow: 0 0 6px #ef4444
text: 11px, color: #ef4444, uppercase, weight 700
```

### 24.3 Status Rules
- Dot: 8px, border-radius 50%, glow effect
- Text: 11px, uppercase, letter-spacing 0.05em, weight 700
- Container: inline-flex, align-items center, gap 6px, padding 4px 10px, border-radius 6px

---

## 25. PLAN BADGES

### 25.1 Structure

```
┌─────────────────────────────┐
│  ⭐ TRIAL                   │
└─────────────────────────────┘
```

### 25.2 Plan Variants

**TRIAL:**
```
background: rgba(107,114,128,0.1);
border: 1px solid rgba(107,114,128,0.25);
color: #6b7280;
icon: Clock
```

**STARTER:**
```
background: rgba(59,130,246,0.1);
border: 1px solid rgba(59,130,246,0.25);
color: #3b82f6;
icon: Zap
```

**BUSINESS:**
```
background: rgba(212,175,55,0.1);
border: 1px solid rgba(212,175,55,0.25);
color: #D4AF37;
icon: TrendingUp
```

**ENTERPRISE:**
```
background: rgba(139,92,246,0.1);
border: 1px solid rgba(139,92,246,0.25);
color: #a78bfa;
icon: Building2
```

**ULTIMATE:**
```
background: linear-gradient(135deg, rgba(212,175,55,0.15), rgba(139,92,246,0.15));
border: 1px solid rgba(212,175,55,0.3);
color: linear-gradient(90deg, #D4AF37, #a78bfa);
icon: Crown
```

### 25.3 Plan Badge Rules
- Padding: 6px 14px
- Border radius: 8px
- Font size: 11px
- Font weight: 700
- Letter spacing: 0.08em
- Text transform: uppercase
- Icon: 14px, margin-right 6px
- Gradient text pour ULTIMATE uniquement

---

## 26. SUBSCRIPTION VISUAL LANGUAGE

### 26.1 Subscription Cards

**Active:**
```
border-left: 3px solid #10b981 (Green)
background: rgba(16,185,129,0.03)
```

**Trial:**
```
border-left: 3px solid #f59e0b (Amber)
background: rgba(245,158,11,0.03)
```

**Expired:**
```
border-left: 3px solid #ef4444 (Red)
background: rgba(239,68,68,0.03)
```

**Suspended:**
```
border-left: 3px solid #6b7280 (Gray)
background: rgba(107,114,128,0.03)
```

### 26.2 Subscription Elements
- Status badge: Color-coded (voir Status Indicators)
- Renewal date: Caption style, color: text-tertiary
- Plan badge: Plan Badge component
- Progress bar: For trial period (Amber gradient)

---

## 27. BILLING VISUAL LANGUAGE

### 27.1 Invoice Cards

**Paid:**
```
border-left: 3px solid #10b981 (Green)
icon: CheckCircle2, color: #10b981
```

**Pending:**
```
border-left: 3px solid #f59e0b (Amber)
icon: Clock, color: #f59e0b
```

**Failed:**
```
border-left: 3px solid #ef4444 (Red)
icon: XCircle, color: #ef4444
```

### 27.2 Payment Methods

**Mobile Money:**
```
icon: Smartphone, color: #3b82f6
label: "Mobile Money"
```

**Card:**
```
icon: CreditCard, color: #a78bfa
label: "Carte bancaire"
```

**Bank Transfer:**
```
icon: Building2, color: #10b981
label: "Virement"
```

### 27.3 Billing Elements
- Amount: 24px, weight 700, color: text-primary
- Currency: 12px, color: text-tertiary
- Date: Caption style
- Status: Status Indicator component

---

## 28. CUSTOMER SUCCESS VISUAL LANGUAGE

### 28.1 Health Score

**Healthy (70-100):**
```
color: #10b981 (Green)
icon: CheckCircle2
background: rgba(16,185,129,0.1)
```

**At Risk (40-69):**
```
color: #f59e0b (Amber)
icon: AlertTriangle
background: rgba(245,158,11,0.1)
```

**Critical (0-39):**
```
color: #ef4444 (Red)
icon: XCircle
background: rgba(239,68,68,0.1)
```

### 28.2 NPS Score

**Promoters (9-10):**
```
color: #10b981 (Green)
```

**Passives (7-8):**
```
color: #f59e0b (Amber)
```

**Detractors (0-6):**
```
color: #ef4444 (Red)
```

### 28.3 Customer Success Elements
- Health score: Gauge component, color-coded
- NPS: Large number (48px), color-coded
- Engagement: Progress bar, Gold gradient
- Onboarding: Step indicator, Green when complete

---

## 29. MOBILE RESPONSIVE RULES

### 29.1 Breakpoints

```
Mobile:     < 768px   (320px - 767px)
Tablet:     768px - 1024px
Desktop:    > 1024px  (1025px+)
```

### 29.2 Mobile Rules

**Sidebar:**
- Full-screen overlay
- Swipe to close
- Close button (X) top-right
- Width: 100vw

**Cards:**
- Full width
- Padding: 16px (réduit de 24px)
- Border radius: 12px (réduit de 18px)

**Tables:**
- Card view (au lieu de table)
- Horizontal scroll (optionnel)
- Stacked layout

**Forms:**
- Full width inputs
- Stacked labels
- Larger touch targets (min 44px)

**Buttons:**
- Min width: 44px (touch target)
- Full width (optionnel)
- Padding: 12px 20px

**Typography:**
- H1: 28px (au lieu de 36px)
- H2: 22px (au lieu de 28px)
- Body: 14px (au lieu de 15px)

**Spacing:**
- Padding: 16px (au lieu de 24px)
- Gap: 12px (au lieu de 16px)

### 29.3 Tablet Rules
- Sidebar: Overlay, 260px
- Cards: 2 columns (au lieu de 3-4)
- Tables: Horizontal scroll
- Forms: 2 columns (optionnel)

---

## 30. ACCESSIBILITY RULES

### 30.1 WCAG 2.1 Compliance

**Contrast Ratios:**
- Normal text (< 18px): 4.5:1 minimum (AA)
- Large text (≥ 18px): 3:1 minimum (AA)
- UI components: 3:1 minimum (AA)

**Focus Indicators:**
```
outline: 2px solid #D4AF37;
outline-offset: 2px;
```

**Touch Targets:**
- Min size: 44x44px
- Spacing: 8px minimum entre targets

### 30.2 Keyboard Navigation
- Tab order: Logical, top-to-bottom, left-to-right
- Focus trap: Modals, drawers
- Escape to close: Modals, drawers, dropdowns
- Enter to submit: Forms, buttons

### 30.3 Screen Readers
- Alt text: Toutes les images
- ARIA labels: Éléments interactifs
- ARIA live regions: Notifications, toasts
- Semantic HTML: Utiliser les bonnes balises

### 30.4 Accessibility Rules
- Éviter le texte en images
- Fournir des alternatives textuelles
- Tester avec screen readers (NVDA, JAWS)
- Tester avec keyboard uniquement
- Tester avec zoom 200%

---

## 31. UI COMPONENT LIBRARY

### 31.1 Core Components

**Layout:**
- Container
- Grid
- Flex
- Stack
- Divider

**Navigation:**
- Sidebar
- TopNav
- Breadcrumb
- Tabs
- Pagination

**Feedback:**
- Alert
- Toast
- Notification
- Badge
- Progress
- Spinner
- Skeleton

**Data Display:**
- Card
- Table
- List
- Avatar
- Icon
- Image
- Video

**Input:**
- Button
- Input
- Textarea
- Select
- Checkbox
- Radio
- Switch
- Slider

**Surfaces:**
- Modal
- Drawer
- Popover
- Tooltip
- Dropdown

**Charts:**
- LineChart
- BarChart
- PieChart
- AreaChart
- GaugeChart

### 31.2 Component Rules
- Tous les components doivent être réutilisables
- Props standardisées (className, style, onClick, etc.)
- Variants: primary, secondary, tertiary, ghost
- Sizes: sm, md, lg
- States: default, hover, active, disabled, loading, error

---

## 32. VISUAL HIERARCHY

### 32.1 Hierarchy Levels

**Level 1 (Primary):**
- Page titles (H1)
- Primary CTAs
- KPI values
- Color: Gold (#D4AF37) ou Text Primary

**Level 2 (Secondary):**
- Section titles (H2)
- Card titles (H3)
- Secondary actions
- Color: Text Primary

**Level 3 (Tertiary):**
- Component titles (H4)
- Body text
- Color: Text Primary

**Level 4 (Quaternary):**
- Captions
- Metadata
- Timestamps
- Color: Text Tertiary

### 32.2 Hierarchy Rules
- Un seul Level 1 par page
- Maximum 3-4 Level 2 par page
- Utiliser la taille, weight, et couleur pour créer la hiérarchie
- Éviter plus de 3 niveaux de hiérarchie visuelle

---

## 33. UNIFORMITY RULES

### 33.1 Design Tokens

**Couleurs:**
- Utiliser uniquement les couleurs du Design System
- Pas de couleurs hardcodées (#fff, #000, etc.)
- Utiliser les variables CSS (--color-*)

**Spacing:**
- Utiliser uniquement les valeurs de la spacing scale
- Pas de margins/paddings arbitraires

**Typography:**
- Utiliser uniquement les tailles du type scale
- Pas de tailles hardcodées

**Border Radius:**
- Utiliser uniquement les valeurs de la radius scale
- Pas de border-radius arbitraires

**Shadows:**
- Utiliser uniquement les shadows du système
- Pas de box-shadow hardcodées

### 33.2 Component Usage
- Utiliser les components du Design System
- Pas de composants custom sans validation
- Documenter les exceptions

### 33.3 Consistency Rules
- Même composant = même comportement
- Même action = même couleur (primary = Gold)
- Même état = même style (error = Red)
- Même icône = même sens (check = success, X = error)

---

## 34. ANTI-PATTERNS

### 34.1 ❌ INTERDITS

**Couleurs:**
- ❌ Blanc pur (#fff) sur fond clair
- ❌ Noir pur (#000) sur fond foncé
- ❌ Plus de 3 couleurs par composant
- ❌ Couleurs non contrastées (< 4.5:1)

**Typography:**
- ❌ Plus de 3 font families
- ❌ Tailles hardcodées
- ❌ Line-height < 1.4
- ❌ Letter-spacing excessif

**Spacing:**
- ❌ Margins/paddings arbitraires
- ❌ Espacement incohérent
- ❌ Crowding (éléments trop proches)

**Shadows:**
- ❌ Plus de 2 shadows par élément
- ❌ Shadows trop fortes (opacité > 0.5)
- ❌ Shadows sans logique d'élévation

**Glassmorphism:**
- ❌ Trop de glass (performance)
- ❌ Glass sans backdrop-filter
- ❌ Glass sur fonds complexes

**Animations:**
- ❌ Animations > 500ms
- ❌ Animations sans easing
- ❌ Animations sur tous les éléments

**Mobile:**
- ❌ Texte < 12px
- ❌ Touch targets < 44px
- ❌ Horizontal scroll sans indication
- ❌ Modals plein écran (sauf mobile)

**Accessibility:**
- ❌ Contraste < 4.5:1
- ❌ Focus indicators invisibles
- ❌ Touch targets < 44px
- ❌ Texte en images

### 34.2 ✅ OBLIGATOIRES

**Couleurs:**
- ✅ Utiliser les tokens CSS (--color-*)
- ✅ Vérifier les contrast ratios
- ✅ Tester en dark/light mode

**Typography:**
- ✅ Utiliser Inter comme font principale
- ✅ Respecter le type scale
- ✅ Line-height minimum 1.4

**Spacing:**
- ✅ Utiliser la spacing scale
- ✅ Padding minimum 12px
- ✅ Gap minimum 8px

**Shadows:**
- ✅ Utiliser les shadows du système
- ✅ Éviter les ombres multiples
- ✅ Logique d'élévation cohérente

**Glassmorphism:**
- ✅ Backdrop-filter obligatoire
- ✅ Background opacity 0.03-0.05
- ✅ Border opacity 0.08-0.12

**Animations:**
- ✅ Duration 200-400ms
- ✅ Easing: cubic-bezier(0.4, 0, 0.2, 1)
- ✅ Stagger pour les listes

**Mobile:**
- ✅ Touch targets ≥ 44px
- ✅ Texte minimum 12px
- ✅ Responsive breakpoints respectés

**Accessibility:**
- ✅ Contrast ratios WCAG AA
- ✅ Focus indicators visibles
- ✅ Keyboard navigation
- ✅ Screen reader testing

---

## CONCLUSION

Ce Design System Enterprise V1 définit les standards visuels et interactionnels pour Ekala Platform.

**Points clés:**
- Identité visuelle premium africaine
- Système de couleurs complet (50-900)
- Dark theme officiel
- Typography moderne (Inter)
- Spacing, radius, shadows standardisés
- Glassmorphism rules
- Components library complète
- Mobile responsive
- Accessibility WCAG 2.1 AA
- Anti-patterns clairs

**Prochaine étape:** Implémentation React des components + Application sur toutes les pages

**Comparables:** Stripe, Shopify, Linear, Notion, Vercel, HubSpot, Lightspeed