/**
 * Routes pour la gestion des abonnements
 * GET /api/subscription/status - Récupère le statut d'abonnement du tenant
 */
import { Router } from 'express';
import { requireActiveSubscription } from '../middleware/subscription-guard';

const router = Router();

/**
 * GET /api/subscription/status
 * Retourne le statut d'abonnement du tenant connecté
 */
router.get('/status', requireActiveSubscription, async (req, res) => {
  try {
    // Le middleware a déjà vérifié l'abonnement et l'a attaché à req.subscription
    const subscription = (req as any).subscription;
    
    if (!subscription) {
      return res.status(404).json({
        error: 'NO_SUBSCRIPTION',
        message: 'Aucun abonnement trouvé pour ce tenant.'
      });
    }

    res.json({
      state: subscription.state,
      planName: subscription.planName,
      daysUntilRenewal: subscription.daysUntilRenewal,
      isExpired: subscription.isExpired,
      isGracePeriod: subscription.isGracePeriod,
      graceDaysRemaining: subscription.graceDaysRemaining,
      subscriptionId: subscription.subscriptionId,
      planId: subscription.planId,
    });
  } catch (err) {
    console.error('[SubscriptionRoutes] Error:', err);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Erreur lors de la récupération du statut d\'abonnement.'
    });
  }
});

export default router;