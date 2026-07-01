# go-public-menu

Déploiement Vercel pour l’écran **Public Menu** (`src/pages/PublicMenuPage.tsx`).

## Variables d’environnement (nécessaires)

Le composant appelle le backend via `VITE_API_BASE_URL`.

Dans Vercel, ajoute :
- **`VITE_API_BASE_URL`** = URL base de ton backend, ex: `https://api.tonsite.com`

> Exemples d’appels attendus côté client :
> - `GET  ${VITE_API_BASE_URL}/api/menu/table/:token`
> - `POST ${VITE_API_BASE_URL}/api/menu/register-customer`
> - `POST ${VITE_API_BASE_URL}/api/menu/checkout`
> - `POST ${VITE_API_BASE_URL}/api/menu/stock-alert`
> - `GET  ${VITE_API_BASE_URL}/api/orders/:id`

## Déploiement Vercel

Vercel doit utiliser le script :
```bash
npm run build:vercel
```

## Démarrage local
```bash
npm install
npm run dev:web
```

## Build Electron Desktop (macOS & Windows)

### Prérequis
- Node.js installé
- Pour Windows : builder sur Windows (ou CI GitHub Actions) car electron-builder ne cross-compile pas Windows depuis macOS de façon fiable sans toolchain lourde

### Commandes
```bash
# Rebuild better-sqlite3 pour l'Electron local AVANT le build final
npm run rebuild:sqlite

# Build complet + packaging Electron
npm run dist
```

### Résultats
- **macOS** : `dist/mac/EKALA.app` + `dist/mac/EKALA-*.dmg` et `.zip`
- **Windows** : `dist/win-unpacked/` + installeur NSIS `.exe` (si buildé sous Windows)

### Détail des scripts
- `build:electron` construit main + server + renderer pour Electron
- `dist` appelle `build:electron` puis `electron-builder`
