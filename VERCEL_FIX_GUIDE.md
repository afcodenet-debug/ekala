# 🚨 Guide de Correction Urgente pour Vercel

## Problème
La page `https://ekala.vercel.app/orders` n'affiche plus les commandes.

## Cause
Le frontend Vercel ne trouve pas le backend Render car **`VITE_API_BASE_URL` n'est pas configuré**.

## Solution (5 minutes)

---

### Étape 1 : Configurer VITE_API_BASE_URL dans Vercel

1. **Aller sur** : [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. **Sélectionner** votre projet **ekala**
3. **Aller dans** : Settings → Environment Variables
4. **Ajouter une nouvelle variable** :
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: `https://great-olive-api.onrender.com/api`
   - **Cocher** : "Development" et "Production"
5. **Sauvegarder**

### Étape 2 : Redéployer le Frontend
1. Dans Vercel dashboard, aller dans **Deployments**
2. Cliquer sur **"Trigger Redeploy"**
3. Attendre que le déploiement se termine (2-3 minutes)

### Étape 3 : Vérifier le Frontend
1. aller sur : https://ekala.vercel.app/orders
2. Ouvrir la **console du navigateur** (F12 → Console)
3. Chercher les messages :
   ```
   [API] Backend connection OK: https://great-olive-api.onrender.com/api
   ```
4. Si vous voyez des erreurs, vérifier la section **Résolution des Problèmes** ci-dessous

---

### Étape 4 : Vérifier le Backend Render
1. Aller sur : [https://dashboard.render.com](https://dashboard.render.com)
2. Sélectionner **great-olive-api**
3. Aller dans **Logs**
4. Chercher les messages :
   ```
   [PullSync] Worker started
   [PullSync] Bootstrap lookback enabled
   [OrderService] Using SQLite as source of truth
   ```

---

## ⚠️ Résolution des Problèmes

### Problème 1 : "Failed to fetch" dans la console
**Cause** : L'URL du backend est incorrecte

**Solution** :
- Vérifier dans la console : `Uncaught Error: Failed to fetch`
- Si l'URL contient `ekala-api.onrender.com`, c'est que la variable `VITE_API_BASE_URL` n'a pas été prise en compte
- **Solution** : Attendre le redéploiement Vercel OU vider le cache du navigateur

### Problème 2 : Erreur CORS
**Cause** : Le backend ne permet pas les requêtes depuis Vercel

**Solution** : Vérifier dans `src/server/server.ts` :
```typescript
// Doit contenant '*' OU explicitement 'https://ekala.vercel.app'
res.header('Access-Control-Allow-Origin', '*');
```

**La configuration actuelle** permettrait déjà toutes les origines.

### Problème 3 : Les commandes ne s'affichent toujours pas
**Diagnostic** :

1. **Tester l'API directement** :
   ```bash
   curl https://great-olive-api.onrender.com/api/orders
   ```
   
   **Résultat attendu** : Une liste JSON des commandes

2. **Si ça retourne une erreur** : Le problème est côté backend (Render)
   - Vérifier les logs Render pour des erreurs
   - Vérifier que SQLite est bien démarré

3. **Si ça retourne des commandes** : Le problème est côté frontend
   - Vérifier que `VITE_API_BASE_URL` est bien définie dans Vercel
   - Vérifier que le frontend utilise bien cette variable

---

## 🎯 Vérification Complète

###aturellement, si tout fonctionne :

| Test | Résultat Attendu | Comment Vérifier |
|------|-----------------|------------------|
| Connexion API | ✅ OK | Console : `[API] Backend connection OK` |
| Pull Sync Actif | ✅ YES | Logs Render : `[PullSync] Worker started` |
| Commandes affichées | ✅ Oui | Page /orders montre les commandes |
| Notifications | ✅ 1 | 1 notification pour 1 commande QR |

---

## 📞 Support Instantané

Si ça ne fonctionne toujours pas après ces étapes :

### Commandes de Diagnostic

**1. Tester l'API depuis votre navigateur** :
```
Ouvrir : https://great-olive-api.onrender.com/api/orders
```

**2. Tester le health endpoint** :
```
Ouvrir : https://great-olive-api.onrender.com/api/health
```
→ Doit retourner : `{"ok": true, "ts": "..."}`

**3. Tester le sync status** :
```
Ouvrir : https://great-olive-api.onrender.com/api/sync/status
```
→ Doit retourner : `{"worker": {"running": true, "enabled": true, ...}}`

### Solutions Rapides

**Si l'API ne répond pas** :
1. Vérifier que le service Render **great-olive-api** est **Live**
2. Vérifier les logs pour des erreurs de démarrage
3. Redémarrer le service manuellement depuis Render dashboard

**Si l'API répond mais le frontend ne charge pas** :
1. Vider le cache du navigateur (Ctrl+Shift+R ou Cmd+Shift+R)
2. Ouvrir une fenêtre de navigation privée
3. Vérifier qu'il n'y a pas de bloqueur de pub ou de VPN actif

---

## 🔄 Code de Contour (Emergency Fix)

Si vous ne pouvez pas attendre le déploiement Vercel, vous pouvez **temporairement** modifier `api-client.ts` :

```typescript
// Dans src/lib/api-client.ts, ligne 52 :
// CHANGER DE :
return 'https://ekala-api.onrender.com/api';
// EN :
return 'https://great-olive-api.onrender.com/api';
```

Puis recommitter et pousser vers Vercel pour déclencher un nouveau déploiement.

**⚠️ C'est une solution temporaire** - La vraie solution est de configurer `VITE_API_BASE_URL` dans Vercel.

---

## 📝 Résumé des Fichiers à Vérifier

| Fichier | Variable | Valeur à Configurer | Où |
|--------|----------|-------------------|-----|
| - | `VITE_API_BASE_URL` | `https://great-olive-api.onrender.com/api` | Vercel Dashboard |
| `render.yaml` | - | Already configured | Render Dashboard |
| `src/lib/api-client.ts` | Fallback URL | `https://great-olive-api.onrender.com/api` | ✅ Déjà corrigé |
| `src/server/server.ts` | CORS | `*` | ✅ Déjà configuré |

---

## ✅ Checklist Finale

- [ ] `VITE_API_BASE_URL` configurée dans Vercel avec `https://great-olive-api.onrender.com/api`
- [ ] Frontend **ekala** redéployé sur Vercel
- [ ] Backend **great-olive-api** est **Live** sur Render
- [ ] Test : `curl https://great-olive-api.onrender.com/api/orders` retourne des données
- [ ] Test : https://ekala.vercel.app/orders affiche les commandes
- [ ] Test : Une nouvelle commande QR trigger 1 notification (pas 7)

**Temps estimé** : 5-10 minutes

**Résultat final attendu** : ✅ La page des commandes fonctionne parfaitement en production aussi !
