/**
 * TRACE PROCESS HOOKS — Crash-safe process lifecycle handlers
 * 
 * Garantit qu'aucun événement de trace n'est perdu lors de :
 *   - process.exit() normal
 *   - SIGINT (Ctrl+C)
 *   - SIGTERM (Render shutdown)
 *   - uncaughtException
 *   - unhandledRejection
 * 
 * Chaque hook force un flush complet du disk queue AVANT que le processus ne s'arrête.
 */

import { emergencyFlush, stopFlushScheduler } from './trace-flush-engine.service';
import { closeWriteStream } from './trace-disk-queue.service';

let hooksRegistered: boolean = false;
let isShuttingDown: boolean = false;

/**
 * Enregistre les hooks process pour garantir la persistance des traces avant shutdown.
 * Appelé une seule fois au démarrage du serveur.
 */
export function registerProcessHooks(): void {
  if (hooksRegistered) return;
  hooksRegistered = true;

  const handleShutdown = async (signal: string) => {
    if (isShuttingDown) {
      console.warn(`[TraceHooks] ${signal} reçu ×2 — force exit.`);
      process.exit(1);
    }
    isShuttingDown = true;

    console.log(`[TraceHooks] ${signal} reçu — exécution du flush d'urgence...`);

    // Stop flush scheduler to prevent concurrent operations
    stopFlushScheduler();

    // Force flush all pending events to disk
    try {
      await emergencyFlush();
    } catch (err: any) {
      console.error('[TraceHooks] Emergency flush error:', err.message);
    }

    // Close disk queue write stream
    closeWriteStream();

    console.log('[TraceHooks] Flush terminé — arrêt du processus.');
    
    // Give a small delay for final fsync to complete
    setTimeout(() => {
      process.exit(signal === 'SIGTERM' ? 0 : 1);
    }, 200);
  };

  // ── Normal exit ────────────────────────────────────────────────────────────────
  process.on('beforeExit', async (code) => {
    if (isShuttingDown) return;
    console.log(`[TraceHooks] beforeExit (code=${code}) — flush...`);
    await emergencyFlush();
    closeWriteStream();
  });

  // ── SIGINT (Ctrl+C) ────────────────────────────────────────────────────────────
  process.on('SIGINT', () => {
    handleShutdown('SIGINT');
  });

  // ── SIGTERM (Render / Docker stop) ──────────────────────────────────────────────
  process.on('SIGTERM', () => {
    handleShutdown('SIGTERM');
  });

  // ── Uncaught Exception ──────────────────────────────────────────────────────────
  process.on('uncaughtException', async (err) => {
    console.error('[TraceHooks] UNCAUGHT EXCEPTION:', err.message);
    console.error(err.stack);

    try {
      await emergencyFlush();
    } catch (flushErr: any) {
      console.error('[TraceHooks] Flush after exception failed:', flushErr.message);
    }

    closeWriteStream();
    process.exit(1);
  });

  // ── Unhandled Rejection ─────────────────────────────────────────────────────────
  process.on('unhandledRejection', async (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    console.error('[TraceHooks] UNHANDLED REJECTION:', message);

    try {
      await emergencyFlush();
    } catch (flushErr: any) {
      console.error('[TraceHooks] Flush after rejection failed:', flushErr.message);
    }

    closeWriteStream();
  });

  // ── Graceful shutdown handler (for custom shutdown signals) ─────────────────────
  (process as any).on('message', (msg: any) => {
    if (msg === 'shutdown') {
      handleShutdown('shutdown_message');
    }
  });

  console.log('[TraceHooks] Process hooks registered (SIGINT, SIGTERM, uncaughtException, unhandledRejection)');
}

/**
 * Vérifie si le processus est en train de s'arrêter.
 */
export function isShuttingDownProcess(): boolean {
  return isShuttingDown;
}