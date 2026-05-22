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
