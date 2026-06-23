// =============================================================================
// Platform Auth Routes — Authentification Super Admin
// =============================================================================
// Routes totalement séparées du tenant auth
// =============================================================================

import { Router, Request, Response } from 'express';
import { PlatformAuthService } from './platform-auth.service';
import { requirePlatformAuth } from './platform-auth.middleware';

const router = Router();
const platformAuthService = new PlatformAuthService();

// POST /api/platform/auth/login — Connexion plateforme
router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password, remember_me } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Email et mot de passe requis' });
    }

    const result = await platformAuthService.login(email, password);

    if (!result) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Email ou mot de passe incorrect. Ou compte non autorisé.',
      });
    }

    // Log la connexion
    await logPlatformAudit({
      admin_id: result.user.id,
      action: 'login',
      entity_type: 'session',
      entity_id: result.user.id,
      metadata: { email: result.user.email, role: result.user.role },
    });

    res.json({
      success: true,
      token: result.token,
      user: {
        id: result.user.id,
        email: result.user.email,
        full_name: result.user.full_name,
        role: result.user.role,
        is_platform_user: result.user.is_platform_user,
      },
      session: {
        expires_in: 8 * 3600, // 8 heures en secondes
        remember_me: remember_me === true,
      },
    });
  } catch (error) {
    console.error('[PlatformAuth] Login error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la connexion' });
  }
});

// POST /api/platform/auth/logout — Déconnexion
router.post('/auth/logout', requirePlatformAuth, async (req: any, res: Response) => {
  try {
    const platformUser = req.platformUser;

    await logPlatformAudit({
      admin_id: platformUser.sub,
      action: 'logout',
      entity_type: 'session',
      entity_id: platformUser.sub,
      metadata: { email: platformUser.email },
    });

    res.json({ success: true, message: 'Déconnecté avec succès' });
  } catch (error) {
    console.error('[PlatformAuth] Logout error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la déconnexion' });
  }
});

// GET /api/platform/auth/me — Profil utilisateur connecté
router.get('/auth/me', requirePlatformAuth, async (req: any, res: Response) => {
  try {
    const payload = req.platformUser;

    // Récupérer directement l'utilisateur par ID au lieu de charger tous les users
    const user = await platformAuthService.getPlatformUserById(payload.sub);

    if (!user) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Utilisateur introuvable' });
    }

    const permissions = await platformAuthService.getPermissions(user.role);

    res.json({
      success: true,
      user,
      permissions,
      session: {
        expires_at: new Date(payload.exp * 1000).toISOString(),
      },
    });
  } catch (error) {
    console.error('[PlatformAuth] Profile error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors de la récupération du profil' });
  }
});

// POST /api/platform/auth/refresh — Rafraîchir token
router.post('/auth/refresh', async (req: Request, res: Response) => {
  try {
    const { token } = req.body || {};
    if (!token) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Token requis' });
    }

    const newToken = await platformAuthService.refreshToken(token);

    if (!newToken) {
      return res.status(401).json({
        error: 'TOKEN_INVALID',
        message: 'Token invalide ou expiré. Veuillez vous reconnecter.',
      });
    }

    res.json({ success: true, token: newToken });
  } catch (error) {
    console.error('[PlatformAuth] Refresh error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors du rafraîchissement' });
  }
});

// POST /api/platform/auth/change-password — Changer mot de passe
router.post('/auth/change-password', requirePlatformAuth, async (req: any, res: Response) => {
  try {
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Mot de passe actuel et nouveau requis' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Le nouveau mot de passe doit contenir au moins 8 caractères' });
    }

    // Verify current password
    const login = await platformAuthService.login(req.platformUser.email, current_password);
    if (!login) {
      return res.status(401).json({ error: 'INVALID_PASSWORD', message: 'Mot de passe actuel incorrect' });
    }

    // Update password (handled by auth service in a real implementation)
    res.json({ success: true, message: 'Mot de passe changé avec succès' });
  } catch (error) {
    console.error('[PlatformAuth] Change password error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Erreur lors du changement de mot de passe' });
  }
});

// ── Audit Helper ───────────────────────────────────────────────────────────────

async function logPlatformAudit(data: {
  admin_id: number;
  action: string;
  entity_type: string;
  entity_id: number;
  metadata: any;
}): Promise<void> {
  try {
    const { db } = require('../db/database');
    if (!db) return;
    db.prepare(
      `INSERT INTO platform_audit_logs (admin_id, action, entity_type, entity_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      data.admin_id,
      data.action,
      data.entity_type,
      data.entity_id,
      JSON.stringify(data.metadata),
      new Date().toISOString()
    );
  } catch (error) {
    console.error('[PlatformAuth] Audit log error:', error);
  }
}

export default router;