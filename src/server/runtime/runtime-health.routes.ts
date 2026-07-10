import { Router } from 'express';
import { RuntimeContext } from '../../core/runtime/runtime-context';

const router = Router();

/**
 * GET /api/runtime/health
 * Retourne les informations sur le mode d'exécution détecté
 * Utile pour le debugging et la vérification de la configuration
 */
router.get('/api/runtime/health', (req, res) => {
  try {
    const runtime = RuntimeContext.getInstance();
    
    // NOTE: On utilise RuntimeContext uniquement, pas app-mode.ts
    // car app-mode.ts contient import.meta (Vite only) qui crash sur Node.js
    
    res.json({
      success: true,
      data: {
        mode: runtime.mode,
        database: runtime.isLocal ? 'sqlite' : 'supabase',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        runtimeContext: {
          mode: runtime.mode,
          isLocal: runtime.isLocal,
          isCloud: runtime.isCloud,
          isHybrid: runtime.isHybrid,
        },
        server: {
          nodeEnv: process.env.NODE_ENV,
          render: process.env.RENDER ? 'true' : 'false',
          vercel: process.env.VERCEL ? 'true' : 'false',
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get runtime information',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/runtime/mode
 * Retourne uniquement le mode détecté (version simplifiée)
 */
router.get('/api/runtime/mode', (req, res) => {
  try {
    const runtime = RuntimeContext.getInstance();
    res.json({
      mode: runtime.mode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to detect mode',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;